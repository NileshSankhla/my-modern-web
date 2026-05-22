"use server";

import { and, eq, ilike, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/admin";
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
  adjustWalletBalance,
  ensureWalletForUser,
  getWalletBalance,
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

    if (eventLike.error instanceof Error && eventLike.error.message) {
      return eventLike.error.message;
    }

    if (typeof eventLike.cause === "string" && eventLike.cause.length > 0) {
      return eventLike.cause;
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

    await ensureWalletForUser(user.id, DEFAULT_WALLET_TYPE);

    const balanceInPaise = await getWalletBalance(user.id, DEFAULT_WALLET_TYPE);

    if (balanceInPaise < amountInPaise) {
      return { error: "Insufficient wallet balance." };
    }

    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(withdrawalRequests)
      .where(
        and(
          eq(withdrawalRequests.userId, user.id),
          eq(withdrawalRequests.status, "pending"),
        ),
      );

    if ((pendingCount?.count ?? 0) > 0) {
      return { error: "You already have a pending withdrawal request." };
    }

    try {
      await db.insert(withdrawalRequests).values({
        userId: user.id,
        upiId: validation.data.upiId.toLowerCase(),
        amountInPaise,
        status: "pending",
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { error: "You already have a pending withdrawal request." };
      }
      throw error;
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

    await ensureWalletForUser(user.id, AMAZON_REWARDS_WALLET_TYPE);

    const balanceInPaise = await getWalletBalance(user.id, AMAZON_REWARDS_WALLET_TYPE);

    if (balanceInPaise < amountInPaise) {
      return { error: "Insufficient Amazon rewards balance." };
    }

    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(amazonGiftCardRequests)
      .where(
        and(
          eq(amazonGiftCardRequests.userId, user.id),
          eq(amazonGiftCardRequests.status, "pending"),
        ),
      );

    if ((pendingCount?.count ?? 0) > 0) {
      return { error: "You already have a pending Amazon gift card request." };
    }

    try {
      await db.insert(amazonGiftCardRequests).values({
        userId: user.id,
        amountInPaise,
        status: "pending",
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { error: "You already have a pending Amazon gift card request." };
      }
      throw error;
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
    const admin = await requireAdminUser();

    const payload = {
      userEmail: getString(formData.get("userEmail")).trim().toLowerCase(),
      walletType: getString(formData.get("walletType")),
      type: getString(formData.get("type")),
      amount: getString(formData.get("amount")).trim(),
    };

    const validation = walletAdjustmentSchema.safeParse(payload);
    if (!validation.success) {
      return {
        error: "Please correct the highlighted fields.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
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

    await ensureWalletForUser(targetUser.id, validation.data.walletType);

    await adjustWalletBalance({
      userId: targetUser.id,
      adminUserId: admin.id,
      walletType: validation.data.walletType,
      type: validation.data.type,
      amountInPaise,
      note: `Manual ${validation.data.type === "credit" ? "credit" : "debit"} adjustment by ${admin.email}`,
    });

    revalidatePath("/admin");
    revalidatePath("/dashboard");

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
    const admin = await requireAdminUser();

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

    if (validation.data.decision === "reject") {
      if (request.status === "fulfilled") {
        return { error: "Fulfilled requests cannot be rejected." };
      }
      if (request.status === "rejected") {
        return { error: "Request is already rejected." };
      }

      await db
        .update(amazonGiftCardRequests)
        .set({
          status: "rejected",
          adminNote: validation.data.note || null,
          processedByAdminId: admin.id,
          processedAt: new Date(),
        })
        .where(eq(amazonGiftCardRequests.id, request.id));

      revalidatePath("/admin");
      revalidatePath("/dashboard");
      return { success: "Amazon gift card request rejected." };
    }

    if (validation.data.decision === "approve") {
      if (request.status === "approved") {
        return { success: "Amazon gift card request is already approved." };
      }
      if (request.status !== "pending") {
        return { error: "Only pending requests can be approved." };
      }

      try {
        await db.transaction(async (tx) => {
          await adjustWalletBalance({
            userId: request.userId,
            adminUserId: admin.id,
            walletType: AMAZON_REWARDS_WALLET_TYPE,
            type: "debit",
            amountInPaise: request.amountInPaise,
            note: `Amazon gift card request #${request.id}`,
          }, tx);

          await tx
            .update(amazonGiftCardRequests)
            .set({
              status: "approved",
              adminNote: validation.data.note || null,
              processedByAdminId: admin.id,
              processedAt: new Date(),
            })
            .where(eq(amazonGiftCardRequests.id, request.id));
        });
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to reserve Amazon rewards." };
      }

      revalidatePath("/admin");
      revalidatePath("/dashboard");
      return { success: "Amazon gift card request approved." };
    }

    if (!validation.data.giftCardCode) {
      return { error: "Gift card code is required to fulfill the request." };
    }

    if (request.status === "fulfilled") {
      return { error: "Request is already fulfilled." };
    }

    if (request.status === "rejected") {
      return { error: "Rejected requests cannot be fulfilled." };
    }

    if (request.status === "pending") {
      try {
        await db.transaction(async (tx) => {
          await adjustWalletBalance({
            userId: request.userId,
            adminUserId: admin.id,
            walletType: AMAZON_REWARDS_WALLET_TYPE,
            type: "debit",
            amountInPaise: request.amountInPaise,
            note: `Amazon gift card request #${request.id}`,
          }, tx);

          await tx
            .update(amazonGiftCardRequests)
            .set({
              status: "fulfilled",
              giftCardCode: validation.data.giftCardCode,
              adminNote: validation.data.note || null,
              processedByAdminId: admin.id,
              processedAt: new Date(),
            })
            .where(eq(amazonGiftCardRequests.id, request.id));
        });
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to reserve Amazon rewards." };
      }

      revalidatePath("/admin");
      revalidatePath("/dashboard");
      return { success: "Amazon gift card issued successfully." };
    }

    await db
      .update(amazonGiftCardRequests)
      .set({
        status: "fulfilled",
        giftCardCode: validation.data.giftCardCode,
        adminNote: validation.data.note || null,
        processedByAdminId: admin.id,
        processedAt: new Date(),
      })
      .where(eq(amazonGiftCardRequests.id, request.id));

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { success: "Amazon gift card issued successfully." };
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
    const admin = await requireAdminUser();

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

    if (validation.data.decision === "reject") {
      await db
        .update(withdrawalRequests)
        .set({
          status: "rejected",
          adminNote: validation.data.note || null,
          processedByAdminId: admin.id,
          processedAt: new Date(),
        })
        .where(eq(withdrawalRequests.id, request.id));

      revalidatePath("/admin");
      revalidatePath("/dashboard");
      return { success: "Withdrawal request rejected." };
    }

    if (validation.data.decision === "approve") {
      try {
        await db.transaction(async (tx) => {
          await adjustWalletBalance({
            userId: request.userId,
            adminUserId: admin.id,
            type: "debit",
            amountInPaise: request.amountInPaise,
            note: `Withdrawal approved (#${request.id})`,
          }, tx);

          await tx
            .update(withdrawalRequests)
            .set({
              status: "approved",
              adminNote: validation.data.note || null,
              processedByAdminId: admin.id,
              processedAt: new Date(),
            })
            .where(eq(withdrawalRequests.id, request.id));
        });
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to approve withdrawal." };
      }

      revalidatePath("/admin");
      revalidatePath("/dashboard");
      return { success: "Withdrawal approved. Wallet debited." };
    }

    await db
      .update(withdrawalRequests)
      .set({
        status: "paid",
        adminNote: validation.data.note || null,
        processedByAdminId: admin.id,
        processedAt: new Date(),
      })
      .where(eq(withdrawalRequests.id, request.id));

    revalidatePath("/admin");
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
    const admin = await requireAdminUser();

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

    await db
      .update(clicks)
      .set({
        trackingStatus: "tracked",
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
      })
      .where(eq(clicks.id, click.id));

    revalidatePath("/admin");
    revalidatePath("/");
  } catch (error) {
    console.error("Admin mark click tracked error:", error);
  }
};

export const adminUndoTrackedClickFormAction = async (formData: FormData) => {
  try {
    await requireAdminUser();

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

    if (!click || click.trackingStatus !== "tracked") {
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
    console.error("Admin undo tracked click error:", error);
  }
};

export const adminApproveClickFormAction = async (formData: FormData) => {
  try {
    const admin = await requireAdminUser();

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

    if (!click || click.trackingStatus === "approved" || click.trackingStatus === "deleted") {
      return;
    }

    const [existingRewardTransaction] = await db
      .select({ id: walletTransactions.id })
      .from(walletTransactions)
      .where(eq(walletTransactions.sourceClickId, click.id))
      .limit(1);

    if (existingRewardTransaction) {
      return;
    }

    const walletType = validation.data.walletType
      ?? (clickWithMerchant?.merchantName?.trim().toLowerCase() === "amazon"
        ? AMAZON_REWARDS_WALLET_TYPE
        : DEFAULT_WALLET_TYPE);

    try {
      await db.transaction(async (tx) => {
        await adjustWalletBalance({
          userId: click.userId,
          adminUserId: admin.id,
          walletType,
          type: "credit",
          amountInPaise,
          note: `Approved ${walletType === AMAZON_REWARDS_WALLET_TYPE ? "Amazon reward" : "cashback"} for click ${click.id}`,
          sourceClickId: click.id,
        }, tx);

        await tx
          .update(clicks)
          .set({
            trackingStatus: "approved",
            rewardAmountInPaise: amountInPaise,
            reviewedByAdminId: admin.id,
            reviewedAt: new Date(),
          })
          .where(eq(clicks.id, click.id));
      });
    } catch (err) {
      if (err instanceof Error && err.message === "Reward already processed for this click.") {
        return;
      }
      if (isUniqueConstraintError(err)) {
        return;
      }
      console.error("Transaction error in approve click:", err);
      return;
    }

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/dashboard");
  } catch (error) {
    console.error("Admin approve click error:", error);
  }
};

export const adminUndoApprovedClickFormAction = async (formData: FormData) => {
  try {
    const admin = await requireAdminUser();

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

    try {
      await db.transaction(async (tx) => {
        await adjustWalletBalance({
          userId: click.userId,
          adminUserId: admin.id,
          walletType: rewardTransaction.walletType,
          type: "debit",
          amountInPaise: rewardTransaction.amountInPaise,
          note: `Undo approved ${rewardTransaction.walletType === AMAZON_REWARDS_WALLET_TYPE ? "Amazon reward" : "cashback"} for click ${click.id}`,
          sourceClickId: undefined,
        }, tx);

        await tx.delete(walletTransactions).where(eq(walletTransactions.id, rewardTransaction.id));

        await tx
          .update(clicks)
          .set({
            trackingStatus: "tracked",
            rewardAmountInPaise: 0,
            reviewedByAdminId: admin.id,
            reviewedAt: new Date(),
          })
          .where(eq(clicks.id, click.id));
      });
    } catch (err) {
      console.error("Transaction error in undo approve click:", err);
      return;
    }

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/dashboard");
  } catch (error) {
    console.error("Admin undo approved click error:", error);
  }
};

export const adminDeleteUnreviewedClickFormAction = async (formData: FormData) => {
  try {
    const admin = await requireAdminUser();

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
  } catch (error) {
    console.error("Admin delete unreviewed click error:", error);
  }
};

export const adminPermanentlyDeleteAllDeletedClicksFormAction = async () => {
  try {
    await requireAdminUser();

    await db.delete(clicks).where(eq(clicks.trackingStatus, "deleted"));

    revalidatePath("/admin");
    revalidatePath("/");
  } catch (error) {
    console.error("Admin permanent click purge error:", error);
  }
};

export const adminRestoreDeletedClickFormAction = async (formData: FormData) => {
  try {
    await requireAdminUser();

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
