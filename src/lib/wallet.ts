/**
 * Fareback Wallet Module
 *
 * Implements append-only ledger with mandatory sequence numbers.
 * All financial mutations go through this module.
 *
 * INVARIANTS:
 * 1. Every wallet_transaction has a non-null wallet_id, sequence_number, balance_after_in_paise
 * 2. sequence_number is monotonically increasing per wallet
 * 3. balance_after_in_paise = previous balance +/- amount_in_paise
 * 4. balance_after_in_paise >= 0 (enforced by DB constraint)
 *
 * CONCURRENCY: Uses SELECT ... FOR UPDATE to prevent race conditions.
 */

import { db } from "./db";
import { walletTransactions, wallets, auditLogs } from "./db/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { Redis } from "@upstash/redis";
import { z } from "zod";

// Constants
export const DEFAULT_WALLET_TYPE = "cashback";
export const AMAZON_REWARDS_WALLET_TYPE = "amazon_rewards";
// Initialize Redis for idempotency
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    })
  : null;

// Constants
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MINIMUM_WITHDRAWAL_PAISE = 100; // ₹1
const MAXIMUM_WITHDRAWAL_PAISE = 5000000; // ₹50,000

// Types
export type WalletType = "cashback" | "amazon_rewards";
export type TransactionType =
  | "CASHBACK"
  | "BONUS"
  | "REFUND"
  | "MANUAL_CREDIT"
  | "REVERSAL_CREDIT"
  | "WITHDRAWAL"
  | "WITHDRAWAL_REVERSAL"
  | "MANUAL_DEBIT"
  | "REVERSAL_DEBIT"
  | "GIFT_CARD_PURCHASE";

interface LedgerEntry {
  id: number;
  walletId: number;
  userId: number;
  transactionType: TransactionType;
  amountInPaise: number;
  balanceAfterInPaise: number;
  sequenceNumber: number;
  sourceReference: string | null;
  sourceType: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface MutationResult {
  success: boolean;
  transaction: LedgerEntry;
  previousBalance: number;
  newBalance: number;
}

interface IdempotencyCheckResult {
  isDuplicate: boolean;
  cachedResponse?: MutationResult;
}

// Zod schemas for validation
export const CreditRequestSchema = z.object({
  userId: z.number().int().positive(),
  walletType: z.enum(["cashback", "amazon_rewards"]),
  amountInPaise: z.number().int().positive(),
  transactionType: z.enum([
    "CASHBACK",
    "BONUS",
    "REFUND",
    "MANUAL_CREDIT",
    "REVERSAL_CREDIT",
    "WITHDRAWAL_REVERSAL",
  ]),
  sourceReference: z.string().nullable().optional(),
  sourceType: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  actorId: z.number().int().positive().nullable().optional(), // For audit - who triggered this
});

export const DebitRequestSchema = z.object({
  userId: z.number().int().positive(),
  walletType: z.enum(["cashback", "amazon_rewards"]),
  amountInPaise: z.number().int().positive(),
  transactionType: z.enum(["WITHDRAWAL", "MANUAL_DEBIT", "REVERSAL_DEBIT", "GIFT_CARD_PURCHASE"]),
  sourceReference: z.string().nullable().optional(),
  sourceType: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  actorId: z.number().int().positive().nullable().optional(),
});

// Helper: Determine if transaction type is a credit
function isCreditType(type: TransactionType): boolean {
  const creditTypes: TransactionType[] = [
    "CASHBACK",
    "BONUS",
    "REFUND",
    "MANUAL_CREDIT",
    "REVERSAL_CREDIT",
  ];
  return creditTypes.includes(type);
}

// Helper: Get and lock existing wallet, or create and lock if new
async function getLockedWallet(
  userId: number,
  walletType: WalletType,
  tx: any,
): Promise<{ id: number; balanceInPaise: number; lastLedgerSequence: number }> {
  let [wallet] = await tx
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.walletType, walletType)))
    .for("update")
    .limit(1);

  if (!wallet) {
    await tx.insert(wallets).values({
      userId,
      walletType,
      balanceInPaise: 0,
      lastLedgerSequence: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();

    [wallet] = await tx
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.walletType, walletType)))
      .for("update")
      .limit(1);
  }

  return {
    id: wallet.id,
    balanceInPaise: wallet.balanceInPaise,
    lastLedgerSequence: wallet.lastLedgerSequence,
  };
}

