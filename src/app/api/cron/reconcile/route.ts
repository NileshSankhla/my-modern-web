/**
 * Reconciliation Cron Endpoint
 * 
 * Compares cached wallet balances against ledger-derived balances.
 * Runs hourly via Vercel Cron.
 * 
 * CRITICAL: This job NEVER auto-repairs mismatches.
 * All mismatches are logged and alerted for manual investigation.
 * 
 * Security: Protected by Vercel Cron auth header.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { wallets, walletTransactions, reconciliationResults } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Verify Vercel Cron authorization
function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

interface MismatchResult {
  walletId: string;
  userId: string;
  walletType: string;
  cachedBalance: number;
  ledgerBalance: number;
  difference: number;
}

export async function GET(request: Request) {
  // Verify authorization
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  let mismatchesFound: MismatchResult[] = [];
  let walletsChecked = 0;

  try {
    // Prevent concurrent cron executions via Redis Distributed Lock
    const hourKey = new Date().toISOString().substring(0, 13); // e.g. "2024-03-15T14"
    const lockKey = `cron_lock:reconcile:${hourKey}`;
    const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 300 });

    if (!acquired) {
      console.log('Cron skipped: Lock already held by another instance.');
      return NextResponse.json({ status: 'skipped', reason: 'already_running_or_completed' });
    }

    // Run the reconciliation query
    // This compares each wallet's cached balance against the sum of its ledger entries
    const reconciliationQuery = sql`
      WITH ledger_sums AS (
        SELECT 
          wt.wallet_id,
          SUM(
            CASE 
              WHEN wt.transaction_type IN ('CASHBACK', 'BONUS', 'REFUND', 'MANUAL_CREDIT', 'REVERSAL_CREDIT') 
              THEN wt.amount_in_paise 
              ELSE -wt.amount_in_paise 
            END
          ) AS calculated_balance
        FROM wallet_transactions wt
        GROUP BY wt.wallet_id
      )
      SELECT 
        w.id AS wallet_id,
        w.user_id,
        w.wallet_type,
        w.balance_in_paise AS cached_balance,
        COALESCE(ls.calculated_balance, 0) AS ledger_balance
      FROM wallets w
      LEFT JOIN ledger_sums ls ON w.id = ls.wallet_id
      WHERE w.balance_in_paise != COALESCE(ls.calculated_balance, 0)
         OR ls.calculated_balance IS NULL
    `;

    const results = await db.execute(reconciliationQuery);
    mismatchesFound = results.rows as unknown as MismatchResult[];

    // Get total wallets for reporting
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(wallets);
    walletsChecked = countResult[0].count;

    // Use a transaction for bulk insert of logs to prevent partial records
    await db.transaction(async (tx) => {
      const logsToInsert: any[] = [];
      const timestamp = new Date();

      for (const mismatch of mismatchesFound) {
        logsToInsert.push({
          walletId: Number(mismatch.walletId),
          userId: Number(mismatch.userId),
          walletType: mismatch.walletType as any,
          cachedBalance: Number(mismatch.cachedBalance),
          ledgerBalance: Number(mismatch.ledgerBalance),
          difference: Number(mismatch.difference) || (Number(mismatch.cachedBalance) - Number(mismatch.ledgerBalance)),
          status: 'MISMATCH',
          detectedAt: timestamp,
          metadata: {
            source: 'scheduled_reconciliation',
            cronRunAt: timestamp.toISOString(),
          },
        });
      }

      logsToInsert.push({
        walletId: null,
        userId: null,
        walletType: null,
        cachedBalance: null,
        ledgerBalance: null,
        difference: null,
        status: 'RECONCILIATION_COMPLETE',
        detectedAt: timestamp,
        metadata: {
          source: 'scheduled_reconciliation',
          walletsChecked,
          mismatchesFound: mismatchesFound.length,
          durationMs: Date.now() - startTime,
          cronRunAt: timestamp.toISOString(),
        },
      });

      // Bulk insert all at once
      await tx.insert(reconciliationResults).values(logsToInsert);
    });

    // CRITICAL: If mismatches exist, this should trigger an alert
    // In production, integrate with Sentry/PagerDuty here
    if (mismatchesFound.length > 0) {
      console.error('CRITICAL: Ledger reconciliation found mismatches!', {
        count: mismatchesFound.length,
        wallets: mismatchesFound.map(m => ({
          walletId: m.walletId,
          userId: m.userId,
          cachedBalance: m.cachedBalance,
          ledgerBalance: m.ledgerBalance,
          difference: m.difference,
        })),
      });

      // TODO: Send to Sentry
      // Sentry.captureMessage('Ledger reconciliation mismatch detected', {
      //   level: 'error',
      //   extra: { mismatches: mismatchesFound },
      // });

      // TODO: Send to PagerDuty if critical threshold exceeded
      // if (mismatchesFound.length >= CRITICAL_MISMATCH_THRESHOLD) {
      //   await triggerPagerDutyAlert(...);
      // }
    }

    return NextResponse.json({
      status: 'complete',
      walletsChecked,
      mismatchesFound: mismatchesFound.length,
      durationMs: Date.now() - startTime,
      mismatches: mismatchesFound.length > 0 ? mismatchesFound : undefined,
    });
  } catch (error) {
    console.error('Reconciliation job failed:', error);

    // Log the failure
    await db.insert(reconciliationResults).values({
      walletId: null,
      userId: null,
      walletType: null,
      cachedBalance: null,
      ledgerBalance: null,
      difference: null,
      status: 'RECONCILIATION_FAILED',
      detectedAt: new Date(),
      metadata: {
        source: 'scheduled_reconciliation',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: Date.now() - startTime,
      },
    });

    // TODO: Alert on job failure
    // Sentry.captureException(error);

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}