import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ShieldCheck,
  ShoppingCart,
  Store,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import PageShell from "@/components/ui/page-shell";
import PageHeader from "@/components/ui/page-header";
import {
  COMING_SOON_MERCHANT_NAMES,
  getMerchantById,
} from "@/lib/data/merchants";
import { TrackingRedirectButton } from "@/components/action-buttons";
import {
  PRIMARY_AMAZON_AFFILIATE_URL,
  PRIMARY_AMAZON_MERCHANT_ID,
} from "@/lib/affiliate-rotation";

const activeBrandConfig: Record<
  string,
  { brandColor: string; bgGlow: string; ringColor: string; icon: LucideIcon }
> = {
  amazon: {
    brandColor: "text-orange-500",
    bgGlow: "from-orange-500/20 to-amber-500/5",
    ringColor: "border-orange-500/30",
    icon: ShoppingCart,
  },
};

interface MerchantsPageProps {
  searchParams: Promise<{ merchantId?: string }>;
}

async function MerchantsPage({ searchParams }: MerchantsPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();

  let merchant = null;
  let brandVisuals: {
    brandColor: string;
    bgGlow: string;
    ringColor: string;
    icon: LucideIcon;
  } = {
    brandColor: "text-primary",
    bgGlow: "from-primary/20 to-primary/5",
    ringColor: "border-primary/30",
    icon: Store,
  };

  if (params.merchantId) {
    const merchantId = parseInt(params.merchantId, 10);
    if (!isNaN(merchantId)) {
      merchant = await getMerchantById(merchantId);

      if (merchant) {
        const merchantSlug = merchant.name.trim().toLowerCase();
        if (COMING_SOON_MERCHANT_NAMES.has(merchantSlug)) {
          redirect(`/coming-soon/${merchantSlug}`);
        }

        if (activeBrandConfig[merchantSlug]) {
          brandVisuals = activeBrandConfig[merchantSlug];
        }
      }
    }
  }

  const BrandIcon = brandVisuals.icon;
  const merchantSlug = merchant?.name.trim().toLowerCase();
  const isAmazonMerchant =
    merchantSlug === "amazon" ||
    (params.merchantId
      ? Number(params.merchantId) === PRIMARY_AMAZON_MERCHANT_ID
      : false);
  const signInHref = `/sign-in?redirect=/merchants${
    params.merchantId ? `?merchantId=${params.merchantId}` : ""
  }`;

  return (
    <PageShell className="flex min-h-[100dvh] flex-col">
      <PageHeader backHref="/stores" backLabel="Stores" title="" breadcrumbCurrent={merchant?.name || "Store Details"} />

      {/* Brand hero card */}
      <div
        className={`relative overflow-hidden rounded-2xl border ${brandVisuals.ringColor} bg-gradient-to-br ${brandVisuals.bgGlow} p-6 text-center shadow-sm`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />

        {/* Shield animation */}
        <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
          <div
            className={`absolute inset-0 animate-ping rounded-full border opacity-20 ${brandVisuals.brandColor}`}
            style={{ animationDuration: "2s" }}
          />
          <div
            className={`absolute inset-1 animate-[spin_6s_linear_infinite] rounded-full border-2 border-dashed opacity-30 ${brandVisuals.brandColor}`}
          />
          <div
            className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 bg-background shadow-md ${brandVisuals.ringColor}`}
          >
            <ShieldCheck className={`h-7 w-7 ${brandVisuals.brandColor}`} />
          </div>
        </div>

        <h1 className="text-xl font-extrabold tracking-tight text-foreground">
          Tracking Activated
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {user
            ? "Your session is locked and ready to track your cashback."
            : "View the store now. Sign in to enable rewards tracking."}
        </p>

        {merchant && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border/40 bg-background/70 px-4 py-2 backdrop-blur-sm">
            <BrandIcon className={`h-4 w-4 ${brandVisuals.brandColor}`} />
            <span className="text-sm font-bold text-foreground">
              {merchant.name}
            </span>
            {isAmazonMerchant ? (
              <span className="text-xs font-semibold text-orange-500">
                · Amazon Rewards
              </span>
            ) : (
              <span className={`text-xs font-semibold ${brandVisuals.brandColor}`}>
                · {merchant.cashbackRate} Cashback
              </span>
            )}
          </div>
        )}
      </div>

      {/* Info box */}
      {merchant && (
        <div className="mt-4 rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isAmazonMerchant ? (
              <>
                Earn up to{" "}
                <strong className="text-foreground font-bold">
                  {merchant.cashbackRate}
                </strong>{" "}
                as Amazon gift card rewards on your purchase today.
              </>
            ) : (
              <>
                Earn up to{" "}
                <strong className="text-foreground font-bold">
                  {merchant.cashbackRate}
                </strong>{" "}
                cashback credited to your Fareback wallet.
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            💡 Ensure your cart is empty before clicking to help guarantee your rewards.
          </p>
          {isAmazonMerchant && (
            <p className="mt-3 text-[10px] text-muted-foreground/80 italic text-center">
              As an Amazon Associate I earn from qualifying purchases.
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex flex-col gap-3">
        {user && merchant ? (
          <TrackingRedirectButton
            merchantId={merchant.id}
            merchantName={merchant.name}
            isAmazon={isAmazonMerchant}
          />
        ) : !user && isAmazonMerchant ? (
          <a
            href={PRIMARY_AMAZON_AFFILIATE_URL}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-xl px-6 py-4 text-base font-bold text-white shadow-md transition-all bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98]"
          >
            Continue to Amazon
            <ArrowRight className="ml-2 h-5 w-5" />
          </a>
        ) : null}

        {!user && (
          <a
            href={signInHref}
            className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-card px-6 py-4 text-base font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98]"
          >
            Sign In to Track Rewards
          </a>
        )}

        <Link
          href="/stores"
          className="inline-flex w-full items-center justify-center rounded-xl border border-border/50 bg-background px-6 py-3.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-muted active:scale-[0.98]"
        >
          Browse All Stores
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>

      {/* Cashback tips */}
      <div className="mt-4 rounded-2xl border border-border/50 bg-muted/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Tracking Tips
          </p>
        </div>
        <ul className="space-y-1">
          {[
            "Start with an empty cart",
            "Don't use coupon browser extensions",
            "Complete purchase in the same browser session",
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-0.5 text-primary">•</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}

export default MerchantsPage;
