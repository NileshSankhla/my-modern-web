import type { Metadata } from "next";
import { and, eq, desc } from "drizzle-orm";
import {
  Clock,
  LogOut,
  Mail,
  ShieldCheck,
  User as UserIcon,
  Wallet,
  ArrowRight,
  BadgeCheck,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Gift,
  Plus,
  Minus,
  History,
} from "lucide-react";

import { signOutAction } from "@/app/actions/auth";
import WithdrawRequestForm from "@/components/wallet/withdraw-request-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  amazonGiftCardRequests,
  withdrawalRequests,
  walletTransactions,
} from "@/lib/db/schema";
import { formatDate, formatPaiseAsINR } from "@/lib/utils";
import {
  AMAZON_REWARDS_WALLET_TYPE,
  DEFAULT_WALLET_TYPE,
  ensureWalletForUser,
} from "@/lib/wallet";

export const metadata: Metadata = {
  title: "Wallet | Fareback",
  description:
    "Manage your Fareback cashback wallet, Amazon rewards wallet, and withdraw via UPI.",
};

// Premium transaction type labels — enterprise-grade naming
function getTransactionDisplay(
  note: string | null,
  type: "credit" | "debit",
  walletType?: string | null,
  hasSourceClick?: boolean,
) {
  const n = (note ?? "").toLowerCase();

  // Cashback reward credit (note is a click UUID or contains "cashback")
  if (
    type === "credit" &&
    (hasSourceClick ||
      n.includes("cashback") ||
      n.includes("reward") ||
      // Click UUID pattern: cuid2 or uuid format (note is just the click id)
      /^[a-z0-9]{20,}$/.test(n.trim()) ||
      /^[0-9a-f-]{36}$/.test(n.trim()))
  ) {
    const isAmazon = walletType === "amazon_rewards";
    return {
      title: isAmazon ? "Amazon Cashback Reward" : "Cashback Reward",
      subtitle: isAmazon
        ? "Purchase reward credited to Amazon Rewards wallet"
        : "Purchase reward credited to your Cashback wallet",
      icon: ArrowDownLeft,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-200/60 dark:border-emerald-700/40",
    };
  }
  if (n.includes("manual credit") || n.includes("manual adjustment")) {
    return {
      title: "Administrative Credit",
      subtitle: "Manually applied by Fareback Finance team",
      icon: Plus,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-200/60 dark:border-emerald-700/40",
    };
  }
  if (n.includes("manual debit")) {
    return {
      title: "Administrative Debit",
      subtitle: "Manually applied by Fareback Finance team",
      icon: Minus,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-900/20",
      border: "border-rose-200/60 dark:border-rose-700/40",
    };
  }
  if (n.includes("withdrawal reversal") || n.includes("rejected withdrawal")) {
    return {
      title: "Withdrawal Reversal",
      subtitle: "Withdrawal rejected — funds returned to your wallet",
      icon: RotateCcw,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-900/20",
      border: "border-violet-200/60 dark:border-violet-700/40",
    };
  }
  if (n.includes("reversal") && n.includes("click")) {
    return {
      title: "Reward Reversal",
      subtitle: "Previously credited cashback has been reversed",
      icon: RotateCcw,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-900/20",
      border: "border-rose-200/60 dark:border-rose-700/40",
    };
  }
  if (n.includes("withdrawal") || n.includes("withdraw")) {
    return {
      title: "UPI Withdrawal",
      subtitle: "Transfer to your bank/UPI account initiated",
      icon: ArrowUpRight,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      border: "border-blue-200/60 dark:border-blue-700/40",
    };
  }
  if (n.includes("reversal") || n.includes("refund")) {
    return {
      title: "Transaction Reversal",
      subtitle: "Funds returned to your wallet",
      icon: RotateCcw,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-900/20",
      border: "border-violet-200/60 dark:border-violet-700/40",
    };
  }
  if (n.includes("gift card") || n.includes("amazon")) {
    return {
      title: "Amazon Gift Card",
      subtitle: "Converted to Amazon gift card balance",
      icon: Gift,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/20",
      border: "border-orange-200/60 dark:border-orange-700/40",
    };
  }
  // Generic fallback
  if (type === "credit") {
    return {
      title: "Wallet Credit",
      subtitle: "Funds added to your wallet",
      icon: ArrowDownLeft,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-200/60 dark:border-emerald-700/40",
    };
  }
  return {
    title: "Wallet Debit",
    subtitle: "Funds deducted from your wallet",
    icon: ArrowUpRight,
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-800/40",
    border: "border-slate-200/60 dark:border-slate-700/40",
  };
}

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