// Helper: Check idempotency in Redis (non-fatal — DB constraint is primary guard)
async function checkIdempotency(
  idempotencyKey: string | null | undefined,
): Promise<IdempotencyCheckResult> {
  if (!idempotencyKey || !redis) return { isDuplicate: false };

  try {
    const redisKey = `idempotency:${idempotencyKey}`;
    const cached = await redis!.get(redisKey);

    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached as any;
      if (parsed.status === "complete") {
        return {
          isDuplicate: true,
          cachedResponse: parsed.response as MutationResult,
        };
      }
      if (parsed.status === "processing") {
        throw new IdempotencyConflictError(idempotencyKey);
      }
    }
  } catch (err) {
    if (err instanceof IdempotencyConflictError) throw err;
    // Redis unavailable — fall through, DB unique constraint is the safety net
    console.warn("[wallet] Redis idempotency check failed (non-fatal):", (err as Error).message);
  }

  return { isDuplicate: false };
}

// Helper: Mark idempotency as processing (non-fatal)
async function markIdempotencyProcessing(
  idempotencyKey: string,
): Promise<void> {
  try {
    const redisKey = `idempotency:${idempotencyKey}`;
    const setResult = await redis!.set(
      redisKey,
      JSON.stringify({
        status: "processing",
        startedAt: new Date().toISOString(),
      }),
      { nx: true, ex: IDEMPOTENCY_TTL_SECONDS },
    );

    if (!setResult) {
      throw new IdempotencyConflictError(idempotencyKey);
    }
  } catch (err) {
    if (err instanceof IdempotencyConflictError) throw err;
    // Redis unavailable — non-fatal, DB unique constraint guards against duplicates
    console.warn("[wallet] Redis markIdempotencyProcessing failed (non-fatal):", (err as Error).message);
  }
}

// Helper: Complete idempotency with response (non-fatal)
async function completeIdempotency(
  idempotencyKey: string,
  response: MutationResult,
): Promise<void> {
  try {
    const redisKey = `idempotency:${idempotencyKey}`;
    await redis!.set(
      redisKey,
      JSON.stringify({
        status: "complete",
        response,
        completedAt: new Date().toISOString(),
      }),
      { ex: IDEMPOTENCY_TTL_SECONDS },
    );
  } catch (err) {
    // Non-fatal — DB is the source of truth
    console.warn("[wallet] Redis completeIdempotency failed (non-fatal):", (err as Error).message);
  }
}

// Helper: Clear idempotency on failure (allow retry) — non-fatal
async function clearIdempotency(idempotencyKey: string): Promise<void> {
  try {
    const redisKey = `idempotency:${idempotencyKey}`;
    await redis!.del(redisKey);
  } catch (err) {
    console.warn("[wallet] Redis clearIdempotency failed (non-fatal):", (err as Error).message);
  }
}

// Custom Errors
export class InsufficientFundsError extends Error {
  constructor(
    public readonly requestedAmount: number,
    public readonly availableBalance: number,
  ) {
    super(
      `Insufficient funds: requested ${requestedAmount} paise, available ${availableBalance} paise`,
    );
    this.name = "InsufficientFundsError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super(
      `Idempotency conflict: request with key ${idempotencyKey} is already being processed`,
    );
    this.name = "IdempotencyConflictError";
  }
}

