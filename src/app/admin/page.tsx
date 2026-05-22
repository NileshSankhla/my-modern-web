import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import {
  AlertCircle,
  ArrowRightLeft,
  Banknote,
  CheckCircle2,
  MousePointerClick,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";

import {
  adminProcessAmazonGiftCardRequestFormAction,
  adminProcessWithdrawalFormAction,
} from "@/app/actions/wallet";
import AdminAlertForm from "@/components/admin/admin-alert-form";
import AdminInteractiveSections from "@/components/admin/admin-interactive-sections";
import AdminWalletAdjustForm from "@/components/admin/admin-wallet-adjust-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  amazonGiftCardRequests,
  clicks,
  merchants,
  users,
  withdrawalRequests,
} from "@/lib/db/schema";
import { formatPaiseAsINR } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin Mission Control | Fareback",
  description: "Secure Fareback administration and operations panel.",
};

const AdminPage = async () => {
  await requireAdminUser();

  const [
    overview,
    pendingWithdrawals,
    pendingAmazonGiftCardRequests,
    recentClicks,
  ] = await Promise.all([
    (async () => {
      try {
        const [result] = await db
          .select({
            usersCount: sql<number>`(select count(*)::int from users)`,
            clicksCount: sql<number>`(select count(*)::int from clicks where tracking_status <> 'deleted')`,
            unreviewedClicksCount: sql<number>`(select count(*)::int from clicks where tracking_status = 'unreviewed')`,
            trackedClicksCount: sql<number>`(select count(*)::int from clicks where tracking_status = 'tracked')`,
            pendingWithdrawalCount: sql<number>`(select count(*)::int from withdrawal_requests where status = 'pending')`,
            pendingAmazonGiftCardCount: sql<number>`(select count(*)::int from amazon_gift_card_requests where status = 'pending')`,
            cashbackWalletBalance: sql<number>`coalesce((select sum(balance_in_paise)::int from wallets where wallet_type = 'cashback'), 0)`,
            amazonRewardsWalletBalance: sql<number>`coalesce((select sum(balance_in_paise)::int from wallets where wallet_type = 'amazon_rewards'), 0)`,
            totalWalletBalance: sql<number>`coalesce((select sum(balance_in_paise)::int from wallets), 0)`,
          })
          .from(users)
          .limit(1);

        return result ?? {
          usersCount: 0,
          clicksCount: 0,
          unreviewedClicksCount: 0,
          trackedClicksCount: 0,
          pendingWithdrawalCount: 0,
          pendingAmazonGiftCardCount: 0,
          cashbackWalletBalance: 0,
          amazonRewardsWalletBalance: 0,
          totalWalletBalance: 0,
        };
      } catch (error) {
        console.error("Overview fallback (migration likely pending):", error);

        const [fallbackOverview] = await db
          .select({
            usersCount: sql<number>`(select count(*)::int from users)`,
            clicksCount: sql<number>`(select count(*)::int from clicks)`,
            unreviewedClicksCount: sql<number>`(select count(*)::int from clicks where tracking_status = 'unreviewed')`,
            trackedClicksCount: sql<number>`(select count(*)::int from clicks where tracking_status = 'tracked')`,
            pendingWithdrawalCount: sql<number>`(select count(*)::int from withdrawal_requests where status = 'pending')`,
            pendingAmazonGiftCardCount: sql<number>`(select count(*)::int from amazon_gift_card_requests where status = 'pending')`,
            cashbackWalletBalance: sql<number>`coalesce((select sum(balance_in_paise)::int from wallets where wallet_type = 'cashback'), 0)`,
            amazonRewardsWalletBalance: sql<number>`coalesce((select sum(balance_in_paise)::int from wallets where wallet_type = 'amazon_rewards'), 0)`,
            totalWalletBalance: sql<number>`coalesce((select sum(balance_in_paise)::int from wallets), 0)`,
          })
          .from(users)
          .limit(1);

        return {
          usersCount: fallbackOverview?.usersCount ?? 0,
          clicksCount: fallbackOverview?.clicksCount ?? 0,
          unreviewedClicksCount: fallbackOverview?.unreviewedClicksCount ?? 0,
          trackedClicksCount: fallbackOverview?.trackedClicksCount ?? 0,
          pendingWithdrawalCount: fallbackOverview?.pendingWithdrawalCount ?? 0,
          pendingAmazonGiftCardCount: fallbackOverview?.pendingAmazonGiftCardCount ?? 0,
          cashbackWalletBalance: fallbackOverview?.cashbackWalletBalance ?? 0,
          amazonRewardsWalletBalance: fallbackOverview?.amazonRewardsWalletBalance ?? 0,
          totalWalletBalance: fallbackOverview?.totalWalletBalance ?? 0,
        };
      }
    })(),
    db
      .select({
        id: withdrawalRequests.id,
        amountInPaise: withdrawalRequests.amountInPaise,
        upiId: withdrawalRequests.upiId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(withdrawalRequests)
      .innerJoin(users, eq(users.id, withdrawalRequests.userId))
      .where(eq(withdrawalRequests.status, "pending"))
      .orderBy(desc(withdrawalRequests.createdAt))
      .limit(50),
    db
      .select({
        id: amazonGiftCardRequests.id,
        amountInPaise: amazonGiftCardRequests.amountInPaise,
        status: amazonGiftCardRequests.status,
        giftCardCode: amazonGiftCardRequests.giftCardCode,
        userName: users.name,
        userEmail: users.email,
      })
      .from(amazonGiftCardRequests)
      .innerJoin(users, eq(users.id, amazonGiftCardRequests.userId))
      .where(eq(amazonGiftCardRequests.status, "pending"))
      .orderBy(desc(amazonGiftCardRequests.createdAt))
      .limit(50),
    (async () => {
      try {
        return await db
          .select({
            id: clicks.id,
            createdAt: clicks.createdAt,
            userEmail: users.email,
            merchantName: merchants.name,
            trackingStatus: clicks.trackingStatus,
            rewardAmountInPaise: clicks.rewardAmountInPaise,
            affiliateLinkIndex: clicks.affiliateLinkIndex,
          })
          .from(clicks)
          .innerJoin(users, eq(users.id, clicks.userId))
          .innerJoin(merchants, eq(merchants.id, clicks.merchantId))
          .orderBy(desc(clicks.createdAt))
          .limit(200);
      } catch (error) {
        console.error("Recent clicks query fallback (migration likely pending):", error);

        const legacyClicks = await db
          .select({
            id: clicks.id,
            createdAt: clicks.createdAt,
            userEmail: users.email,
            merchantName: merchants.name,
          })
          .from(clicks)
          .innerJoin(users, eq(users.id, clicks.userId))
          .innerJoin(merchants, eq(merchants.id, clicks.merchantId))
          .orderBy(desc(clicks.createdAt))
          .limit(200);

        return legacyClicks.map((click) => ({
          ...click,
          trackingStatus: "unreviewed" as const,
          rewardAmountInPaise: 0,
          affiliateLinkIndex: null,
        }));
      }
    })(),
  ]);

  const clickRows = recentClicks.map((click) => ({
    id: click.id,
    createdAt: click.createdAt.toISOString(),
    userEmail: click.userEmail,
    merchantName: click.merchantName,
    trackingStatus: click.trackingStatus,
    rewardAmountInPaise: click.rewardAmountInPaise,
    affiliateLinkIndex: click.affiliateLinkIndex,
  }));

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8">
        <div className="flex flex-col justify-between gap-4 border-b border-border/50 pb-6 md:flex-row md:items-end">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground">
              <ShieldCheck className="h-8 w-8 text-primary" />
              Mission Control
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Master operations panel for Fareback administration.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" /> {overview?.usersCount ?? 0} Total Registered Users
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between font-medium">
                Total Clicks Tracked
                <MousePointerClick className="h-4 w-4 text-blue-500" />
              </CardDescription>
              <CardTitle className="text-4xl">{overview?.clicksCount ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-amber-500">{overview?.unreviewedClicksCount ?? 0} Unreviewed</span>
                <span> • </span>
                <span className="ml-1 font-semibold text-emerald-500">{overview?.trackedClicksCount ?? 0} Confirmed</span>
              </p>
            </CardContent>
          </Card>

          <Card
            className={`border-l-4 shadow-sm ${
              overview?.pendingWithdrawalCount && overview.pendingWithdrawalCount > 0
                ? "border-l-amber-500 bg-amber-500/5"
                : "border-l-border"
            }`}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between font-medium">
                Pending Withdrawals
                <AlertCircle
                  className={`h-4 w-4 ${
                    overview?.pendingWithdrawalCount && overview.pendingWithdrawalCount > 0
                      ? "text-amber-500"
                      : "text-muted-foreground"
                  }`}
                />
              </CardDescription>
              <CardTitle className="text-4xl">{overview?.pendingWithdrawalCount ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                UPI requests: {overview?.pendingWithdrawalCount ?? 0} • Gift card requests: {overview?.pendingAmazonGiftCardCount ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between font-medium">
                Total Platform Liability
                <Banknote className="h-4 w-4 text-primary" />
              </CardDescription>
              <CardTitle className="text-4xl">{formatPaiseAsINR(overview?.totalWalletBalance ?? 0)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Cashback: {formatPaiseAsINR(overview?.cashbackWalletBalance ?? 0)} • Amazon Rewards: {formatPaiseAsINR(overview?.amazonRewardsWalletBalance ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                  Manual Ledger Adjustment
                </CardTitle>
                <CardDescription>
                  Credit or debit a user wallet after commission reconciliation.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <AdminWalletAdjustForm />
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  Broadcast Alert
                </CardTitle>
                <CardDescription>
                  Send a push note to all users or a specific account.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <AdminAlertForm />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card
              className={`border-border/60 shadow-sm ${
                pendingWithdrawals.length > 0 ? "border-amber-500/30" : ""
              }`}
            >
              <CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
                <CardTitle className="flex items-center justify-between text-lg">
                  Action Queue: Withdrawals
                  {pendingWithdrawals.length > 0 ? (
                    <span className="rounded-full bg-amber-500 px-2 py-1 text-xs text-white">
                      {pendingWithdrawals.length} Pending
                    </span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[450px] space-y-3 overflow-y-auto p-4">
                  {pendingWithdrawals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CheckCircle2 className="mb-2 h-8 w-8 opacity-20" />
                      <p className="text-sm">Queue is empty. All caught up.</p>
                    </div>
                  ) : (
                    pendingWithdrawals.map((request) => (
                      <div
                        key={request.id}
                        className="rounded-md border border-border/60 bg-background p-4 shadow-sm"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-foreground">
                              {request.userName ?? "User"}
                            </p>
                            <p className="text-xs text-muted-foreground">{request.userEmail}</p>
                          </div>
                          <span className="text-lg font-bold text-primary">
                            {formatPaiseAsINR(request.amountInPaise)}
                          </span>
                        </div>

                        <div className="mt-2 mb-3 flex items-center justify-between rounded border border-border/40 bg-muted/50 p-2">
                          <span className="text-xs font-semibold uppercase text-muted-foreground">
                            UPI ID:
                          </span>
                          <code className="select-all text-sm font-mono text-foreground">
                            {request.upiId}
                          </code>
                        </div>

                        <form action={adminProcessWithdrawalFormAction} className="flex flex-col gap-2">
                          <input type="hidden" name="requestId" value={request.id} />
                          <input
                            name="note"
                            placeholder="Add reference ID or note..."
                            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="mt-1 flex gap-2">
                            <Button
                              type="submit"
                              name="decision"
                              value="mark-paid"
                              className="h-8 flex-1 bg-emerald-600 text-xs hover:bg-emerald-700"
                            >
                              Mark Paid
                            </Button>
                            <Button
                              type="submit"
                              name="decision"
                              value="approve"
                              variant="secondary"
                              className="h-8 flex-1 text-xs"
                            >
                              Approve (No Pay)
                            </Button>
                            <Button
                              type="submit"
                              name="decision"
                              value="reject"
                              variant="destructive"
                              className="h-8 w-8 p-0"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </form>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card
              className={`border-border/60 shadow-sm ${
                pendingAmazonGiftCardRequests.length > 0 ? "border-orange-500/30" : ""
              }`}
            >
              <CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
                <CardTitle className="flex items-center justify-between text-lg">
                  Action Queue: Amazon Gift Cards
                  {pendingAmazonGiftCardRequests.length > 0 ? (
                    <span className="rounded-full bg-orange-500 px-2 py-1 text-xs text-white">
                      {pendingAmazonGiftCardRequests.length} Pending
                    </span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[450px] space-y-3 overflow-y-auto p-4">
                  {pendingAmazonGiftCardRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CheckCircle2 className="mb-2 h-8 w-8 opacity-20" />
                      <p className="text-sm">No Amazon gift card requests waiting.</p>
                    </div>
                  ) : (
                    pendingAmazonGiftCardRequests.map((request) => (
                      <div
                        key={request.id}
                        className="rounded-md border border-border/60 bg-background p-4 shadow-sm"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-foreground">
                              {request.userName ?? "User"}
                            </p>
                            <p className="text-xs text-muted-foreground">{request.userEmail}</p>
                          </div>
                          <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                            {formatPaiseAsINR(request.amountInPaise)}
                          </span>
                        </div>

                        <form action={adminProcessAmazonGiftCardRequestFormAction} className="flex flex-col gap-2">
                          <input type="hidden" name="requestId" value={request.id} />
                          <input
                            name="giftCardCode"
                            placeholder="Amazon gift card code"
                            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                          />
                          <input
                            name="note"
                            placeholder="Add note or reference..."
                            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="mt-1 flex gap-2">
                            <Button
                              type="submit"
                              name="decision"
                              value="fulfill"
                              className="h-8 flex-1 bg-orange-600 text-xs hover:bg-orange-700"
                            >
                              Issue Gift Card
                            </Button>
                            <Button
                              type="submit"
                              name="decision"
                              value="approve"
                              variant="secondary"
                              className="h-8 flex-1 text-xs"
                            >
                              Approve
                            </Button>
                            <Button
                              type="submit"
                              name="decision"
                              value="reject"
                              variant="destructive"
                              className="h-8 w-8 p-0"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </form>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <AdminInteractiveSections
            usersCount={overview?.usersCount ?? 0}
            clicksCount={overview?.clicksCount ?? 0}
            unreviewedClicksCount={overview?.unreviewedClicksCount ?? 0}
            trackedClicksCount={overview?.trackedClicksCount ?? 0}
            clicks={clickRows}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