const DashboardPage = async () => {
  const user = await requireUser();
  const [
    cashbackWallet,
    amazonRewardsWallet,
    [pendingWithdrawal],
    [pendingAmazonRequest],
    recentTransactions,
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

    // Wallet transaction history — manual credits, debits, withdrawals, reversals
    db
      .select({
        id: walletTransactions.id,
        type: walletTransactions.type,
        amountInPaise: walletTransactions.amountInPaise,
        note: walletTransactions.note,
        walletType: walletTransactions.walletType,
        balanceAfterInPaise: walletTransactions.balanceAfterInPaise,
        sourceClickId: walletTransactions.sourceClickId,
        createdAt: walletTransactions.createdAt,
      })
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, user.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(30),
  ]);

  const firstName = user.name?.split(" ")[0] ?? "Shopper";
  const totalBalanceInPaise =
    cashbackWallet.balanceInPaise + amazonRewardsWallet.balanceInPaise;

  return (
    <div className="min-h-[100dvh] w-full bg-background pb-20 md:pb-10">
      {/* ─── Mobile Header ─── */}
      <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Welcome back
            </p>
            <h1 className="text-lg font-extrabold tracking-tight">
              {firstName} 👋
            </h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary">
              {formatPaiseAsINR(totalBalanceInPaise)}
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-6">
        {/* ─── Desktop header ─── */}
        <div className="mb-8 hidden md:block">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Welcome back,{" "}
            <span className="text-primary">{firstName}</span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your earnings and request secure UPI payouts.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
          {/* ─── Left column: Wallets + History ─── */}
          <div className="space-y-4 md:space-y-6 lg:col-span-2">
            {/* Cashback Wallet */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-primary p-5 text-primary-foreground shadow-lg md:rounded-3xl md:p-8">
              <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-8 -left-4 h-32 w-32 rounded-full bg-white/5 blur-xl" />
              <div className="relative z-10">
                <div className="mb-1 flex items-center gap-2 opacity-90">
                  <Wallet className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-widest">
                    Cashback Balance
                  </span>
                </div>
                <p className="mt-1 text-4xl font-black tracking-tight md:text-6xl">
                  {formatPaiseAsINR(cashbackWallet.balanceInPaise)}
                </p>
                <p className="mt-2 text-xs opacity-75">
                  Available for UPI withdrawal
                </p>
              </div>
            </div>

            {/* Cashback Withdrawal Form */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:rounded-3xl md:p-6">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Withdraw to Bank / UPI
                </h2>
              </div>

              <WithdrawRequestForm
                hasPendingRequest={Boolean(pendingWithdrawal)}
                walletType="cashback"
              />

              {pendingWithdrawal ? (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/10 p-4 text-warning">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-warning-foreground">
                      Withdrawal Pending
                    </p>
                    <p className="mt-0.5 text-xs opacity-90">
                      {formatPaiseAsINR(pendingWithdrawal.amountInPaise)}{" "}
                      requested on {formatDate(pendingWithdrawal.createdAt)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Amazon Rewards Wallet */}
            <div className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-50 to-amber-50 p-5 shadow-sm dark:from-orange-950/30 dark:to-amber-950/20 md:rounded-3xl md:p-8">
              <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-orange-500/10 blur-2xl" />
              <div className="relative z-10">
                <div className="mb-1 flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <Wallet className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-widest">
                    Amazon Rewards
                  </span>
                </div>
                <p className="mt-1 text-4xl font-black tracking-tight text-orange-600 dark:text-orange-400 md:text-5xl">
                  {formatPaiseAsINR(amazonRewardsWallet.balanceInPaise)}
                </p>
                <p className="mt-2 text-xs text-orange-500/70 dark:text-orange-400/70">
                  Convert to Amazon Gift Card
                </p>
              </div>
            </div>

            {/* Amazon Rewards Form */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:rounded-3xl md:p-6">
              <div className="mb-4 flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Convert to Amazon Gift Card
                </h2>
              </div>

              <WithdrawRequestForm
                hasPendingRequest={Boolean(pendingAmazonRequest)}
                walletType="amazon_rewards"
              />

              {pendingAmazonRequest ? (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/10 p-4 text-warning">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-warning-foreground">
                      Gift Card Request Pending
                    </p>
                    <p className="mt-0.5 text-xs opacity-90">
                      {formatPaiseAsINR(pendingAmazonRequest.amountInPaise)}{" "}
                      requested on{" "}
                      {formatDate(pendingAmazonRequest.createdAt)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* ─── Wallet Transaction History ─── */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:rounded-3xl md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Wallet History
                  </h2>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {recentTransactions.length} entries
                </span>
              </div>

              {recentTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-8 text-center">
                  <History className="mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">No wallet activity yet</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/60">
                    Credits, debits, and withdrawals will appear here
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {recentTransactions.map((tx) => {
                    const isCredit = tx.type === "credit";
                    const display = getTransactionDisplay(
                      tx.note,
                      tx.type,
                      tx.walletType,
                      Boolean(tx.sourceClickId),
                    );
                    const TxIcon = display.icon;

                    return (
                      <div
                        key={tx.id}
                        className={`relative overflow-hidden rounded-xl border p-3.5 md:p-4 ${display.border} ${display.bg}`}
                      >
                        {/* Colored accent strip */}
                        <div className={`absolute left-0 top-0 h-full w-1 rounded-l-xl ${isCredit ? "bg-emerald-400" : "bg-slate-400"}`} />

                        <div className="flex items-center gap-3 pl-2">
                          {/* Icon */}
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${display.border} bg-background/80`}>
                            <TxIcon className={`h-4 w-4 ${display.color}`} />
                          </div>

                          {/* Details */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold leading-tight text-foreground">
                              {display.title}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {display.subtitle} · {timeAgo(tx.createdAt)}
                            </p>
                          </div>

                          {/* Amount */}
                          <div className="shrink-0 text-right">
                            <p className={`text-sm font-black md:text-base ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                              {isCredit ? "+" : "−"}{formatPaiseAsINR(tx.amountInPaise)}
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 capitalize">
                              {tx.walletType === "amazon_rewards" ? "Amazon" : "Cashback"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── Right column: Account info ─── */}
          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:rounded-3xl md:p-6">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">Account Details</h2>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserIcon className="h-3.5 w-3.5" />
                    Full Name
                  </div>
                  <p className="font-semibold text-foreground">
                    {user.name ?? "Not set"}
                  </p>
                </div>

                <div className="rounded-xl bg-muted/40 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </div>
                  <p
                    className="truncate font-semibold text-foreground"
                    title={user.email}
                  >
                    {user.email}
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-success/10 p-3">
                  <BadgeCheck className="h-4 w-4 text-success" />
                  <span className="text-sm font-semibold text-success">
                    Verified Account
                  </span>
                </div>
              </div>
            </div>

            <form action={signOutAction} className="w-full">
              <Button
                type="submit"
                variant="outline"
                className="flex w-full items-center justify-center gap-2 rounded-xl border-border/50 py-5 transition-all hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sign Out Securely
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
