"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Loader2, LayoutDashboard } from "lucide-react";

export function HowItWorksButton({ className }: { className?: string }) {
  const handleClick = () => {
    const element = document.getElementById("how-it-works");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={className || "inline-flex w-full items-center justify-center rounded-xl border-2 border-border bg-background/50 px-8 py-4 text-base font-semibold backdrop-blur-sm transition-all hover:scale-105 hover:bg-accent hover:text-accent-foreground sm:w-auto"}
    >
      See How It Works
    </button>
  );
}

export function ShopNowButton({ className }: { className?: string }) {
  const handleClick = () => {
    const element = document.getElementById("offers");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={className || "group relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)] transition-all hover:scale-105 hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)] sm:w-auto"}
    >
      <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:animate-[shimmer_1s_forwards] group-hover:duration-1000">
        <div className="relative h-full w-8 bg-white/20" />
      </div>
      <span className="relative">Start Shopping Now</span>
    </button>
  );
}

export function TrackingRedirectButton({
  merchantName,
  merchantId,
  isAmazon,
}: {
  merchantName: string;
  merchantId: number;
  isAmazon?: boolean;
}) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleRedirect = () => {
    if (isRedirecting) return;

    setIsRedirecting(true);
    window.open(`/api/redirect?merchantId=${merchantId}`, "_blank", "noopener,noreferrer");

    setTimeout(() => setIsRedirecting(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleRedirect}
      disabled={isRedirecting}
      className={`group relative inline-flex items-center justify-center rounded-xl px-8 py-4 text-base font-bold text-white shadow-lg transition-all overflow-hidden w-full sm:w-auto ${
        isRedirecting ? "cursor-not-allowed opacity-90" : "hover:shadow-xl hover:-translate-y-0.5"
      } ${
        isAmazon
          ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
          : "bg-primary hover:bg-primary/90"
      }`}
    >
      <span className="relative z-10 flex items-center">
        {isRedirecting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {isAmazon ? "Locking Session & Tracking Rewards..." : "Locking Session & Redirecting..."}
          </>
        ) : (
          <>
            Continue to {merchantName}
            <ExternalLink className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </>
        )}
      </span>
    </button>
  );
}

export function DashboardToggleButton() {
  const pathname = usePathname();
  const router = useRouter();
  const isDashboardOpen = pathname.startsWith("/dashboard");

  const handleClick = () => {
    if (isDashboardOpen) {
      router.push("/");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`group relative hidden h-10 w-10 items-center justify-center rounded-full border transition-all duration-300 sm:flex ${
        isDashboardOpen
          ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_hsl(var(--primary)/0.15)]"
          : "border-border/50 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:shadow-[0_0_15px_hsl(var(--primary)/0.15)]"
      }`}
      aria-label={isDashboardOpen ? "Return to home" : "Open dashboard"}
    >
      <LayoutDashboard className="h-5 w-5 transition-transform group-hover:scale-110" />
    </button>
  );
}
