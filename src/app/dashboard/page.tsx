import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import {
  Clock,
  LogOut,
  Mail,
  ShieldCheck,
  User as UserIcon,
  Wallet,
} from "lucide-react";

import { signOutAction } from "@/app/actions/auth";
import WithdrawRequestForm from "@/components/wallet/withdraw-request-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { amazonGiftCardRequests, withdrawalRequests } from "@/lib/db/schema";
import { formatDate, formatPaiseAsINR } from "@/lib/utils";
import { AMAZON_REWARDS_WALLET_TYPE, DEFAULT_WALLET_TYPE, ensureWalletForUser } from "@/lib/wallet";

export const metadata: Metadata = {
  title: "Dashboard | Fareback",
  description: "Manage your Fareback cashback wallet, Amazon rewards wallet, and conversion requests.",
};

const DashboardPage = async () => {
  const user = await requireUser();
  const [
    cashbackWallet,
    amazonRewardsWallet,
    [pendingWithdrawal],
    [pendingAmazonRequest],
  ] = await Promise.all([
    ensureWalletForUser(user.id, DEFAULT_WALLET_TYPE),
    ensureWalletForUser(user.id, AMAZON_REWARDS_WALLET_TYPE),
    db
      .select({
        id: withdrawalRequests.id,
        amountInPaise: withdrawalRequests.amountInPaise,
        createdAt: withdrawalRequests.createdAt,
      })
      .from(withdrawalRequests)
      .where(
        and(
          eq(withdrawalRequests.userId, user.id),
          eq(withdrawalRequests.status, "pending"),
        ),
      )
      .limit(1),
    db
      .select({
        id: amazonGiftCardRequests.id,
        amountInPaise: amazonGiftCardRequests.amountInPaise,
        createdAt: amazonGiftCardRequests.createdAt,
      })
      .from(amazonGiftCardRequests)
      .where(
        and(
          eq(amazonGiftCardRequests.userId, user.id),
          eq(amazonGiftCardRequests.status, "pending"),
        ),
      )
      .limit(1),
  ]);

  const firstName = user.name?.split(" ")[0] ?? "Shopper";

  return (
    <div className="relative min-h-[calc(100vh-5rem)] overflow-hidden bg-muted/5 py-12 sm:py-20">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl animate-in space-y-8 fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Welcome back, <span className="text-primary">{firstName}</span>
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Manage your earnings and request secure UPI payouts.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card className="relative overflow-hidden border-border/50 bg-card shadow-2xl">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-[80px]" />

                <CardContent className="relative z-10 p-8 sm:p-10">
                  <div className="mb-6 flex items-center gap-3 text-primary">
                    <div className="rounded-xl bg-primary/10 p-3 shadow-sm">
                      <Wallet className="h-6 w-6" />
                    </div>
                    <span className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">
                      Available Balance
                    </span>
                  </div>

                  <div className="mb-10">
                    <span className="text-5xl font-black tracking-tight text-foreground sm:text-7xl">
                      {formatPaiseAsINR(cashbackWallet.balanceInPaise)}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-secondary/50 p-6 backdrop-blur-sm">
                    <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Withdraw Cashback to Bank Account (UPI)
                    </h3>

                    <WithdrawRequestForm hasPendingRequest={Boolean(pendingWithdrawal)} walletType="cashback" />

                    {pendingWithdrawal ? (
                      <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
                        <Clock className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-semibold text-amber-700 dark:text-amber-400">
                            Withdrawal Pending Processing
                          </p>
                          <p className="mt-1 opacity-90">
                            {formatPaiseAsINR(pendingWithdrawal.amountInPaise)} requested on {" "}
                            {formatDate(pendingWithdrawal.createdAt)}.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
              <Card className="relative overflow-hidden border-border/50 bg-card shadow-2xl">
                <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-orange-500/15 blur-[90px]" />

                <CardContent className="relative z-10 p-8 sm:p-10">
                  <div className="mb-6 flex items-center gap-3 text-orange-500">
                    <div className="rounded-xl bg-orange-500/10 p-3 shadow-sm">
                      <Wallet className="h-6 w-6" />
                    </div>
                    <span className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">
                      Amazon Rewards Balance
                    </span>
                  </div>

                  <div className="mb-10">
                    <span className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                      {formatPaiseAsINR(amazonRewardsWallet.balanceInPaise)}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-secondary/50 p-6 backdrop-blur-sm">
                    <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Convert Amazon Rewards to Gift Card
                    </h3>

                    <WithdrawRequestForm
                      hasPendingRequest={Boolean(pendingAmazonRequest)}
                      walletType="amazon_rewards"
                    />

                    {pendingAmazonRequest ? (
                      <div className="mt-6 flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/10 p-4 text-orange-700 dark:text-orange-300">
                        <Clock className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-semibold text-orange-700 dark:text-orange-300">
                            Amazon Gift Card Request Pending
                          </p>
                          <p className="mt-1 opacity-90">
                            {formatPaiseAsINR(pendingAmazonRequest.amountInPaise)} requested on {" "}
                            {formatDate(pendingAmazonRequest.createdAt)}.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6 lg:col-span-1">
              <Card className="border-border/50 bg-background/50 shadow-lg backdrop-blur-sm">
                <CardHeader className="border-b border-border/40 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Account Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="space-y-1">
                    <div className="mb-1 flex items-center text-sm text-muted-foreground">
                      <UserIcon className="mr-2 h-4 w-4" /> Full Name
                    </div>
                    <p className="font-medium text-foreground">{user.name ?? "Not set"}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="mb-1 flex items-center text-sm text-muted-foreground">
                      <Mail className="mr-2 h-4 w-4" /> Email Address
                    </div>
                    <p className="truncate font-medium text-foreground" title={user.email}>
                      {user.email}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <form action={signOutAction} className="w-full">
                <Button
                  type="submit"
                  variant="outline"
                  className="flex w-full items-center justify-center gap-2 border-border/50 transition-all hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out Securely
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
