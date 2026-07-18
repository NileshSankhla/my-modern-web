"use server";

import { and, eq, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { headers } from "next/headers";
import { requireFinanceManager } from "@/lib/admin";
import { rateLimit, buildRateLimitKey, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIP } from "@/lib/security/fingerprint";
import { requireUser } from "@/lib/auth";
import { encryptField, hashForComparison } from "@/lib/security/encryption";
import { checkWithdrawalFraud, checkGiftCardFraud } from "@/lib/security/fraud-detection";
import { db } from "@/lib/db";
import {
  amazonGiftCardRequests,
  auditLogs,
  clicks,
  merchants,
  users,
  wallets,
  walletTransactions,
  withdrawalRequests,
} from "@/lib/db/schema";
import {
  AMAZON_REWARDS_WALLET_TYPE,
  DEFAULT_WALLET_TYPE,
  creditWallet,
  debitWallet,
} from "@/lib/wallet";
import {
  adminAmazonGiftCardDecisionSchema,
  adminApproveClickSchema,
  adminDeleteClickSchema,
  adminTrackedClickSchema,
  adminWithdrawalDecisionSchema,
  amazonGiftCardRequestSchema,
  walletAdjustmentSchema,
  withdrawalRequestSchema,
} from "@/lib/security/validation";

interface WalletActionState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

const getString = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value : "";

const parseRupeesToPaise = (value: string) => {
  const amountStr = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(amountStr)) {
    return 0; // Return 0 so it fails the <= 0 validation naturally
  }
  const parts = amountStr.split(".");
  const rupees = parseInt(parts[0] || "0", 10) * 100;
  const paiseStr = (parts[1] || "00").substring(0, 2).padEnd(2, "0");
  const paise = parseInt(paiseStr, 10);
  return rupees + paise;
};

const isUniqueConstraintError = (error: unknown) =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && (error as { code?: string }).code === "23505";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const eventLike = error as { message?: unknown; error?: unknown; cause?: unknown };
    if (typeof eventLike.message === "string" && eventLike.message.length > 0) {
      return eventLike.message;
    }
  }
  return "Failed to update wallet. Please try again.";
};

