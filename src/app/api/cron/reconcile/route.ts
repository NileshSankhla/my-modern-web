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

import { timingSafeEqual } from 'node:crypto';

const redis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
})();

// Verify Vercel Cron authorization
function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader) {
    if (!cronSecret) console.error('CRON_SECRET not configured');
    return false;
  }

  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
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
    // If Redis is unavailable, skip the lock (degraded mode — reconciliation still runs)
    const hourKey = new Date().toISOString().substring(0, 13); // e.g. "2024-03-15T14"
    const lockKey = `cron_lock:reconcile:${hourKey}`;
    if (redis) {
      const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 300 });
      if (!acquired) {
        console.log('Cron skipped: Lock already held by another instance.');
        return NextResponse.json({ status: 'skipped', reason: 'already_running_or_completed' });
      }
    } else {
      console.warn('[cron/reconcile] Redis unavailable — running without distributed lock (degraded mode)');
    }

    // Run the reconciliation query
    // This compares each wallet's cached balance against the sum of its ledger entries
    const reconciliationQuery = sql`
      WITH ledger_sums AS (
        SELECT 
          wt.wallet_id,
          SUM(
            CASE 
              WHEN wt.type = 'credit' 
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
    // Neon returns snake_case column names from raw SQL — map to camelCase
    mismatchesFound = (results.rows as any[]).map((row) => ({
      walletId: row.wallet_id ?? row.walletId,
      userId: row.user_id ?? row.userId,
      walletType: row.wallet_type ?? row.walletType,
      cachedBalance: row.cached_balance ?? row.cachedBalance,
      ledgerBalance: row.ledger_balance ?? row.ledgerBalance,
      difference: (row.cached_balance ?? row.cachedBalance) - (row.ledger_balance ?? row.ledgerBalance),
    }));

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