export class WalletNotFoundError extends Error {
  constructor(
    public readonly userId: number,
    public readonly walletType: WalletType,
  ) {
    super(`Wallet not found for user ${userId} of type ${walletType}`);
    this.name = "WalletNotFoundError";
  }
}

export class InvalidAmountError extends Error {
  constructor(
    public readonly amount: number,
    public readonly reason: string,
  ) {
    super(`Invalid amount ${amount}: ${reason}`);
    this.name = "InvalidAmountError";
  }
}

/**
 * Core mutation function - handles both credits and debits
 *
 * This is the ONLY function that should modify wallet state.
 * All other wallet operations must go through this.
 */
async function executeMutation(
  params: {
    userId: number;
    walletType: WalletType;
    amountInPaise: number;
    transactionType: TransactionType;
    sourceReference: string | null;
    sourceType: string | null;
    idempotencyKey: string | null;
    metadata: Record<string, unknown> | null;
    actorId: number | null;
    ipAddress?: string;
    userAgent?: string;
  },
  isCredit: boolean,
): Promise<MutationResult> {
  // Validate amount
  if (params.amountInPaise <= 0) {
    throw new InvalidAmountError(params.amountInPaise, "must be positive");
  }

  // Idempotency check
  const idempotencyResult = await checkIdempotency(params.idempotencyKey);
  if (idempotencyResult.isDuplicate && idempotencyResult.cachedResponse) {
    return idempotencyResult.cachedResponse;
  }

  // Mark as processing
  if (params.idempotencyKey) {
    await markIdempotencyProcessing(params.idempotencyKey);
  }

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Get and lock the wallet in a single query (FOR UPDATE prevents concurrent modifications)
      const wallet = await getLockedWallet(
        params.userId,
        params.walletType,
        tx,
      );

      const currentBalance = wallet.balanceInPaise;

      // 2. For debits, verify sufficient funds
      if (!isCredit) {
        if (currentBalance < params.amountInPaise) {
          throw new InsufficientFundsError(
            params.amountInPaise,
            currentBalance,
          );
        }
      }

      // 3. Calculate new balance
      const newBalance = isCredit
        ? currentBalance + params.amountInPaise
        : currentBalance - params.amountInPaise;

      // 4. Get next sequence number from locked wallet state
      const sequenceNumber = wallet.lastLedgerSequence + 1;

      // 5. Create the ledger entry
      let sourceClickId: string | null = null;
      if (params.sourceType === "click" && params.sourceReference) {
        sourceClickId = params.sourceReference;
      }
      
      const adminUserId = params.actorId !== params.userId ? params.actorId : null;

      const [insertedTx] = await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        userId: params.userId,
        walletType: params.walletType,
        type: isCredit ? "credit" : "debit",
        amountInPaise: params.amountInPaise,
        balanceAfterInPaise: newBalance,
        sequenceNumber,
        note: params.sourceReference,
        internalNote: params.transactionType,
        sourceClickId,
        adminUserId,
        idempotencyKey: params.idempotencyKey,
      }).returning({ id: walletTransactions.id });

      const transactionId = insertedTx.id;

      const ledgerEntry: LedgerEntry = {
        id: transactionId,
        walletId: wallet.id,
        userId: params.userId,
        transactionType: params.transactionType,
        amountInPaise: params.amountInPaise,
        balanceAfterInPaise: newBalance,
        sequenceNumber,
        sourceReference: params.sourceReference,
        sourceType: params.sourceType,
        idempotencyKey: params.idempotencyKey,
        metadata: params.metadata,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      };

      // 6. Update the wallet cache
      await tx
        .update(wallets)
        .set({
          balanceInPaise: newBalance,
          lastLedgerSequence: sequenceNumber,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      // 7. Write synchronous audit log
      await tx.insert(auditLogs).values({
        actorId: params.actorId ?? params.userId,
        actionType: `WALLET_${params.transactionType}`,
        entityType: "wallet_transactions",
        entityId: transactionId.toString(),
        metadata: {
          walletId: wallet.id,
          walletType: params.walletType,
          amountInPaise: params.amountInPaise,
          previousBalance: currentBalance,
          newBalance,
          sequenceNumber,
          sourceReference: params.sourceReference,
          sourceType: params.sourceType,
          idempotencyKey: params.idempotencyKey,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });

      return {
        success: true,
        transaction: ledgerEntry,
        previousBalance: currentBalance,
        newBalance,
      };
    });

    // Complete idempotency
    if (params.idempotencyKey) {
      await completeIdempotency(params.idempotencyKey, result);
    }

    return result;
  } catch (error) {
    // Clear idempotency on failure to allow retry
    if (params.idempotencyKey) {
      await clearIdempotency(params.idempotencyKey);
    }
    throw error;
  }
}