export const createWithdrawalRequestAction = async (
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> => {
  try {
    const user = await requireUser();

    // Rate limit
    const reqHeaders = await headers();
    const ip = reqHeaders.get("x-forwarded-for") ?? "127.0.0.1";
    const rlKey = buildRateLimitKey("API_WITHDRAWAL", RATE_LIMITS.API_WITHDRAWAL, {
      userId: user.id,
      ip,
    });
    const rl = await rateLimit(rlKey, RATE_LIMITS.API_WITHDRAWAL);
    if (!rl.success) {
      return { error: "Too many withdrawal requests. Try again later." };
    }

    const payload = {
      upiId: getString(formData.get("upiId")),
      amount: getString(formData.get("amount")),
    };

    const validation = withdrawalRequestSchema.safeParse(payload);
    if (!validation.success) {
      return {
        error: "Please correct the highlighted fields.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    const amountInPaise = parseRupeesToPaise(validation.data.amount);

    if (amountInPaise <= 0) {
      return { error: "Withdrawal amount must be greater than zero." };
    }

    const fraudCheck = await checkWithdrawalFraud(user.id, amountInPaise, validation.data.upiId);
    if (!fraudCheck.allowed) {
      return { error: "Withdrawal blocked due to unusual activity. Please contact support." };
    }

    const upiIdEncrypted = encryptField(validation.data.upiId.toLowerCase())!;
    const upiIdHash = hashForComparison(validation.data.upiId.toLowerCase());

    // Step 1: Insert pending request
    let request;
    try {
      [request] = await db
        .insert(withdrawalRequests)
        .values({
          userId: user.id,
          upiIdEncrypted,
          upiIdHash,
          amountInPaise,
        status: "pending",
      }).returning();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { error: "You already have a pending withdrawal request." };
      }
      throw error;
    }

    // Step 2: Attempt debit
    try {
      await debitWallet({
        userId: user.id,
        walletType: DEFAULT_WALLET_TYPE,
        amountInPaise,
        transactionType: "WITHDRAWAL",
        sourceReference: request.id.toString(),
        idempotencyKey: `withdrawal_debit_${request.id}`,
      });
    } catch (err) {
      // Debit failed (e.g. insufficient funds), rollback request
      await db.update(withdrawalRequests).set({ status: "rejected", adminNote: "Insufficient funds at time of processing" }).where(eq(withdrawalRequests.id, request.id));
      return { error: getErrorMessage(err) };
    }

    revalidatePath("/dashboard");
    revalidatePath("/admin");

    return { success: "Withdrawal request submitted successfully." };
  } catch (error) {
    console.error("Create withdrawal request error:", error);
    return { error: "Failed to submit withdrawal request. Please try again." };
  }
};

export const createAmazonGiftCardRequestAction = async (
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> => {
  try {
    const user = await requireUser();

    // Rate limit
    const reqHeaders = await headers();
    const ip = reqHeaders.get("x-forwarded-for") ?? "127.0.0.1";
    const rlKey = buildRateLimitKey("API_GIFT_CARD", RATE_LIMITS.API_GIFT_CARD, {
      userId: user.id,
      ip,
    });
    const rl = await rateLimit(rlKey, RATE_LIMITS.API_GIFT_CARD);
    if (!rl.success) {
      return { error: "Too many gift card requests. Try again later." };
    }

    const payload = {
      amount: getString(formData.get("amount")),
    };

    const validation = amazonGiftCardRequestSchema.safeParse(payload);
    if (!validation.success) {
      return {
        error: "Please correct the highlighted fields.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    const amountInPaise = parseRupeesToPaise(validation.data.amount);

    if (amountInPaise <= 0) {
      return { error: "Gift card conversion amount must be greater than zero." };
    }

    const fraudCheck = await checkGiftCardFraud(user.id, amountInPaise);
    if (!fraudCheck.allowed) {
      return { error: "Gift card conversion blocked due to unusual activity. Please contact support." };
    }

    // Insert pending request (unique constraint on DB enforces only one pending request per user)
    let request;
    try {
      [request] = await db.insert(amazonGiftCardRequests).values({
        userId: user.id,
        amountInPaise,
        status: "pending",
      }).returning();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { error: "You already have a pending Amazon gift card request." };
      }
      throw error;
    }

    // Step 2: Debit wallet
    try {
      await debitWallet({
        userId: user.id,
        walletType: AMAZON_REWARDS_WALLET_TYPE,
        amountInPaise,
        transactionType: "GIFT_CARD_PURCHASE",
        sourceReference: request.id.toString(),
        idempotencyKey: `gift_card_debit_${request.id}`,
      });
    } catch (err) {
      await db.update(amazonGiftCardRequests).set({ status: "rejected", adminNote: "Insufficient funds at time of processing" }).where(eq(amazonGiftCardRequests.id, request.id));
      return { error: getErrorMessage(err) };
    }

    revalidatePath("/dashboard");
    revalidatePath("/admin");

    return { success: "Amazon gift card request submitted successfully." };
  } catch (error) {
    console.error("Create Amazon gift card request error:", error);
    return { error: "Failed to submit Amazon gift card request. Please try again." };
  }
};

export const adminAdjustWalletAction = async (
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> => {
  try {
    const admin = await requireFinanceManager();

    const payload = {
      userEmail: getString(formData.get("userEmail")).trim().toLowerCase(),
      walletType: getString(formData.get("walletType")),
      type: getString(formData.get("type")),
      amount: getString(formData.get("amount")).trim(),
      idempotencyKey: getString(formData.get("idempotencyKey")),
    };

    const validation = walletAdjustmentSchema.safeParse(payload);
    if (!validation.success) {
      return {
        error: "Please correct the highlighted fields.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    if (!validation.data.idempotencyKey) {
      return { error: "Missing idempotency key for secure transaction processing." };
    }

    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(ilike(users.email, validation.data.userEmail))
      .limit(1);

    if (!targetUser) {
      return { error: "User not found for this email." };
    }

    const amountInPaise = parseRupeesToPaise(validation.data.amount);

    if (amountInPaise <= 0) {
      return { error: "Amount must be greater than zero." };
    }

    if (validation.data.type === "credit") {
      await creditWallet({
        userId: targetUser.id,
        actorId: admin.id,
        walletType: validation.data.walletType as any,
        amountInPaise,
        transactionType: "MANUAL_CREDIT",
        sourceReference: `Manual credit adjustment by ${admin.email}`,
        idempotencyKey: validation.data.idempotencyKey,
      });
    } else {
      await debitWallet({
        userId: targetUser.id,
        actorId: admin.id,
        walletType: validation.data.walletType as any,
        amountInPaise,
        transactionType: "MANUAL_DEBIT",
        sourceReference: `Manual debit adjustment by ${admin.email}`,
        idempotencyKey: validation.data.idempotencyKey,
      });
    }

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    revalidatePath("/finance");
    revalidatePath("/");

    return { success: `Wallet updated successfully. ${validation.data.type === "credit" ? "+" : "-"}${validation.data.amount} ${validation.data.walletType === "cashback" ? "Cashback" : "Amazon Rewards"}.` };
  } catch (error) {
    console.error("Admin wallet adjust error:", { message: getErrorMessage(error) });
    return {
      error: getErrorMessage(error),
    };
  }
};

export const adminProcessAmazonGiftCardRequestAction = async (
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> => {
  try {
    const admin = await requireFinanceManager();

    const payload = {
      requestId: getString(formData.get("requestId")),
      decision: getString(formData.get("decision")),
      note: getString(formData.get("note")).trim(),
      giftCardCode: getString(formData.get("giftCardCode")).trim(),
    };

    const validation = adminAmazonGiftCardDecisionSchema.safeParse(payload);
    if (!validation.success) {
      return {
        error: "Please correct the highlighted fields.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    const requestId = Number(validation.data.requestId);

    const [request] = await db
      .select()
      .from(amazonGiftCardRequests)
      .where(eq(amazonGiftCardRequests.id, requestId))
      .limit(1);

    if (!request) {
      return { error: "Amazon gift card request not found." };
    }

    if (validation.data.decision === "approve" && request.status !== "pending") {
      return { error: "Only pending requests can be approved." };
    }

    if (validation.data.decision === "reject" && request.status !== "pending") {
      return { error: "Only pending requests can be rejected." };
    }

    if (validation.data.decision === "fulfill" && request.status !== "approved" && request.status !== "pending") {
      return { error: "Only pending or approved requests can be marked as fulfilled." };
    }

    // Verify the original debit actually exists! (Prevents crash exploit)
    if (validation.data.decision === "approve" || validation.data.decision === "reject" || validation.data.decision === "fulfill") {
      const [originalDebit] = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.note, request.id.toString()))
        .limit(1);

      if (!originalDebit) {
        await db
          .update(amazonGiftCardRequests)
          .set({
            status: "rejected",
            adminNote: "System Auto-Reject: Ledger debit missing due to processing error.",
            processedByAdminId: admin.id,
            processedAt: new Date(),
          })
          .where(and(eq(amazonGiftCardRequests.id, request.id), eq(amazonGiftCardRequests.status, request.status)));
        return { error: "Invalid request. Funds were never deducted. Auto-rejected." };
      }
    }

    if (validation.data.decision === "reject" || validation.data.decision === "approve") {
      // Optimistic Concurrency Update (Prevents double refunds)
      const [updatedRequest] = await db
        .update(amazonGiftCardRequests)
        .set({
          status: validation.data.decision === "approve" ? "approved" : "rejected",
          adminNote: validation.data.note || null,
          processedByAdminId: admin.id,
          processedAt: new Date(),
        })
        .where(and(eq(amazonGiftCardRequests.id, request.id), eq(amazonGiftCardRequests.status, "pending")))
        .returning();

      if (!updatedRequest) {
        return { error: "Request was already processed." };
      }

      if (validation.data.decision === "reject") {
        await creditWallet({
          userId: updatedRequest.userId,
          actorId: admin.id,
          walletType: AMAZON_REWARDS_WALLET_TYPE,
          amountInPaise: updatedRequest.amountInPaise,
          transactionType: "REFUND",
          sourceReference: `Rejected Amazon gift card request #${updatedRequest.id}`,
          idempotencyKey: `giftcard_reject_${updatedRequest.id}`,
        });
      }

      revalidatePath("/admin");
      revalidatePath("/finance");
      revalidatePath("/dashboard");
      return { success: `Gift card request ${validation.data.decision === "approve" ? "approved" : "rejected and refunded"}.` };
    }

    if (!validation.data.giftCardCode?.trim()) {
      return { error: "Gift card code is required to fulfill a request." };
    }

    const [updated] = await db
      .update(amazonGiftCardRequests)
      .set({
        status: "fulfilled",
        giftCardCode: null,
        giftCardCodeEncrypted: encryptField(validation.data.giftCardCode || null),
        adminNote: validation.data.note || null,
        processedByAdminId: admin.id,
        processedAt: new Date(),
      })
      .where(and(eq(amazonGiftCardRequests.id, request.id), eq(amazonGiftCardRequests.status, request.status)))
      .returning();

    if (!updated) {
      return { error: "Request was already processed." };
    }

    revalidatePath("/admin");
    revalidatePath("/finance");
    revalidatePath("/dashboard");
    return { success: "Gift card marked as fulfilled." };
  } catch (error) {
    console.error("Admin process Amazon gift card request error:", error);
    return { error: "Failed to process Amazon gift card request." };
  }
};

export const adminProcessAmazonGiftCardRequestFormAction = async (formData: FormData) => {
  return await adminProcessAmazonGiftCardRequestAction({}, formData);
};

const adminProcessWithdrawalAction = async (
  _prevState: WalletActionState,
  formData: FormData,
): Promise<WalletActionState> => {
  try {
    const admin = await requireFinanceManager();

    const payload = {
      requestId: getString(formData.get("requestId")),
      decision: getString(formData.get("decision")),
      note: getString(formData.get("note")).trim(),
    };

    const validation = adminWithdrawalDecisionSchema.safeParse(payload);
    if (!validation.success) {
      return {
        error: "Please correct the highlighted fields.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    const requestId = Number(validation.data.requestId);

    const [request] = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, requestId))
      .limit(1);

    if (!request) {
      return { error: "Withdrawal request not found." };
    }

    if (validation.data.decision === "approve" && request.status !== "pending") {
      return { error: "Only pending requests can be approved." };
    }

    if (validation.data.decision === "reject" && request.status !== "pending") {
      return { error: "Only pending requests can be rejected." };
    }

    if (validation.data.decision === "mark-paid" && request.status !== "approved") {
      return { error: "Only approved requests can be marked as paid." };
    }

    // Verify the original debit actually exists! (Prevents crash exploit)
    if (validation.data.decision === "approve" || validation.data.decision === "reject" || validation.data.decision === "mark-paid") {
      const [originalDebit] = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.note, request.id.toString()))
        .limit(1);

      if (!originalDebit) {
        // Free money exploit prevented! The original debit never happened.
        await db
          .update(withdrawalRequests)
          .set({
            status: "rejected",
            adminNote: "System Auto-Reject: Ledger debit missing due to processing error.",
            processedByAdminId: admin.id,
            processedAt: new Date(),
          })
          .where(and(eq(withdrawalRequests.id, request.id), eq(withdrawalRequests.status, request.status)));
        return { error: "Invalid request. Funds were never deducted. Auto-rejected." };
      }
    }

    if (validation.data.decision === "reject" || validation.data.decision === "approve") {
      // Optimistic Concurrency Update (Prevents double refunds)
      const [updatedRequest] = await db
        .update(withdrawalRequests)
        .set({
          status: validation.data.decision === "approve" ? "approved" : "rejected",
          adminNote: validation.data.note || null,
          processedByAdminId: admin.id,
          processedAt: new Date(),
        })
        .where(and(eq(withdrawalRequests.id, request.id), eq(withdrawalRequests.status, "pending")))
        .returning();

      if (!updatedRequest) {
        return { error: "Request was already processed." };
      }

      if (validation.data.decision === "reject") {
        // Money was deducted during request, must refund
        await creditWallet({
          userId: updatedRequest.userId,
          actorId: admin.id,
          walletType: DEFAULT_WALLET_TYPE,
          amountInPaise: updatedRequest.amountInPaise,
          transactionType: "WITHDRAWAL_REVERSAL",
          sourceReference: `Rejected withdrawal request #${updatedRequest.id}`,
          idempotencyKey: `withdrawal_reject_${updatedRequest.id}`,
        });
      }

      revalidatePath("/admin");
      revalidatePath("/finance");
      revalidatePath("/dashboard");
      return { success: `Withdrawal request ${validation.data.decision === "approve" ? "approved" : "rejected and refunded"}.` };
    }

    const [updated] = await db
      .update(withdrawalRequests)
      .set({
        status: "paid",
        adminNote: validation.data.note || null,
        processedByAdminId: admin.id,
        processedAt: new Date(),
      })
      .where(and(eq(withdrawalRequests.id, request.id), eq(withdrawalRequests.status, request.status)))
      .returning();

    if (!updated) {
      return { error: "Request was already processed." };
    }

    revalidatePath("/admin");
    revalidatePath("/finance");
    revalidatePath("/dashboard");
    return { success: "Withdrawal marked as paid." };
  } catch (error) {
    console.error("Admin process withdrawal error:", error);
    return { error: "Failed to process withdrawal request." };
  }
};

export const adminProcessWithdrawalFormAction = async (formData: FormData) => {
  return await adminProcessWithdrawalAction({}, formData);
};

export const adminMarkClickTrackedFormAction = async (formData: FormData) => {
  try {
    const admin = await requireFinanceManager();

    const payload = {
      clickId: getString(formData.get("clickId")),
    };

    const validation = adminTrackedClickSchema.safeParse(payload);
    if (!validation.success) {
      return;
    }

    const [click] = await db
      .select()
      .from(clicks)
      .where(eq(clicks.id, validation.data.clickId))
      .limit(1);

    if (!click || click.trackingStatus === "approved" || click.trackingStatus === "deleted") {
      return;
    }

    const expectedRewardStr = getString(formData.get("expectedReward")).trim();
    const expectedRewardPaise = expectedRewardStr
      ? parseRupeesToPaise(expectedRewardStr)
      : 0;

    if (expectedRewardPaise <= 0) {
      console.warn("[finance] expectedReward is required to mark as tracked");
      return;
    }

    await db
      .update(clicks)
      .set({
        trackingStatus: "tracked",
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
        rewardAmountInPaise: expectedRewardPaise,
      })
      .where(eq(clicks.id, click.id));

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/finance");
    revalidatePath("/earnings");
  } catch (error) {
    console.error("Admin mark click tracked error:", error);
  }
};

export const adminUndoTrackedClickFormAction = async (formData: FormData) => {
  try {
    await requireFinanceManager();

    const payload = {
      clickId: getString(formData.get("clickId")),
    };

    const validation = adminTrackedClickSchema.safeParse(payload);
    if (!validation.success) {
      return;
    }

    const [click] = await db
      .select()
      .from(clicks)
      .where(eq(clicks.id, validation.data.clickId))
      .limit(1);

    if (!click || (click.trackingStatus !== "tracked" && click.trackingStatus !== "deleted")) {
      return;
    }

    await db
      .update(clicks)
      .set({
        trackingStatus: "unreviewed",
        rewardAmountInPaise: 0,
        reviewedByAdminId: null,
        reviewedAt: null,
      })
      .where(eq(clicks.id, click.id));

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/finance");
  } catch (error) {
    console.error("Admin undo tracked click error:", error);
  }
};

export const adminApproveClickFormAction = async (formData: FormData) => {
  try {
    const admin = await requireFinanceManager();

    const payload = {
      clickId: getString(formData.get("clickId")),
      amount: getString(formData.get("amount")),
      walletType: getString(formData.get("walletType")) || undefined,
    };

    const validation = adminApproveClickSchema.safeParse(payload);
    if (!validation.success) {
      console.error("[finance] adminApproveClickFormAction: validation failed:", validation.error.flatten());
      return;
    }

    const amountInPaise = parseRupeesToPaise(validation.data.amount);

    if (amountInPaise <= 0) {
      console.error("[finance] adminApproveClickFormAction: amount is zero or negative:", amountInPaise);
      return;
    }

    const [clickWithMerchant] = await db
      .select({
        click: clicks,
        merchantName: merchants.name,
      })
      .from(clicks)
      .leftJoin(merchants, eq(merchants.id, clicks.merchantId))
      .where(eq(clicks.id, validation.data.clickId))
      .limit(1);

    const click = clickWithMerchant?.click;

    if (!click) {
      console.error("[finance] adminApproveClickFormAction: click not found:", validation.data.clickId);
      return;
    }

    if (click.trackingStatus === "approved") {
      console.warn("[finance] adminApproveClickFormAction: click already approved:", click.id);
      return;
    }

    if (click.userId === admin.id) {
      console.error("[finance] adminApproveClickFormAction: self-dealing prevented for admin:", admin.id);
      return;
    }

    if (click.trackingStatus === "deleted") {
      console.error("[finance] adminApproveClickFormAction: click is deleted, cannot approve:", click.id);
      return;
    }

    const walletType = (validation.data.walletType as "cashback" | "amazon_rewards" | undefined)
      ?? (clickWithMerchant?.merchantName?.trim().toLowerCase().includes("amazon")
        ? AMAZON_REWARDS_WALLET_TYPE
        : DEFAULT_WALLET_TYPE);

    // ─── ATOMIC OPERATION: Credit wallet + Update click status in one DB transaction ───
    await db.transaction(async (tx) => {
      // 0. Lock the click row to prevent race conditions
      const [currentClick] = await tx
        .select()
        .from(clicks)
        .where(eq(clicks.id, click.id))
        .for("update")
        .limit(1);

      if (!currentClick || currentClick.trackingStatus === "approved" || currentClick.trackingStatus === "deleted") {
        throw new Error(`[finance] Click ${click.id} is already approved or deleted.`);
      }

      // 1. Lock the wallet row (prevents race conditions with concurrent credits/debits)
      let [wallet] = await tx
        .select()
        .from(wallets)
        .where(and(eq(wallets.userId, click.userId), eq(wallets.walletType, walletType)))
        .for("update")
        .limit(1);

      // 2. Create wallet if it doesn't exist yet
      if (!wallet) {
        await tx.insert(wallets).values({
          userId: click.userId,
          walletType,
          balanceInPaise: 0,
          lastLedgerSequence: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).onConflictDoNothing();

        [wallet] = await tx
          .select()
          .from(wallets)
          .where(and(eq(wallets.userId, click.userId), eq(wallets.walletType, walletType)))
          .for("update")
          .limit(1);
      }

      if (!wallet) {
        throw new Error(`[finance] Failed to get or create wallet for user ${click.userId} type ${walletType}`);
      }

      const currentBalance = wallet.balanceInPaise;
      const newBalance = currentBalance + amountInPaise;
      const sequenceNumber = wallet.lastLedgerSequence + 1;
      const adminUserId = admin.id !== click.userId ? admin.id : null;

      // 3. Insert the wallet_transactions ledger entry
      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        userId: click.userId,
        walletType,
        type: "credit",
        amountInPaise,
        balanceAfterInPaise: newBalance,
        sequenceNumber,
        note: `Cashback reward for click ${click.id}`,
        sourceClickId: click.id,
        adminUserId,
      });

      // 4. Update wallet balance cache (atomic with the ledger entry above)
      await tx
        .update(wallets)
        .set({
          balanceInPaise: newBalance,
          lastLedgerSequence: sequenceNumber,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      // 5. Update click status to approved — inside the same transaction
      await tx
        .update(clicks)
        .set({
          trackingStatus: "approved",
          rewardAmountInPaise: amountInPaise,
          reviewedByAdminId: admin.id,
          reviewedAt: new Date(),
        })
        .where(eq(clicks.id, click.id));

      // 6. Audit log — inside the same transaction
      await tx.insert(auditLogs).values({
        actorId: admin.id,
        actionType: "CASHBACK_APPROVED",
        entityType: "clicks",
        entityId: click.id,
        metadata: {
          clickId: click.id,
          userId: click.userId,
          walletType,
          walletId: wallet.id,
          amountInPaise,
          previousBalance: currentBalance,
          newBalance,
          sequenceNumber,
          merchantName: clickWithMerchant?.merchantName,
        },
      });
    });

    // Non-critical: update Redis idempotency cache (failure is safe to ignore)
    try {
      const redis = (await import("@upstash/redis")).Redis.fromEnv();
      await redis.set(
        `idempotency:click_approve_${click.id}`,
        JSON.stringify({ status: "complete", completedAt: new Date().toISOString() }),
        { ex: 86400 },
      );
    } catch (_) {
      // Non-fatal
    }

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/finance");
    revalidatePath("/earnings");

    console.info(`[finance] Click ${click.id} approved: ₹${amountInPaise / 100} credited to user ${click.userId} wallet (${walletType})`);
  } catch (error) {
    // Log but DO NOT silently swallow — important for diagnosing production issues
    console.error("[finance] adminApproveClickFormAction FAILED:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};

export const adminUndoApprovedClickFormAction = async (formData: FormData) => {
  try {
    const admin = await requireFinanceManager();

    const payload = {
      clickId: getString(formData.get("clickId")),
    };

    const validation = adminTrackedClickSchema.safeParse(payload);
    if (!validation.success) {
      return;
    }

    const [click] = await db
      .select()
      .from(clicks)
      .where(eq(clicks.id, validation.data.clickId))
      .limit(1);

    if (!click || click.trackingStatus !== "approved" || click.rewardAmountInPaise <= 0) {
      return;
    }

    const [rewardTransaction] = await db
      .select({
        id: walletTransactions.id,
        amountInPaise: walletTransactions.amountInPaise,
        walletType: walletTransactions.walletType,
        walletId: walletTransactions.walletId,
      })
      .from(walletTransactions)
      .where(eq(walletTransactions.sourceClickId, click.id))
      .limit(1);

    if (!rewardTransaction) {
      // The wallet_transaction row is missing (data inconsistency from a past bug).
      // Still reset the click status so finance manager can re-approve correctly.
      console.error(`[finance] adminUndoApprovedClickFormAction: no wallet_transaction found for click ${click.id} — resetting status only (no debit)`);
      await db
        .update(clicks)
        .set({
          trackingStatus: "tracked",
          rewardAmountInPaise: 0,
          reviewedByAdminId: admin.id,
          reviewedAt: new Date(),
        })
        .where(eq(clicks.id, click.id));
      revalidatePath("/finance");
      revalidatePath("/earnings");
      return;
    }

    const walletTypeValue = rewardTransaction.walletType as "cashback" | "amazon_rewards";

    // ─── ATOMIC OPERATION: Debit wallet + Reset click status in one DB transaction ───
    await db.transaction(async (tx) => {
      // 0. Lock the click row to prevent double-reversal race condition
      const [currentClick] = await tx
        .select()
        .from(clicks)
        .where(eq(clicks.id, click.id))
        .for("update")
        .limit(1);

      if (!currentClick || currentClick.trackingStatus !== "approved") {
        throw new Error(`[finance] Click ${click.id} is no longer approved.`);
      }

      // 1. Lock the wallet row
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(and(eq(wallets.userId, click.userId), eq(wallets.walletType, walletTypeValue)))
        .for("update")
        .limit(1);

      if (!wallet) {
        throw new Error(`[finance] Cannot undo: wallet not found for user ${click.userId} type ${walletTypeValue}`);
      }

      // 2. Verify sufficient balance for reversal
      if (wallet.balanceInPaise < rewardTransaction.amountInPaise) {
        throw new Error(`[finance] Cannot undo: user has ₹${wallet.balanceInPaise / 100} but reversal requires ₹${rewardTransaction.amountInPaise / 100}. Wallet may have been partially withdrawn.`);
      }

      const newBalance = wallet.balanceInPaise - rewardTransaction.amountInPaise;
      const sequenceNumber = wallet.lastLedgerSequence + 1;
      const adminUserId = admin.id !== click.userId ? admin.id : null;

      // 3a. Free up the sourceClickId constraint on the original transaction so it can be re-approved later
      await tx
        .update(walletTransactions)
        .set({ sourceClickId: null })
        .where(eq(walletTransactions.id, rewardTransaction.id));

      // 3b. Insert reversal debit ledger entry (never delete the original credit!)
      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        userId: click.userId,
        walletType: walletTypeValue,
        type: "debit",
        amountInPaise: rewardTransaction.amountInPaise,
        balanceAfterInPaise: newBalance,
        sequenceNumber,
        note: `Reversal of cashback for click ${click.id}`,
        sourceClickId: null, // not linked to the original click to avoid constraint conflict
        idempotencyKey: `undo_click_${click.id}_${Date.now()}`,
        adminUserId,
      });

      // 4. Update wallet balance cache
      await tx
        .update(wallets)
        .set({
          balanceInPaise: newBalance,
          lastLedgerSequence: sequenceNumber,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      // 5. Reset click status — inside the same transaction
      await tx
        .update(clicks)
        .set({
          trackingStatus: "tracked",
          rewardAmountInPaise: 0,
          reviewedByAdminId: admin.id,
          reviewedAt: new Date(),
        })
        .where(eq(clicks.id, click.id));

      // 6. Audit log
      await tx.insert(auditLogs).values({
        actorId: admin.id,
        actionType: "CASHBACK_REVERSED",
        entityType: "clicks",
        entityId: click.id,
        metadata: {
          clickId: click.id,
          userId: click.userId,
          walletType: walletTypeValue,
          walletId: wallet.id,
          amountInPaise: rewardTransaction.amountInPaise,
          previousBalance: wallet.balanceInPaise,
          newBalance,
          sequenceNumber,
        },
      });
    });

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/finance");
    revalidatePath("/earnings");

    console.info(`[finance] Click ${click.id} reversal: ₹${rewardTransaction.amountInPaise / 100} debited from user ${click.userId} wallet (${walletTypeValue})`);
  } catch (error) {
    console.error("[finance] adminUndoApprovedClickFormAction FAILED:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};

export const adminDeleteUnreviewedClickFormAction = async (formData: FormData) => {
  try {
    const admin = await requireFinanceManager();

    const payload = {
      clickId: getString(formData.get("clickId")),
    };

    const validation = adminDeleteClickSchema.safeParse(payload);
    if (!validation.success) {
      return;
    }

    const [click] = await db
      .select()
      .from(clicks)
      .where(eq(clicks.id, validation.data.clickId))
      .limit(1);

    if (!click || click.trackingStatus !== "unreviewed") {
      return;
    }

    await db
      .update(clicks)
      .set({
        trackingStatus: "deleted",
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
      })
      .where(eq(clicks.id, click.id));

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/finance");
  } catch (error) {
    console.error("Admin delete unreviewed click error:", error);
  }
};

export const adminPermanentlyDeleteAllDeletedClicksFormAction = async () => {
  try {
    await requireFinanceManager();

    await db.delete(clicks).where(eq(clicks.trackingStatus, "deleted"));

    revalidatePath("/admin");
    revalidatePath("/");
  } catch (error) {
    console.error("Admin permanent click purge error:", error);
  }
};

export const adminRestoreDeletedClickFormAction = async (formData: FormData) => {
  try {
    await requireFinanceManager();

    const payload = {
      clickId: getString(formData.get("clickId")),
    };

    const validation = adminDeleteClickSchema.safeParse(payload);
    if (!validation.success) {
      return;
    }

    const [click] = await db
      .select()
      .from(clicks)
      .where(eq(clicks.id, validation.data.clickId))
      .limit(1);

    if (!click || click.trackingStatus !== "deleted") {
      return;
    }

    await db
      .update(clicks)
      .set({
        trackingStatus: "unreviewed",
        reviewedByAdminId: null,
        reviewedAt: null,
      })
      .where(eq(clicks.id, click.id));

    revalidatePath("/admin");
    revalidatePath("/");
  } catch (error) {
    console.error("Admin restore deleted click error:", error);
  }
};
