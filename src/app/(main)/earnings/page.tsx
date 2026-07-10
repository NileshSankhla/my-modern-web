import Link from "next/link";
import MerchantLogo from "@/components/ui/merchant-logo";
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Wallet,
  ArrowUpRight,
  ArrowRight,
  HelpCircle,
  Hourglass,
  BadgeCheck,
  Package,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { db } from "@/lib/db";
import { clicks, merchants } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { formatPaiseAsINR } from "@/lib/utils";
import {
  getWalletBalance,
  DEFAULT_WALLET_TYPE,
  AMAZON_REWARDS_WALLET_TYPE,
} from "@/lib/wallet";

// ─── Status configuration — enterprise-grade labels ─────────────────────────
const STATUS_CONFIG = {
  unreviewed: {
    label: "Detection Pending",
    description: "Purchase detected. Awaiting merchant tracking confirmation.",
    textClass: "text-slate-500 dark:text-slate-400",
    bgClass: "bg-slate-100 dark:bg-slate-800/60",
    borderClass: "border-slate-200 dark:border-slate-700/60",
    accentClass: "bg-slate-300 dark:bg-slate-600",
    icon: Hourglass,
    amountVisible: false,
  },
  tracked: {
    label: "Tracked — Awaiting Approval",
    description: "Purchase confirmed by merchant. Finance team is reviewing and setting your cashback reward.",
    textClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-900/20",
    borderClass: "border-amber-200 dark:border-amber-800/50",
    accentClass: "bg-amber-400",
    icon: Clock,
    amountVisible: true,
  },
  approved: {
    label: "Cashback Credited",
    description: "Reward approved and added to your wallet balance.",
    textClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-900/20",
    borderClass: "border-emerald-200 dark:border-emerald-700/50",
    accentClass: "bg-emerald-400",
    icon: BadgeCheck,
    amountVisible: true,
  },
  deleted: {
    label: "Not Eligible",
    description: "This purchase did not qualify for cashback.",
    textClass: "text-rose-500 dark:text-rose-400",
    bgClass: "bg-rose-50 dark:bg-rose-900/20",
    borderClass: "border-rose-200 dark:border-rose-800/50",
    accentClass: "bg-rose-400",
    icon: XCircle,
    amountVisible: true,
  },
} as const;

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function fullDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export const metadata = {
  title: "Earnings History | Fareback",
  description:
    "Track your cashback earnings from every purchase through Fareback partner stores.",
};