/**
 * Credit funds to a wallet
 */
export async function creditWallet(
  params: z.infer<typeof CreditRequestSchema> & {
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<MutationResult> {
  const validated = CreditRequestSchema.parse(params);
  return executeMutation(
    {
      ...validated,
      sourceReference: validated.sourceReference ?? null,
      sourceType: validated.sourceType ?? null,
      idempotencyKey: validated.idempotencyKey ?? null,
      metadata: validated.metadata ?? null,
      actorId: validated.actorId ?? null,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
    true,
  );
}

/**
 * Debit funds from a wallet
 */
export async function debitWallet(
  params: z.infer<typeof DebitRequestSchema> & {
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<MutationResult> {
  const validated = DebitRequestSchema.parse(params);

  // Additional validation for debits
  if (validated.transactionType === "WITHDRAWAL") {
    if (validated.amountInPaise < MINIMUM_WITHDRAWAL_PAISE) {
      throw new InvalidAmountError(
        validated.amountInPaise,
        `minimum withdrawal is ${MINIMUM_WITHDRAWAL_PAISE} paise (₹${MINIMUM_WITHDRAWAL_PAISE / 100})`,
      );
    }
    if (validated.amountInPaise > MAXIMUM_WITHDRAWAL_PAISE) {
      throw new InvalidAmountError(
        validated.amountInPaise,
        `maximum withdrawal is ${MAXIMUM_WITHDRAWAL_PAISE} paise (₹${MAXIMUM_WITHDRAWAL_PAISE / 100})`,
      );
    }
  }

  return executeMutation(
    {
      ...validated,
      sourceReference: validated.sourceReference ?? null,
      sourceType: validated.sourceType ?? null,
      idempotencyKey: validated.idempotencyKey ?? null,
      metadata: validated.metadata ?? null,
      actorId: validated.actorId ?? null,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
    false,
  );
}

/**
 * Get wallet balance (read-only)
 */
export async function getWalletBalance(
  userId: number,
  walletType: WalletType,
): Promise<{ balanceInPaise: number; walletId: number }> {
  const result = await db
    .select({
      id: wallets.id,
      balanceInPaise: wallets.balanceInPaise,
    })
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.walletType, walletType)))
    .limit(1);

  if (result.length === 0) {
    return { balanceInPaise: 0, walletId: 0 };
  }

  // Enterprise-grade: verify with latest ledger entry
  const [latestTx] = await db
    .select({ balanceAfterInPaise: walletTransactions.balanceAfterInPaise })
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, result[0].id))
    .orderBy(desc(walletTransactions.sequenceNumber))
    .limit(1);

  const realBalance = latestTx ? latestTx.balanceAfterInPaise : 0;

  return {
    balanceInPaise: realBalance,
    walletId: result[0].id,
  };
}

/**
 * Get transaction history for a wallet
 */
export async function getTransactionHistory(
  userId: number,
  walletType: WalletType,
  options?: {
    limit?: number;
    offset?: number;
    beforeSequence?: number;
  },
): Promise<{
  transactions: LedgerEntry[];
  hasMore: boolean;
  total: number;
}> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  // Get wallet ID first
  const walletResult = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.walletType, walletType)))
    .limit(1);

  if (walletResult.length === 0) {
    return { transactions: [], hasMore: false, total: 0 };
  }

  const walletId = walletResult[0].id;

  // Build query conditions
  const conditions: any[] = [eq(walletTransactions.walletId, walletId)];
  if (options?.beforeSequence) {
    conditions.push(
      sql`${walletTransactions.sequenceNumber} < ${options.beforeSequence}`,
    );
  }

  // Get transactions (newest first)
  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(and(...conditions))
    .orderBy(desc(walletTransactions.sequenceNumber))
    .limit(limit + 1) // Fetch one extra to check hasMore
    .offset(offset);

  const hasMore = transactions.length > limit;
  const returnedTransactions = transactions.slice(0, limit);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, walletId));

  const mappedTransactions: LedgerEntry[] = returnedTransactions.map((t) => ({
    id: t.id,
    walletId: t.walletId!,
    userId: t.userId,
    transactionType: (t.internalNote as any) || (t.type === "credit" ? "MANUAL_CREDIT" : "WITHDRAWAL"),
    amountInPaise: t.amountInPaise,
    balanceAfterInPaise: t.balanceAfterInPaise!,
    sequenceNumber: t.sequenceNumber!,
    sourceReference: t.note,
    sourceType: t.sourceClickId ? "click" : null,
    idempotencyKey: null,
    metadata: null,
    ipAddress: null,
    userAgent: null,
  }));

  return {
    transactions: mappedTransactions,
    hasMore,
    total: Number(countResult[0].count),
  };
}

