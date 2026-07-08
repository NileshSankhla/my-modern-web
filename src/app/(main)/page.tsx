import Link from "next/link";
import Image from "next/image";
import MerchantLogo from "@/components/ui/merchant-logo";
import { desc, eq } from "drizzle-orm";
import {
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Zap,
  Wallet,
  Clock,
  CheckCircle,
  ShoppingCart,
  ReceiptText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { clicks, merchants } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  getWalletBalance,
  DEFAULT_WALLET_TYPE,
  AMAZON_REWARDS_WALLET_TYPE,
} from "@/lib/wallet";
import HeroCarousel from "@/components/hero-carousel";
import { HowItWorksButton, ShopNowButton } from "@/components/action-buttons";
import TrackedHistory, {
  type TrackedHistoryItem,
} from "@/components/tracked-history";

import PromotionalBanner from "@/components/home/promotional-banner";
import { PRIMARY_AMAZON_AFFILIATE_URL } from "@/lib/affiliate-rotation";
import {
  COMING_SOON_MERCHANT_NAMES,
  getAllMerchants,
  SUPPORTED_MERCHANT_NAMES,
} from "@/lib/data/merchants";

type ClickTrackingStatus = "unreviewed" | "tracked" | "approved" | "deleted";

const isTrackedOrApproved = <T extends { trackingStatus: ClickTrackingStatus }>(
  click: T,
): click is T & { trackingStatus: "tracked" | "approved" } =>
  click.trackingStatus === "tracked" || click.trackingStatus === "approved";