export default async function EarningsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect=/earnings");
  }

  const [userClicks, cashbackWallet, amazonRewardsWallet] = await Promise.all([
    db
      .select({
        id: clicks.id,
        clickedAt: clicks.createdAt,
        merchantName: merchants.name,
        merchantLogo: merchants.logoUrl,
        trackingStatus: clicks.trackingStatus,
        rewardAmountInPaise: clicks.rewardAmountInPaise,
        reviewedAt: clicks.reviewedAt,
      })
      .from(clicks)
      .innerJoin(merchants, eq(merchants.id, clicks.merchantId))
      .where(eq(clicks.userId, user.id))
      .orderBy(desc(clicks.createdAt))
      .limit(100),

    getWalletBalance(user.id, DEFAULT_WALLET_TYPE),
    getWalletBalance(user.id, AMAZON_REWARDS_WALLET_TYPE),
  ]);

  // Aggregates — derived directly from DB (always in sync with finance panel)
  const approvedClicks = userClicks.filter((c) => c.trackingStatus === "approved");
  const trackedClicks = userClicks.filter((c) => c.trackingStatus === "tracked");
  const unreviewedClicks = userClicks.filter((c) => c.trackingStatus === "unreviewed");

  const confirmedPaise = cashbackWallet.balanceInPaise + amazonRewardsWallet.balanceInPaise;
  const pendingPaise = trackedClicks.reduce((a, c) => a + c.rewardAmountInPaise, 0);
  const lifetimePaise = approvedClicks.reduce((a, c) => a + c.rewardAmountInPaise, 0);

  return (
    <div className="min-h-[100dvh] w-full bg-background pb-24 md:pb-10">
      {/* ─── Mobile Sticky Header ───────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Fareback
            </p>
            <h1 className="text-lg font-extrabold tracking-tight text-foreground">
              Earnings History
            </h1>
          </div>
          {confirmedPaise > 0 && (
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm"
            >
              <Wallet className="h-3.5 w-3.5" />
              Withdraw
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-screen-xl px-4 py-6 md:px-8 md:py-10">
        {/* ─── Desktop Page Header ─────────────────────────── */}
        <div className="mb-8 hidden md:flex md:items-end md:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Fareback — Member Rewards
            </p>
            <h1 className="text-4xl font-black tracking-tight text-foreground">
              Earnings History
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Real-time cashback tracking from every purchase through Fareback partner stores
            </p>
          </div>
          {confirmedPaise > 0 && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg"
            >
              <Wallet className="h-4 w-4" />
              Withdraw {formatPaiseAsINR(confirmedPaise)}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* ─── Two-Column Layout on Desktop ────────────────── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8 lg:grid-cols-4">

          {/* ══ LEFT SIDEBAR — Stats (desktop only, stacked mobile) ══ */}
          <div className="md:col-span-1 md:space-y-4">

            {/* Hero Balance Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-5 text-primary-foreground shadow-xl md:rounded-3xl md:p-6">
              <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-6 left-2 h-24 w-24 rounded-full bg-white/5 blur-2xl" />
              <div className="relative z-10">
                <p className="text-[11px] font-bold uppercase tracking-widest opacity-75">
                  Available Balance
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                  {formatPaiseAsINR(confirmedPaise)}
                </p>
                <p className="mt-2 text-[11px] opacity-70">
                  Confirmed · ready to withdraw
                </p>
                {confirmedPaise > 0 && (
                  <Link
                    href="/dashboard"
                    className="mt-4 flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold backdrop-blur-sm transition-all hover:bg-white/25"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Withdraw now
                    <ChevronRight className="ml-auto h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>

            {/* Under Review / Tracked */}
            <div className="rounded-2xl border border-amber-200/60 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-900/10 md:rounded-3xl">
              <div className="mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <p className="text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  Tracked — Awaiting Approval
                </p>
              </div>
              <p className="text-2xl font-black text-amber-700 dark:text-amber-300 md:text-3xl">
                {trackedClicks.length > 0 && pendingPaise > 0 ? formatPaiseAsINR(pendingPaise) : "—"}
              </p>
              <p className="mt-1 text-[11px] text-amber-600/70 dark:text-amber-400/60">
                {trackedClicks.length} order{trackedClicks.length !== 1 ? "s" : ""} confirmed by merchant, awaiting reward approval
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4">
              {/* Approved */}
              <div className="rounded-2xl border border-border/60 bg-card p-4 md:rounded-3xl">
                <div className="mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <p className="text-[11px] font-semibold text-muted-foreground">Approved</p>
                </div>
                <p className="text-xl font-black text-foreground">{approvedClicks.length}</p>
                <p className="text-[10px] text-muted-foreground">{formatPaiseAsINR(lifetimePaise)} earned</p>
              </div>

              {/* Total Orders */}
              <div className="rounded-2xl border border-border/60 bg-card p-4 md:rounded-3xl">
                <div className="mb-1 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <p className="text-[11px] font-semibold text-muted-foreground">Total Orders</p>
                </div>
                <p className="text-xl font-black text-foreground">{userClicks.length}</p>
                <p className="text-[10px] text-muted-foreground">{unreviewedClicks.length} awaiting detection</p>
              </div>
            </div>

            {/* Desktop Quick Links */}
            <div className="hidden space-y-2 md:block">
              {[
                { href: "/stores", label: "Browse Stores", sub: "Earn on every purchase", icon: ShoppingBag, color: "text-primary" },
                { href: "/dashboard", label: "Wallet & Payouts", sub: "UPI · Bank transfer", icon: Wallet, color: "text-emerald-600" },
                { href: "/how-it-works", label: "How Tracking Works", sub: "48h detection policy", icon: HelpCircle, color: "text-blue-600" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3.5 transition-all hover:border-primary/30 hover:shadow-sm"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                      <Icon className={`h-4 w-4 ${item.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.sub}</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ══ RIGHT MAIN — Activity Feed ══ */}
          <div className="md:col-span-2 lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-foreground md:text-lg">Purchase Activity</h2>
                <p className="text-xs text-muted-foreground">
                  All shopping trips tracked through Fareback links
                </p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                {userClicks.length} {userClicks.length === 1 ? "entry" : "entries"}
              </span>
            </div>

            {userClicks.length === 0 ? (
              /* ─── Empty State ─── */
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/50 bg-muted/5 px-8 py-20 text-center md:rounded-3xl">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <ShoppingBag className="h-8 w-8 text-primary/60" />
                </div>
                <h3 className="text-lg font-bold text-foreground">No purchase history yet</h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Shop through Fareback partner stores and your cashback activity will appear here automatically within 48 hours.
                </p>
                <Link
                  href="/stores"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Browse Partner Stores
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {userClicks.map((click) => {
                  const cfg = STATUS_CONFIG[click.trackingStatus] ?? STATUS_CONFIG.unreviewed;
                  const StatusIcon = cfg.icon;
                  const isDeleted = click.trackingStatus === "deleted";

                  return (
                    <div
                      key={click.id}
                      className={`group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md md:rounded-2xl ${cfg.borderClass}`}
                    >
                      {/* Left accent strip */}
                      <div className={`absolute left-0 top-0 h-full w-1 ${cfg.accentClass}`} />

                      <div className="flex items-start gap-4 p-4 pl-5 md:p-5 md:pl-6">
                        {/* Merchant avatar */}
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-background shadow-sm md:h-14 md:w-14 md:rounded-2xl">
                          <MerchantLogo
                            name={click.merchantName}
                            logoUrl={click.merchantLogo}
                            className="h-8 w-8 object-contain md:h-9 md:w-9"
                            fallbackIcon="bag"
                          />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          {/* Row 1: Title + Amount */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className={`truncate font-bold leading-tight md:text-base ${isDeleted ? "text-muted-foreground/70" : "text-foreground"}`}>
                                {click.merchantName}
                              </h3>
                              <p className="mt-0.5 text-[11px] text-muted-foreground md:text-xs">
                                Shopping via Fareback
                              </p>
                            </div>

                            {/* Amount — right side */}
                            <div className="shrink-0 text-right">
                              {cfg.amountVisible && click.rewardAmountInPaise > 0 ? (
                                <p className={`text-base font-black md:text-lg ${
                                  isDeleted
                                    ? "text-rose-400 line-through opacity-60"
                                    : click.trackingStatus === "approved"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-amber-600 dark:text-amber-400"
                                }`}>
                                  {formatPaiseAsINR(click.rewardAmountInPaise)}
                                </p>
                              ) : (
                                <p className="text-sm font-bold text-muted-foreground/30">—</p>
                              )}
                            </div>
                          </div>

                          {/* Row 2: Status badge + timestamp */}
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold md:text-xs ${cfg.textClass} ${cfg.bgClass} ${cfg.borderClass}`}>
                              <StatusIcon className="h-3 w-3 md:h-3.5 md:w-3.5" />
                              {cfg.label}
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 md:text-[11px]">
                              <span title={fullDate(click.clickedAt)}>
                                {timeAgo(click.clickedAt)}
                              </span>
                              {click.reviewedAt &&
                                (click.trackingStatus === "approved" ||
                                  click.trackingStatus === "deleted") && (
                                  <>
                                    <span>·</span>
                                    <span title={fullDate(click.reviewedAt)}>
                                      Reviewed {timeAgo(click.reviewedAt)}
                                    </span>
                                  </>
                                )}
                            </div>
                          </div>

                          {/* Row 3: Description — desktop only */}
                          <p className="mt-1.5 hidden text-[11px] text-muted-foreground/60 md:block">
                            {cfg.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Lifetime summary */}
                {approvedClicks.length > 0 && (
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200/50 bg-emerald-50/60 px-5 py-4 dark:border-emerald-800/30 dark:bg-emerald-900/10">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <div>
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          Lifetime Cashback Earned
                        </p>
                        <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/60">
                          Across {approvedClicks.length} approved order{approvedClicks.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                      {formatPaiseAsINR(lifetimePaise)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Quick Links */}
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 md:hidden">
              {[
                { href: "/stores", label: "Browse Stores", sub: "Earn on every purchase", icon: ShoppingBag },
                { href: "/dashboard", label: "Wallet & Payouts", sub: "Transfer to bank · UPI", icon: Wallet },
                { href: "/how-it-works", label: "How It Works", sub: "Tracking & approvals", icon: HelpCircle },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center justify-between rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-primary/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.sub}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