// Re-export types
export type { LedgerEntry, MutationResult };

/**
 * Ensure a wallet exists for a user for a given type.
 * Creates it if it doesn't exist.
 */
export async function ensureWalletForUser(
  userId: number,
  walletType: WalletType,
): Promise<{ id: number; balanceInPaise: number }> {
  const [existing] = await db
    .select({ id: wallets.id, balanceInPaise: wallets.balanceInPaise })
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.walletType, walletType)))
    .limit(1);

  if (existing) {
    return existing;
  }

  await db.insert(wallets).values({
    userId,
    walletType,
    balanceInPaise: 0,
    lastLedgerSequence: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing();

  const [wallet] = await db
    .select({ id: wallets.id, balanceInPaise: wallets.balanceInPaise })
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.walletType, walletType)))
    .limit(1);

  return wallet;
}

export const ensureWalletsForUser = async (userId: number) => {
  const [cashbackWallet, amazonRewardsWallet] = await Promise.all([
    ensureWalletForUser(userId, DEFAULT_WALLET_TYPE),
    ensureWalletForUser(userId, AMAZON_REWARDS_WALLET_TYPE),
  ]);

  return { cashbackWallet, amazonRewardsWallet };
};

/**
 * Adjusts a wallet balance by crediting or debiting funds.
 * This is a high-level wrapper around `creditWallet` and `debitWallet`.
 */
export async function adjustWalletBalance(
  params: {
    userId: number;
    adminUserId?: number;
    walletType: WalletType;
    type: "credit" | "debit";
    amountInPaise: number;
    note?: string;
    sourceClickId?: string;
  },
  tx?: any,
): Promise<MutationResult> {
  const commonParams = {
    userId: params.userId,
    walletType: params.walletType,
    amountInPaise: params.amountInPaise,
    sourceReference: params.note || null,
    sourceType: params.sourceClickId ? "click" : "manual",
    actorId: params.adminUserId || params.userId,
  };

  if (params.type === "credit") {
    return creditWallet(
      {
        ...commonParams,
        transactionType: "MANUAL_CREDIT",
      },
    );
  } else {
    return debitWallet(
      {
        ...commonParams,
        transactionType: "MANUAL_DEBIT",
      },
    );
  }
}
