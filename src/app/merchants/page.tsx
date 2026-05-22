import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ShieldCheck,
  ShoppingCart,
  Store,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { COMING_SOON_MERCHANT_NAMES, getMerchantById } from "@/lib/data/merchants";
import TrackingRedirectButton from "@/components/tracking-redirect-button";

const activeBrandConfig: Record<
  string,
  { brandColor: string; bgGlow: string; icon: LucideIcon }
> = {
  amazon: {
    brandColor: "text-orange-500",
    bgGlow: "bg-orange-500/10",
    icon: ShoppingCart,
  },
};

interface MerchantsPageProps {
  searchParams: Promise<{ merchantId?: string }>;
}

const MerchantsPage = async ({ searchParams }: MerchantsPageProps) => {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/sign-in?redirect=/merchants${params.merchantId ? `?merchantId=${params.merchantId}` : ""}`);
  }

  let merchant = null;
  let brandVisuals: { brandColor: string; bgGlow: string; icon: LucideIcon } = {
    brandColor: "text-primary",
    bgGlow: "bg-primary/10",
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

  return (
    <div className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center overflow-hidden px-4 py-12">
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full blur-[120px] -z-10 ${brandVisuals.bgGlow} animate-pulse`}
      />

      <div className="w-full max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-background/60 p-8 text-center shadow-2xl backdrop-blur-xl md:p-10 space-y-8">
          <div
            className={`absolute top-0 left-0 h-1 w-full opacity-50 ${brandVisuals.bgGlow.replace("/10", "/50")}`}
          />

          <div className="flex justify-center">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <div
                className={`absolute inset-0 rounded-full border-2 border-dashed opacity-30 animate-[spin_4s_linear_infinite] ${brandVisuals.brandColor}`}
              />
              <div
                className={`absolute inset-2 rounded-full border opacity-20 animate-ping ${brandVisuals.brandColor}`}
              />
              <div className={`relative rounded-full border bg-background p-4 shadow-sm ${brandVisuals.brandColor}`}>
                <ShieldCheck className="h-10 w-10" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              Tracking Securely Activated
            </h1>
            <p className="text-lg text-muted-foreground">
              Your session is locked. We are ready to track your cashback and Amazon rewards.
            </p>
          </div>

          <div className="space-y-4 rounded-xl border border-border/50 bg-secondary/50 p-6 text-left">
            {merchant ? (
              <div className="flex items-start gap-4">
                <div className={`rounded-lg border bg-background p-3 shadow-sm ${brandVisuals.brandColor}`}>
                  <BrandIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Routing to {merchant.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {merchant.name.trim().toLowerCase() === "amazon" ? (
                      <>
                        Earn up to <strong className="text-foreground">{merchant.cashbackRate}</strong> as Amazon gift card rewards on your purchase today.
                      </>
                    ) : (
                      <>
                        Earn up to <strong className="text-foreground">{merchant.cashbackRate}</strong> on your purchase today.
                      </>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Browse our partner stores and start earning cashback or Amazon rewards on every purchase.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {merchant ? (
              <TrackingRedirectButton
                merchantId={merchant.id}
                merchantName={merchant.name}
                isAmazon={merchant.name.trim().toLowerCase() === "amazon"}
              />
            ) : null}

            <Link
              href="/#offers"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-8 py-4 text-base font-semibold transition-all hover:bg-accent hover:text-accent-foreground"
            >
              Browse All Stores
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>

          <p className="pt-4 text-xs font-medium text-muted-foreground">
            Ensure your cart is empty before clicking to help guarantee your rewards.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MerchantsPage;
