import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { decryptField } from "@/lib/security/encryption";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  amazonGiftCardRequests,
  clicks,
  merchants,
  users,
  wallets,
  walletTransactions,
  withdrawalRequests,
} from "@/lib/db/schema";
import { FinancePanel } from "@/components/fareback-finance/finance-panel";

export default async function FinancePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect=/finance");
  }

  // Allow access if user is admin or a finance manager
  if (!user.isAdmin && !user.isFinanceManager) {
    redirect("/");
  }

  const [
    // 1. Overview aggregate stats
    overviewRows,
    // 2. Top 10 users by total wallet balance
    topUsers,
    // 3. Pending withdrawal requests with user info
    pendingWithdrawals,
    // 4. Pending amazon gift card requests with user info
    pendingGiftCards,
    // 5. All users with their wallet balances
    allUsers,
    // 6. Recent clicks with merchant + user info
    recentClicks,
    // 7. Recent wallet transactions with user email
    recentWalletTransactions,
  ] = await Promise.all([
    // ── 1. Overview ──────────────────────────────────────────────────────
    db
      .select({
        totalCashbackBalance: sql<number>`coalesce(sum(case when ${wallets.walletType} = 'cashback' then ${wallets.balanceInPaise} else 0 end)::int, 0)`,
        totalAmazonBalance: sql<number>`coalesce(sum(case when ${wallets.walletType} = 'amazon_rewards' then ${wallets.balanceInPaise} else 0 end)::int, 0)`,
      })
      .from(wallets)
      .then(async ([walletTotals]) => {
        const [withdrawalTotals] = await db
          .select({
            totalPaidAmount: sql<number>`coalesce(sum(case when ${withdrawalRequests.status} = 'paid' then ${withdrawalRequests.amountInPaise} else 0 end)::int, 0)`,
            totalPendingAmount: sql<number>`coalesce(sum(case when ${withdrawalRequests.status} = 'pending' then ${withdrawalRequests.amountInPaise} else 0 end)::int, 0)`,
          })
          .from(withdrawalRequests);

        const [giftCardTotals] = await db
          .select({
            totalFulfilledAmount: sql<number>`coalesce(sum(case when ${amazonGiftCardRequests.status} = 'fulfilled' then ${amazonGiftCardRequests.amountInPaise} else 0 end)::int, 0)`,
            totalPendingAmount: sql<number>`coalesce(sum(case when ${amazonGiftCardRequests.status} = 'pending' then ${amazonGiftCardRequests.amountInPaise} else 0 end)::int, 0)`,
          })
          .from(amazonGiftCardRequests);

        return {
          totalCashbackBalance: walletTotals?.totalCashbackBalance ?? 0,
          totalAmazonBalance: walletTotals?.totalAmazonBalance ?? 0,
          totalPaidWithdrawals: withdrawalTotals?.totalPaidAmount ?? 0,
          totalFulfilledGiftCards: giftCardTotals?.totalFulfilledAmount ?? 0,
          totalPendingWithdrawals: withdrawalTotals?.totalPendingAmount ?? 0,
          totalPendingGiftCards: giftCardTotals?.totalPendingAmount ?? 0,
        };
      }),

    // ── 2. Top 10 users by wallet balance ────────────────────────────────
    db
      .select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        cashbackBalance: sql<number>`coalesce(sum(case when ${wallets.walletType} = 'cashback' then ${wallets.balanceInPaise} else 0 end)::int, 0)`,
        amazonBalance: sql<number>`coalesce(sum(case when ${wallets.walletType} = 'amazon_rewards' then ${wallets.balanceInPaise} else 0 end)::int, 0)`,
      })
      .from(users)
      .leftJoin(wallets, eq(wallets.userId, users.id))
      .groupBy(users.id)
      .orderBy(desc(sql`coalesce(sum(${wallets.balanceInPaise})::int, 0)`))
      .limit(10),

    // ── 3. Pending withdrawal requests ───────────────────────────────────
    db
      .select({
        id: withdrawalRequests.id,
        amountInPaise: withdrawalRequests.amountInPaise,
        upiIdEncrypted: withdrawalRequests.upiIdEncrypted,
        userName: users.name,
        userEmail: users.email,
        createdAt: withdrawalRequests.createdAt,
      })
      .from(withdrawalRequests)
      .innerJoin(users, eq(users.id, withdrawalRequests.userId))
      .where(eq(withdrawalRequests.status, "pending"))
      .orderBy(desc(withdrawalRequests.createdAt))
      .limit(50)
      .then((reqs) =>
        reqs.map((r) => ({
          ...r,
          upiId: decryptField(r.upiIdEncrypted),
        })),
      ),

    // ── 4. Pending amazon gift card requests ─────────────────────────────
    db
      .select({
        id: amazonGiftCardRequests.id,
        amountInPaise: amazonGiftCardRequests.amountInPaise,
        status: amazonGiftCardRequests.status,
        giftCardCode: amazonGiftCardRequests.giftCardCode,
        userName: users.name,
        userEmail: users.email,
        createdAt: amazonGiftCardRequests.createdAt,
      })
      .from(amazonGiftCardRequests)
      .innerJoin(users, eq(users.id, amazonGiftCardRequests.userId))
      .where(eq(amazonGiftCardRequests.status, "pending"))
      .orderBy(desc(amazonGiftCardRequests.createdAt))
      .limit(50),

    // ── 5. All users with wallet balances ────────────────────────────────
    db
      .select({
        userId: users.id,
        userEmail: users.email,
        userName: users.name,
        cashbackBalance: sql<number>`coalesce(sum(case when ${wallets.walletType} = 'cashback' then ${wallets.balanceInPaise} else 0 end)::int, 0)`,
        amazonBalance: sql<number>`coalesce(sum(case when ${wallets.walletType} = 'amazon_rewards' then ${wallets.balanceInPaise} else 0 end)::int, 0)`,
      })
      .from(users)
      .leftJoin(wallets, eq(wallets.userId, users.id))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt))
      .limit(100),

    // ── 6. Recent clicks with merchant + user info ───────────────────────
    db
      .select({
        id: clicks.id,
        userEmail: users.email,
        userName: users.name,
        merchantName: merchants.name,
        trackingStatus: clicks.trackingStatus,
        rewardAmountInPaise: clicks.rewardAmountInPaise,
        createdAt: clicks.createdAt,
        // Extended metadata for the Finance popup
        affiliateLinkUrl: clicks.affiliateLinkUrl,
        ipAddress: clicks.ipAddress,
        userAgent: clicks.userAgent,
        referrerUrl: clicks.referrerUrl,
        reviewedAt: clicks.reviewedAt,
      })
      .from(clicks)
      .innerJoin(users, eq(users.id, clicks.userId))
      .leftJoin(merchants, eq(merchants.id, clicks.merchantId))
      .orderBy(desc(clicks.createdAt))
      .limit(100),

    // ── 7. Recent wallet transactions ────────────────────────────────────
    db
      .select({
        id: walletTransactions.id,
        userEmail: users.email,
        userName: users.name,
        walletType: walletTransactions.walletType,
        type: walletTransactions.type,
        amountInPaise: walletTransactions.amountInPaise,
        note: walletTransactions.note,
        createdAt: walletTransactions.createdAt,
      })
      .from(walletTransactions)
      .innerJoin(users, eq(users.id, walletTransactions.userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(100),
  ]);

  return (
    <FinancePanel
      managerName={user.name || user.email}
      managerEmail={user.email}
      overview={overviewRows}
      topUsers={topUsers}
      pendingWithdrawals={pendingWithdrawals}
      pendingGiftCards={pendingGiftCards}
      users={allUsers}
      clicks={recentClicks.map(c => ({ ...c, merchantName: c.merchantName || "Unknown" }))}
      walletTransactions={recentWalletTransactions}
    />
  );
}
