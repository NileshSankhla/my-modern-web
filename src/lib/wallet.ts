import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  walletTransactions,
  walletTypeEnum,
  wallets,
  type walletTransactionTypeEnum,
} from "@/lib/db/schema";

const clampToPaise = (value: number) => Math.max(0, Math.round(value));

const isUniqueConstraintError = (error: unknown) =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && (error as { code?: string }).code === "23505";

const collectErrorText = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.message} ${error.stack ?? ""}`;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error !== "object" || error === null) {
    return String(error);
  }

  const eventLike = error as {
    message?: unknown;
    stack?: unknown;
    type?: unknown;
    error?: unknown;
    cause?: unknown;
  };

  const parts = [
    typeof eventLike.message === "string" ? eventLike.message : "",
    typeof eventLike.stack === "string" ? eventLike.stack : "",
    typeof eventLike.type === "string" ? eventLike.type : "",
  ];

  if (eventLike.error !== undefined) {
    parts.push(collectErrorText(eventLike.error));
  }

  if (eventLike.cause !== undefined) {
    parts.push(collectErrorText(eventLike.cause));
  }

  return parts.filter(Boolean).join(" ");
};

const isTransactionTransportError = (error: unknown) => {
  const details = collectErrorText(error).toLowerCase();

  return (
    details.includes("no transactions support in neon-http driver")
    || details.includes("unexpected server response: 101")
    || details.includes("websocket")
  );
};

const adjustWalletBalanceWithAtomicCte = async (
  params: {
    userId: number;
    adminUserId?: number;
    walletType: WalletType;
    type: (typeof walletTransactionTypeEnum.enumValues)[number];
    amountInPaise: number;
    note?: string;
    sourceClickId?: string;
  },
  walletId: number,
) => {
  const nextBalanceSql =
    params.type === "credit"
      ? sql`${wallets.balanceInPaise} + ${params.amountInPaise}`
      : sql`${wallets.balanceInPaise} - ${params.amountInPaise}`;

  const debitGuardSql =
    params.type === "debit"
      ? sql`and ${wallets.balanceInPaise} >= ${params.amountInPaise}`
      : sql``;

  try {
    const updateAndInsertResult = await db.execute(sql`
      with updated_wallet as (
        update wallets
        set
          balance_in_paise = ${nextBalanceSql},
          updated_at = now()
        where
          id = ${walletId}
          and user_id = ${params.userId}
          and wallet_type = ${params.walletType}
          ${debitGuardSql}
        returning id
      ),
      inserted_transaction as (
        insert into wallet_transactions (
          user_id,
          admin_user_id,
          wallet_type,
          type,
          amount_in_paise,
          note,
          source_click_id
        )
        select
          ${params.userId},
          ${params.adminUserId ?? null},
          ${params.walletType},
          ${params.type},
          ${params.amountInPaise},
          ${params.note ?? null},
          ${params.sourceClickId ?? null}
        from updated_wallet
        returning id
      )
      select id from updated_wallet;
    `);

    if (!updateAndInsertResult.rows || updateAndInsertResult.rows.length === 0) {
      throw new Error("Insufficient wallet balance.");
    }
  } catch (error) {
    if (params.sourceClickId && isUniqueConstraintError(error)) {
      throw new Error("Reward already processed for this click.");
    }
    throw error;
  }

  const [updatedWallet] = await db
    .select()
    .from(wallets)
    .where(
      and(
        eq(wallets.id, walletId),
        eq(wallets.userId, params.userId),
        eq(wallets.walletType, params.walletType),
      ),
    )
    .limit(1);

  if (!updatedWallet) {
    throw new Error("Wallet update committed but refresh failed.");
  }

  return updatedWallet;
};

export type WalletType = (typeof walletTypeEnum.enumValues)[number];
export type WalletDbClient = Pick<
  typeof db,
  "select" | "insert" | "update" | "delete" | "execute"
>;

export const DEFAULT_WALLET_TYPE: WalletType = "cashback";
export const AMAZON_REWARDS_WALLET_TYPE: WalletType = "amazon_rewards";

export const ensureWalletForUser = async (
  userId: number,
  walletType: WalletType = DEFAULT_WALLET_TYPE,
  dbClient: WalletDbClient = db,
) => {
  const [wallet] = await dbClient
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.walletType, walletType)))
    .limit(1);

  if (wallet) {
    return wallet;
  }

  await dbClient
    .insert(wallets)
    .values({ userId, walletType, balanceInPaise: 0 })
    .onConflictDoNothing({ target: [wallets.userId, wallets.walletType] });

  const [ensuredWallet] = await dbClient
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.walletType, walletType)))
    .limit(1);

  if (!ensuredWallet) {
    throw new Error("Failed to create wallet.");
  }

  return ensuredWallet;
};

export const ensureWalletsForUser = async (userId: number, dbClient: WalletDbClient = db) => {
  const [cashbackWallet, amazonRewardsWallet] = await Promise.all([
    ensureWalletForUser(userId, DEFAULT_WALLET_TYPE, dbClient),
    ensureWalletForUser(userId, AMAZON_REWARDS_WALLET_TYPE, dbClient),
  ]);

  return { cashbackWallet, amazonRewardsWallet };
};

export const getWalletBalance = async (
  userId: number,
  walletType: WalletType = DEFAULT_WALLET_TYPE,
  dbClient: WalletDbClient = db,
) => {
  const wallet = await ensureWalletForUser(userId, walletType, dbClient);
  return wallet.balanceInPaise;
};

const applyWalletAdjustment = async (
  dbClient: WalletDbClient,
  params: {
    userId: number;
    adminUserId?: number;
    walletType: WalletType;
    type: (typeof walletTransactionTypeEnum.enumValues)[number];
    amountInPaise: number;
    note?: string;
    sourceClickId?: string;
  },
  walletId: number,
) => {
  const nextBalanceSql =
    params.type === "credit"
      ? sql`${wallets.balanceInPaise} + ${params.amountInPaise}`
      : sql`${wallets.balanceInPaise} - ${params.amountInPaise}`;

  const balanceGuard =
    params.type === "debit"
      ? gte(wallets.balanceInPaise, params.amountInPaise)
      : undefined;

  const [updatedWallet] = await dbClient
    .update(wallets)
    .set({
      balanceInPaise: nextBalanceSql,
      updatedAt: new Date(),
    })
    .where(
      balanceGuard
        ? and(
            eq(wallets.id, walletId),
            eq(wallets.userId, params.userId),
            eq(wallets.walletType, params.walletType),
            balanceGuard,
          )
        : and(
            eq(wallets.id, walletId),
            eq(wallets.userId, params.userId),
            eq(wallets.walletType, params.walletType),
          ),
    )
    .returning();

  if (!updatedWallet) {
    throw new Error("Insufficient wallet balance.");
  }

  try {
    await dbClient.insert(walletTransactions).values({
      userId: params.userId,
      adminUserId: params.adminUserId,
      walletType: params.walletType,
      type: params.type,
      amountInPaise: params.amountInPaise,
      note: params.note,
      sourceClickId: params.sourceClickId,
    });
  } catch (error) {
    if (params.sourceClickId && isUniqueConstraintError(error)) {
      throw new Error("Reward already processed for this click.");
    }
    throw error;
  }

  return updatedWallet;
};

export const adjustWalletBalance = async (
  params: {
    userId: number;
    adminUserId?: number;
    walletType?: WalletType;
    type: (typeof walletTransactionTypeEnum.enumValues)[number];
    amountInPaise: number;
    note?: string;
    sourceClickId?: string;
  },
  dbClient: WalletDbClient = db,
) => {
  const amountInPaise = clampToPaise(params.amountInPaise);
  if (amountInPaise <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const walletType = params.walletType ?? DEFAULT_WALLET_TYPE;
  const wallet = await ensureWalletForUser(params.userId, walletType, dbClient);

  const normalizedParams = {
    ...params,
    walletType,
    amountInPaise,
  };

  if (dbClient !== db) {
    return applyWalletAdjustment(dbClient, normalizedParams, wallet.id);
  }

  try {
    return await db.transaction(async (tx) => {
      return applyWalletAdjustment(tx, normalizedParams, wallet.id);
    });
  } catch (error) {
    if (!isTransactionTransportError(error)) {
      throw error;
    }

    return adjustWalletBalanceWithAtomicCte(
      normalizedParams,
      wallet.id,
    );
  }
};
