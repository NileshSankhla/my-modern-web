import Link from "next/link";
import { ArrowRight, ShieldCheck, ShoppingBag, Sparkles, Zap } from "lucide-react";

type HeroMerchant = {
  id: number;
  name: string;
  cashbackRate: string;
  href: string;
};

interface HeroProps {
  featuredMerchants: HeroMerchant[];
}

const getMerchantTone = (name: string) => {
  const normalized = name.trim().toLowerCase();

  if (normalized === "amazon") {
    return {
      border: "border-orange-500/25",
      background: "bg-orange-500/5",
      hoverBackground: "group-hover:bg-orange-500/10",
      iconBackground: "bg-orange-500/10",
      rateText: "text-orange-600 dark:text-orange-400",
      glow: "group-hover:shadow-[0_0_24px_rgba(249,115,22,0.18)]",
    };
  }

  if (normalized === "flipkart") {
    return {
      border: "border-blue-500/25",
      background: "bg-blue-500/5",
      hoverBackground: "group-hover:bg-blue-500/10",
      iconBackground: "bg-blue-500/10",
      rateText: "text-blue-600 dark:text-blue-400",
      glow: "group-hover:shadow-[0_0_24px_rgba(59,130,246,0.18)]",
    };
  }

  if (normalized === "myntra") {
    return {
      border: "border-pink-500/25",
      background: "bg-pink-500/5",
      hoverBackground: "group-hover:bg-pink-500/10",
      iconBackground: "bg-pink-500/10",
      rateText: "text-pink-600 dark:text-pink-400",
      glow: "group-hover:shadow-[0_0_24px_rgba(236,72,153,0.18)]",
    };
  }

  return {
    border: "border-border/50",
    background: "bg-card/80",
    hoverBackground: "group-hover:bg-muted/70",
    iconBackground: "bg-muted",
    rateText: "text-primary",
    glow: "group-hover:shadow-[0_0_24px_rgba(0,0,0,0.08)]",
  };
};

const defaultMarqueeItems = [
  { name: "Amazon", rate: "Up to 5.0%" },
  { name: "Flipkart", rate: "Up to 3.7%" },
  { name: "Myntra", rate: "Up to 4.0%" },
  { name: "AJIO", rate: "Up to 6.0%" },
  { name: "Croma", rate: "Up to 2.5%" },
];

const Hero = ({ featuredMerchants }: HeroProps) => {
  const marqueeItems =
    featuredMerchants.length > 0
      ? featuredMerchants.map((merchant) => ({ name: merchant.name, rate: merchant.cashbackRate }))
      : defaultMarqueeItems;

  const repeatedMarqueeItems = [...marqueeItems, ...marqueeItems];

  return (
    <section className="relative isolate overflow-hidden border-b border-border/40 bg-background pt-[5.5rem] pb-10 sm:pt-24 sm:pb-14">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-12 h-24 overflow-hidden opacity-20 sm:top-16 sm:h-28">
          <div className="animate-marquee flex w-max whitespace-nowrap will-change-transform">
            {repeatedMarqueeItems.map((item, index) => (
              <span
                key={`${item.name}-${index}`}
                className="mx-4 inline-flex items-center gap-3 text-3xl font-black tracking-tight text-transparent sm:text-5xl"
              >
                <span className="bg-gradient-to-r from-muted-foreground/25 via-muted-foreground/15 to-muted-foreground/5 bg-clip-text">
                  {item.name}
                </span>
                <span className="text-base font-semibold text-primary/50 sm:text-xl">
                  {item.rate}
                </span>
                <span className="text-primary/20">•</span>
              </span>
            ))}
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[90px] sm:h-[560px] sm:w-[560px] sm:blur-[140px]" />
        <div className="absolute -right-24 top-28 h-56 w-56 rounded-full bg-amber-400/10 blur-[90px] sm:h-72 sm:w-72" />
        <div className="absolute -left-28 bottom-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-[100px] sm:h-72 sm:w-72" />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 text-left sm:items-center sm:text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700 backdrop-blur-md dark:text-emerald-300 sm:text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% Secure UPI Payouts
          </div>

          <h1 className="max-w-3xl text-[clamp(2.45rem,9vw,4.9rem)] font-black leading-[0.9] tracking-tight text-foreground">
            Shop top stores and get paid back without leaving the fold.
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-lg">
            Start with Amazon or Flipkart below, shop like normal, and move straight into tracked cashback, Amazon rewards, and UPI withdrawals.
          </p>

          <div className="w-full max-w-4xl pt-2">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.26em] text-muted-foreground sm:text-xs">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Start earning now
              </div>
              <span className="hidden text-sm text-muted-foreground sm:inline-flex">Live merchant shortcuts</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              {featuredMerchants.map((merchant) => {
                const tone = getMerchantTone(merchant.name);
                const initials = merchant.name.charAt(0).toUpperCase();
                const isAmazon = merchant.name.trim().toLowerCase() === "amazon";

                return (
                  <Link
                    key={merchant.id}
                    href={merchant.href}
                    className={`group relative flex min-h-32 flex-col items-center justify-center overflow-hidden rounded-2xl border ${tone.border} ${tone.background} p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 ${tone.glow} ${tone.hoverBackground}`}
                    aria-label={`Shop at ${merchant.name} and earn ${merchant.cashbackRate} ${isAmazon ? "Amazon rewards" : "cashback"}`}
                  >
                    <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-white shadow-sm ${tone.iconBackground}`}>
                      <span className="text-lg font-black text-foreground">{initials}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground sm:text-base">{merchant.name}</span>
                    <span className={`mt-1 text-xs font-semibold ${tone.rateText} sm:text-sm`}>
                      Upto {merchant.cashbackRate}* {isAmazon ? "Amazon rewards" : "cashback"}
                    </span>
                  </Link>
                );
              })}

              <Link
                href="/#offers"
                className="group relative flex min-h-32 flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:bg-muted/70 hover:shadow-[0_0_24px_rgba(0,0,0,0.08)]"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary/10">
                  <ShoppingBag className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <span className="text-sm font-bold text-foreground sm:text-base">View all</span>
                <span className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">All merchant offers</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1 text-xs text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              No minimum withdrawal
            </span>
            <span>•</span>
            <span>Cashback for most stores, Amazon rewards as gift cards</span>
            <span>•</span>
            <span>UPI to bank</span>
          </div>

          <div className="pt-1 text-xs text-muted-foreground sm:text-sm">
            Secure tracking starts the moment you tap a store.
            <Link href="/sign-in" className="ml-1 font-medium text-primary hover:underline">
              Create a free account <ArrowRight className="ml-0.5 inline h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;