const Page = async () => {
  const user = await getCurrentUser();
  let merchantList: (typeof merchants.$inferSelect)[] = [];

  try {
    merchantList = await getAllMerchants();
  } catch (error) {
    console.error("Failed to fetch merchants:", error);
  }

  const visibleMerchantList = merchantList.filter((merchant) =>
    SUPPORTED_MERCHANT_NAMES.has(merchant.name.trim().toLowerCase()),
  );
  const heroPriorityMerchantNames = ["amazon", "flipkart", "myntra"];
  const featuredHeroMerchantRecords: (typeof merchants.$inferSelect)[] = [];
  const normalizedMerchantMap = new Map<
    string,
    typeof merchants.$inferSelect
  >();
  const featuredHeroMerchantIds = new Set<number>();

  for (const merchant of visibleMerchantList) {
    const normalizedName = merchant.name.trim().toLowerCase();
    if (!normalizedMerchantMap.has(normalizedName)) {
      normalizedMerchantMap.set(normalizedName, merchant);
    }
  }

  for (const merchantName of heroPriorityMerchantNames) {
    const merchant = normalizedMerchantMap.get(merchantName);

    if (merchant && !featuredHeroMerchantIds.has(merchant.id)) {
      featuredHeroMerchantRecords.push(merchant);
      featuredHeroMerchantIds.add(merchant.id);
    }
  }

  for (const merchant of visibleMerchantList) {
    if (featuredHeroMerchantRecords.length >= 8) {
      break;
    }

    if (!featuredHeroMerchantIds.has(merchant.id)) {
      featuredHeroMerchantRecords.push(merchant);
      featuredHeroMerchantIds.add(merchant.id);
    }
  }

  const featuredHeroMerchants = featuredHeroMerchantRecords
    .slice(0, 8)
    .map((merchant) => ({
      id: merchant.id,
      name: merchant.name,
      cashbackRate: merchant.cashbackRate,
      logoUrl: merchant.logoUrl,
      href: `/merchants?merchantId=${merchant.id}`,
    }));

  const defaultFavoritePlatform =
    visibleMerchantList.slice().sort((a, b) => a.name.localeCompare(b.name))[0]
      ?.name ?? "your favorite store";
  let favoritePlatform = defaultFavoritePlatform;

  let trackedItems: TrackedHistoryItem[] = [];
  let confirmedEarnedPaise = 0;
  let pendingEarnedPaise = 0;

  if (user) {
    try {
      const [userClicks, cashbackWallet, amazonRewardsWallet] =
        await Promise.all([
          db
            .select({
              id: clicks.id,
              clickDate: clicks.createdAt,
              merchantName: merchants.name,
              merchantLogo: merchants.logoUrl,
              trackingStatus: clicks.trackingStatus,
              rewardAmount: clicks.rewardAmountInPaise,
              reviewedAt: clicks.reviewedAt,
            })
            .from(clicks)
            .innerJoin(merchants, eq(merchants.id, clicks.merchantId))
            .where(eq(clicks.userId, user.id))
            .orderBy(desc(clicks.createdAt))
            .limit(20),
          getWalletBalance(user.id, DEFAULT_WALLET_TYPE),
          getWalletBalance(user.id, AMAZON_REWARDS_WALLET_TYPE),
        ]);

      confirmedEarnedPaise =
        cashbackWallet.balanceInPaise + amazonRewardsWallet.balanceInPaise;
      pendingEarnedPaise = userClicks
        .filter(
          (c) =>
            c.trackingStatus === "tracked" || c.trackingStatus === "unreviewed",
        )
        .reduce((acc, item) => acc + item.rewardAmount, 0);

      trackedItems = userClicks.map((click) => ({
        id: click.id,
        merchantName: click.merchantName,
        merchantLogo: click.merchantLogo ?? null,
        clickDate: click.clickDate,
        rewardAmount: click.rewardAmount,
        trackingStatus: click.trackingStatus,
        reviewedAt: click.reviewedAt ?? null,
      }));

      if (userClicks.length > 0) {
        const merchantFrequency = new Map<string, number>();
        let mostFrequentMerchant = defaultFavoritePlatform;
        let mostFrequentCount = 0;

        for (const click of userClicks) {
          const nextCount =
            (merchantFrequency.get(click.merchantName) ?? 0) + 1;
          merchantFrequency.set(click.merchantName, nextCount);

          if (nextCount > mostFrequentCount) {
            mostFrequentCount = nextCount;
            mostFrequentMerchant = click.merchantName;
          }
        }

        favoritePlatform = mostFrequentMerchant;
      }
    } catch (error) {
      console.error("Failed to fetch tracked history:", error);
    }
  }

  const totalEarned = (confirmedEarnedPaise + pendingEarnedPaise) / 100;
  const pendingEarned = pendingEarnedPaise / 100;
  const withdrawnEarned = confirmedEarnedPaise / 100;

  const marqueeItems =
    featuredHeroMerchants.length > 0
      ? featuredHeroMerchants.map((merchant) => ({
          name: merchant.name,
          rate: merchant.cashbackRate,
        }))
      : [
          { name: "Amazon", rate: "Up to 5.0%" },
          { name: "Flipkart", rate: "Up to 3.7%" },
          { name: "Myntra", rate: "Up to 4.0%" },
          { name: "AJIO", rate: "Up to 6.0%" },
          { name: "Croma", rate: "Up to 2.5%" },
        ];

  const repeatedMarqueeItems = [...marqueeItems, ...marqueeItems];

  return (
    <>
      {/* Mobile Dashboard View (Logged In Only) */}
      {user && (
        <div className="flex md:hidden min-h-[calc(100dvh-4rem)] w-full flex-col gap-6 overflow-x-hidden bg-background px-4 pt-6 pb-24">
          {/* Welcome greeting with VIP Status */}
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-extrabold text-primary mb-1">
                <Sparkles className="h-3 w-3" /> VIP Rewards Member
              </div>
              <h2 className="text-2xl font-black tracking-tight text-foreground">
                Hello, {user.name?.split(" ")[0] ?? "Shopper"} 👋
              </h2>
            </div>
            <Link
              href="/profile"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-sm transition-transform active:scale-95"
            >
              <ShieldCheck className="h-5 w-5 text-primary" />
            </Link>
          </div>

          {/* Total Cashback Card */}
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 text-primary-foreground shadow-xl">
            <div className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -left-8 -bottom-8 h-44 w-44 rounded-full bg-black/10 blur-2xl" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-widest opacity-90">
                  Total Cashback Balance
                </p>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-md">
                  Active Wallet
                </span>
              </div>
              <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
                ₹{totalEarned.toLocaleString()}
              </h2>
              
              <div className="mt-4 flex items-center justify-between border-t border-white/20 pt-4">
                <div className="flex items-center text-xs font-bold opacity-90">
                  <TrendingUp className="mr-1.5 h-4 w-4" />
                  <span>Real-time earnings tracking</span>
                </div>
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-white px-3.5 py-1.5 text-xs font-black text-primary shadow-md transition-transform active:scale-95 hover:bg-white/90"
                >
                  Withdraw Now →
                </Link>
              </div>
            </div>
          </div>

          {/* Pending / Confirmed Stats */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="relative overflow-hidden rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/15 via-warning/5 to-background p-4 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-warning" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-warning/90">
                    Pending
                  </span>
                </div>
                <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-foreground">
                ₹{pendingEarned.toLocaleString()}
              </h3>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                Awaiting store verification
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-success/30 bg-gradient-to-br from-success/15 via-success/5 to-background p-4 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-success">
                    Confirmed
                  </span>
                </div>
                <ShieldCheck className="h-4 w-4 text-success/70" />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-foreground">
                ₹{withdrawnEarned.toLocaleString()}
              </h3>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                Ready for UPI payout
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="mb-3 text-sm font-extrabold tracking-tight text-foreground">
              Quick Actions
            </h3>
            <div className="grid grid-cols-4 gap-2.5">
              <Link
                href="/stores"
                className="group flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card p-3 text-center shadow-sm transition-all active:scale-95 hover:border-primary/40 hover:shadow-md"
              >
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-inner transition-transform group-hover:scale-110">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-extrabold text-foreground">
                  Shop Now
                </span>
                <span className="text-[9px] font-semibold text-muted-foreground">
                  50+ Stores
                </span>
              </Link>

              <Link
                href="/earnings"
                className="group flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card p-3 text-center shadow-sm transition-all active:scale-95 hover:border-primary/40 hover:shadow-md"
              >
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400 shadow-inner transition-transform group-hover:scale-110">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-extrabold text-foreground">
                  My Orders
                </span>
                <span className="text-[9px] font-semibold text-muted-foreground">
                  Live Track
                </span>
              </Link>

              <Link
                href="/dashboard"
                className="group flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card p-3 text-center shadow-sm transition-all active:scale-95 hover:border-primary/40 hover:shadow-md"
              >
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 shadow-inner transition-transform group-hover:scale-110">
                  <Wallet className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-extrabold text-foreground">
                  Withdraw
                </span>
                <span className="text-[9px] font-semibold text-muted-foreground">
                  Instant UPI
                </span>
              </Link>

              <Link
                href="/profile/payment-history"
                className="group flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card p-3 text-center shadow-sm transition-all active:scale-95 hover:border-primary/40 hover:shadow-md"
              >
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400 shadow-inner transition-transform group-hover:scale-110">
                  <Clock className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-extrabold text-foreground">
                  Ledger
                </span>
                <span className="text-[9px] font-semibold text-muted-foreground">
                  Audit Trail
                </span>
              </Link>
            </div>
          </div>

          {/* Top Stores with Real-Time Logos */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold tracking-tight text-foreground">
                  Premium Partner Brands
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Shop and earn instant cashback
                </p>
              </div>
              <Link
                href="/stores"
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                View All <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-3 pt-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {featuredHeroMerchants.map((merchant) => (
                <Link
                  key={merchant.id}
                  href={merchant.href}
                  className="group relative flex min-w-[125px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card/80 to-card p-3.5 text-center shadow-sm backdrop-blur-md transition-all active:scale-95 hover:border-primary/50 hover:shadow-md"
                >
                  <div className="mb-2.5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-white p-2 shadow-sm transition-transform duration-300 group-hover:scale-110">
                    <MerchantLogo
                      name={merchant.name}
                      logoUrl={merchant.logoUrl}
                      className="h-10 w-10 object-contain"
                      fallbackIcon="store"
                    />
                  </div>
                  <div className="truncate w-full text-xs font-extrabold leading-tight text-foreground">
                    {merchant.name}
                  </div>
                  <div className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black text-primary">
                    Upto {merchant.cashbackRate}*
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Unified Landing Page (Visible to all on Desktop, Logged Out on Mobile) */}
      <div
        className={`min-h-screen flex-col overflow-hidden ${user ? "hidden md:flex" : "flex"}`}
      >
        <section className="relative overflow-hidden border-b border-border/40 pt-32 pb-24 sm:pt-40 sm:pb-32">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-8 h-24 overflow-hidden opacity-35 sm:top-12 sm:h-32 sm:opacity-40">
              <div className="animate-marquee flex w-max whitespace-nowrap will-change-transform">
                {repeatedMarqueeItems.map((item, index) => (
                  <span
                    key={`${item.name}-${index}`}
                    className="mx-4 inline-flex items-center gap-3 text-2xl font-black tracking-tight text-transparent sm:text-4xl"
                  >
                    <span className="bg-gradient-to-r from-foreground/25 via-foreground/18 to-foreground/8 bg-clip-text dark:from-muted-foreground/35 dark:via-muted-foreground/22 dark:to-muted-foreground/10">
                      {item.name}
                    </span>
                    <span className="text-xs font-semibold text-primary/45 dark:text-primary/50 sm:text-sm">
                      {item.rate}
                    </span>
                    <span className="text-primary/25 dark:text-primary/30">
                      •
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="absolute top-0 left-1/2 h-[500px] w-[1000px] -translate-x-1/2 opacity-30">
              <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 blur-[120px] animate-pulse" />
            </div>
          </div>

          <div className="container relative z-10 mx-auto px-4 text-center">
            <div className="mx-auto max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-4 inline-flex items-center justify-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 backdrop-blur-md">
                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">
                  India&apos;s Smartest Cashback Platform
                </span>
              </div>

              <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl">
                Maximize Savings on <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-primary via-primary/80 to-amber-500 bg-clip-text text-transparent">
                  Every Purchase.
                </span>
              </h1>

              <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-muted-foreground sm:text-xl">
                Shop from India&apos;s top brands and earn guaranteed cashback.
                Track automatically, withdraw via UPI, and never leave money on
                the table again.
              </p>

              <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
                {user ? (
                  <ShopNowButton className="group inline-flex w-full items-center justify-center rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.4)] transition-all hover:scale-105 hover:bg-primary/90 hover:shadow-[0_0_30px_hsl(var(--primary)/0.6)] sm:w-auto" />
                ) : (
                  <Link
                    href="/sign-in"
                    className="group inline-flex w-full items-center justify-center rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.4)] transition-all hover:scale-105 hover:bg-primary/90 hover:shadow-[0_0_30px_hsl(var(--primary)/0.6)] sm:w-auto"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                )}

                <HowItWorksButton />
              </div>

              <div className="mx-auto max-w-3xl gap-2 pt-8 opacity-80 flex flex-wrap items-center justify-center sm:gap-4 sm:pt-12">
                <div className="flex items-center justify-center gap-1 text-xs font-medium sm:text-sm">
                  <Zap className="h-4 w-4 sm:h-4 sm:w-4 text-primary" />
                  <span className="hidden sm:inline">Seamless Tracking</span>
                  <span className="sm:hidden">Seamless Tracking</span>
                </div>
                <span className="text-muted-foreground text-xs sm:text-sm">
                  •
                </span>
                <div className="flex items-center justify-center gap-1 text-xs font-medium sm:text-sm">
                  <ShieldCheck className="h-4 w-4 sm:h-4 sm:w-4 text-primary" />
                  <span className="hidden sm:inline">
                    100% Secure UPI Payouts
                  </span>
                  <span className="sm:hidden">Secure UPI Payouts</span>
                </div>
                <span className="text-muted-foreground text-xs sm:text-sm">
                  •
                </span>
                <div className="flex items-center justify-center gap-1 text-xs font-medium sm:text-sm">
                  <TrendingUp className="h-4 w-4 sm:h-4 sm:w-4 text-primary" />
                  <span className="hidden sm:inline">
                    Highest Cashback Rates
                  </span>
                  <span className="sm:hidden">Highest Cashback Rates</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-20 -mt-12 sm:-mt-16 bg-transparent">
          <PromotionalBanner href={PRIMARY_AMAZON_AFFILIATE_URL} />
        </section>

        <section
          id="offers"
          className="relative border-y border-border/40 bg-muted/10 py-24 pt-32 sm:pt-40"
        >
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
                Premium Partners
              </h2>
              <p className="text-lg text-muted-foreground">
                We partnered with the brands you already love. Click through
                Fareback before you shop to activate your rewards.
              </p>
            </div>

            {visibleMerchantList.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Store className="h-8 w-8 text-primary" />
                </div>
                <p className="text-xl font-medium text-muted-foreground">
                  Activating premium brands. Check back shortly.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {visibleMerchantList.map((merchant) => {
                  const merchantNameKey = merchant.name.trim().toLowerCase();
                  const isComingSoon =
                    COMING_SOON_MERCHANT_NAMES.has(merchantNameKey);
                  const merchantHref = isComingSoon
                    ? `/coming-soon/${merchantNameKey}`
                    : `/merchants?merchantId=${merchant.id}`;

                  return (
                    <a
                      key={merchant.id}
                      href={merchantHref}
                      className="group relative block"
                      aria-label={
                        isComingSoon
                          ? `${merchant.name} is coming soon on Fareback`
                          : `Shop at ${merchant.name} and earn up to ${merchant.cashbackRate} cashback`
                      }
                    >
                      <Card className="relative h-full overflow-hidden border-border/50 bg-background/60 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-primary/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                        <CardHeader className="relative z-10 items-center pb-2">
                          {merchant.logoUrl ? (
                            <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-white p-3 shadow-sm transition-transform duration-500 group-hover:scale-110">
                              <MerchantLogo
                                name={merchant.name}
                                logoUrl={merchant.logoUrl}
                                className="h-14 w-14 object-contain"
                                fallbackIcon="store"
                              />
                            </div>
                          ) : null}
                          <CardTitle className="text-center text-lg font-bold">
                            {merchant.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="relative z-10 pb-6 text-center">
                          <div className="inline-block rounded-full bg-primary/10 px-3 py-1">
                            <CardDescription className="text-sm font-bold text-primary">
                              Upto {merchant.cashbackRate}*
                            </CardDescription>
                          </div>
                        </CardContent>
                      </Card>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section
          id="tracked-history"
          className="border-b border-border/40 bg-background py-24"
        >
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
                Your Earning Dashboard
              </h2>
              <p className="text-lg text-muted-foreground">
                Total transparency. Watch your pending rewards transition to
                withdrawable cash in real time.
              </p>
            </div>

            <div className="mx-auto max-w-4xl rounded-3xl border border-border/50 bg-card p-6 shadow-xl md:p-10">
              {user ? (
                <TrackedHistory items={trackedItems} />
              ) : (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <TrendingUp className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="mb-3 text-2xl font-bold">
                    Track Your Progress
                  </h3>
                  <p className="mx-auto mb-8 max-w-md text-lg text-muted-foreground">
                    Sign in to view your cashback history, monitor pending
                    approvals, and request UPI payouts.
                  </p>
                  <Link
                    href="/sign-in"
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-lg transition-all hover:scale-105 hover:bg-primary/90"
                  >
                    Sign In to Dashboard
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        <div id="how-it-works" className="relative z-20 bg-background">
          <HeroCarousel favoritePlatform={favoritePlatform} />
        </div>

        <section id="faq" className="relative overflow-hidden bg-muted/5 py-24">
          <div className="container relative z-10 mx-auto max-w-4xl px-4">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
                How It All Works
              </h2>
              <p className="text-lg text-muted-foreground">
                Everything you need to know about earning and withdrawing with
                Fareback.
              </p>
            </div>
            <div className="grid gap-4">
              {[
                {
                  q: "How long does it take to track my purchase?",
                  a: "Purchases are typically tracked within 48 hours of completion. You'll see the transaction appear in your earning dashboard as pending once confirmed.",
                },
                {
                  q: "When can I withdraw my cashback rewards?",
                  a: "Rewards become available for withdrawal after the merchant return period ends, usually 30-60 days. Once confirmed, you can withdraw via UPI.",
                },
                {
                  q: "Is there a minimum withdrawal amount?",
                  a: "There is no minimum. You can request a UPI withdrawal for any approved amount in your wallet.",
                },
                {
                  q: "How do I ensure my purchase tracks correctly?",
                  a: "Start with an empty cart, click through Fareback, and complete your purchase in the same browser window without external coupon tools.",
                },
                {
                  q: "Do my credit card offers and merchant offers still apply?",
                  a: "Yes. Bank discounts, card offers, and merchant site-wide deals remain valid. Fareback cashback is designed to stack on top whenever the order is tracked successfully.",
                },
              ].map(({ q, a }) => (
                <Card
                  key={q}
                  className="group border-border/50 bg-background/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:shadow-md"
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-lg font-bold">
                      {q}
                      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base leading-relaxed text-muted-foreground">
                      {a}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="relative mt-20 overflow-hidden rounded-3xl border border-border/50 bg-card p-10 text-center shadow-2xl">
              <div className="absolute top-0 left-0 h-2 w-full bg-gradient-to-r from-primary to-amber-500" />
              <h2 className="mb-4 text-3xl font-bold">
                Ready to stop overpaying?
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
                Join smart shoppers earning real cashback on everyday purchases.
                It takes a few seconds to sign up.
              </p>
              {user ? (
                <ShopNowButton className="inline-flex items-center justify-center rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)] transition-all hover:scale-105 hover:bg-primary/90" />
              ) : (
                <Link
                  href="/sign-in"
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)] transition-all hover:scale-105 hover:bg-primary/90"
                >
                  Create Free Account
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Page;
