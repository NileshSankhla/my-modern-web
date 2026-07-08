"use server";

import { and, eq, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireFinanceManager } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  amazonGiftCardRequests,
  clicks,
  merchants,
  users,
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
} from "@/lib/validations/auth";

interface WalletActionState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

const getString = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value : "";

const parseRupeesToPaise = (value: string) => {
  const parts = value.split(".");
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

    // Step 1: Insert pending request (unique constraint on DB enforces only one pending request per user)
    let request;
    try {
      [request] = await db.insert(withdrawalRequests).values({
        userId: user.id,
        upiId: validation.data.upiId.toLowerCase(),
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

    const [updated] = await db
      .update(amazonGiftCardRequests)
      .set({
        status: "fulfilled",
        giftCardCode: validation.data.giftCardCode || null,
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
  await adminProcessAmazonGiftCardRequestAction({}, formData);
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

    if (validation.data.decision === "mark-paid" && request.status !== "approved" && request.status !== "pending") {
      return { error: "Only pending or approved requests can be marked as paid." };
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
  await adminProcessWithdrawalAction({}, formData);
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

    // Optional: finance manager can pre-set expected reward amount (in rupees)
    const expectedRewardStr = getString(formData.get("expectedReward")).trim();
    const expectedRewardPaise = expectedRewardStr
      ? parseRupeesToPaise(expectedRewardStr)
      : undefined;

    await db
      .update(clicks)
      .set({
        trackingStatus: "tracked",
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
        ...(expectedRewardPaise && expectedRewardPaise > 0
          ? { rewardAmountInPaise: expectedRewardPaise }
          : {}),
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
      return;
    }

    const amountInPaise = parseRupeesToPaise(validation.data.amount);

    if (amountInPaise <= 0) {
      throw new Error("Amount must be strictly positive. Use Reversal or Manual Debit for penalties.");
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

    if (!click || click.trackingStatus === "approved" || click.trackingStatus === "deleted") {
      return;
    }

    const walletType = validation.data.walletType
      ?? (clickWithMerchant?.merchantName?.trim().toLowerCase() === "amazon"
        ? AMAZON_REWARDS_WALLET_TYPE
        : DEFAULT_WALLET_TYPE);

    // Credit the wallet directly. The strict idempotency inside creditWallet prevents double processing.
    await creditWallet({
      userId: click.userId,
      actorId: admin.id,
      walletType: walletType as any,
      amountInPaise,
      transactionType: "CASHBACK",
      sourceReference: click.id,
      sourceType: "click",
      idempotencyKey: `click_approve_${click.id}`,
    });

    await db
      .update(clicks)
      .set({
        trackingStatus: "approved",
        rewardAmountInPaise: amountInPaise,
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
      })
      .where(eq(clicks.id, click.id));

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/finance");
    revalidatePath("/earnings");
  } catch (error) {
    console.error("Admin approve click error:", error);
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
      })
      .from(walletTransactions)
      .where(eq(walletTransactions.sourceClickId, click.id))
      .limit(1);

    if (!rewardTransaction) {
      return;
    }

    // Never delete ledger rows! Append a reversal debit instead.
    await debitWallet({
      userId: click.userId,
      actorId: admin.id,
      walletType: rewardTransaction.walletType as any,
      amountInPaise: rewardTransaction.amountInPaise,
      transactionType: "REVERSAL_DEBIT",
      sourceReference: `Reversal of click ${click.id}`,
      sourceType: "reversal",
      idempotencyKey: `click_undo_${click.id}`,
    });

    await db
      .update(clicks)
      .set({
        trackingStatus: "tracked",
        rewardAmountInPaise: 0,
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
      })
      .where(eq(clicks.id, click.id));

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/finance");
    revalidatePath("/earnings");
  } catch (error) {
    console.error("Admin undo approved click error:", error);
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
