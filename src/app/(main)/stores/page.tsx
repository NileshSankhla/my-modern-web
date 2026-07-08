import Link from "next/link";
import Image from "next/image";
import MerchantLogo from "@/components/ui/merchant-logo";
import { Store, ChevronRight, Sparkles, TrendingUp, Wallet, ArrowRight } from "lucide-react";
import {
  getAllMerchants,
  SUPPORTED_MERCHANT_NAMES,
  COMING_SOON_MERCHANT_NAMES,
} from "@/lib/data/merchants";
import PageShell from "@/components/ui/page-shell";
import PageHeader from "@/components/ui/page-header";

export default async function StoresPage() {
  let merchantList: any[] = [];
  try {
    merchantList = await getAllMerchants();
  } catch (error) {
    console.error("Failed to fetch merchants:", error);
  }

  const visibleMerchantList = merchantList.filter((merchant) =>
    SUPPORTED_MERCHANT_NAMES.has(merchant.name.trim().toLowerCase()),
  );

  return (
    <PageShell>
      <PageHeader
        title="All Stores"
        subtitle={`${visibleMerchantList.length} partner stores with guaranteed cashback`}
      />

      <div className="space-y-2">
        {visibleMerchantList.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-card py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Store className="h-8 w-8 text-primary" />
            </div>
            <p className="font-semibold text-foreground">
              No stores available yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check back soon for partner stores
            </p>
          </div>
        ) : (
          visibleMerchantList.map((merchant) => {
            const merchantNameKey = merchant.name.trim().toLowerCase();
            const isComingSoon =
              COMING_SOON_MERCHANT_NAMES.has(merchantNameKey);
            const merchantHref = isComingSoon
              ? `/coming-soon/${merchantNameKey}`
              : `/merchants?merchantId=${merchant.id}`;

            return (
              <Link
                key={merchant.id}
                href={merchantHref}
                className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-all active:scale-[0.98] hover:border-primary/30 hover:bg-muted/30"
              >
                {/* Logo */}
                <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-white p-2 shadow-sm">
                  <MerchantLogo
                    name={merchant.name}
                    logoUrl={merchant.logoUrl}
                    className="h-9 w-9 object-contain"
                    fallbackIcon="store"
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold leading-tight text-foreground">
                    {merchant.name}
                  </h3>
                  {isComingSoon ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      <Sparkles className="h-2.5 w-2.5" />
                      Coming Soon
                    </span>
                  ) : (
                    <p className="mt-0.5 text-xs font-semibold text-primary">
                      Upto {merchant.cashbackRate} Cashback
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })
        )}
      </div>

      {/* Seamless Ecosystem Navigation */}
      <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/earnings"
            className="group flex items-center justify-between rounded-xl border border-border/50 bg-background/80 p-4 transition-all hover:border-primary/40 hover:bg-muted/40 hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-sm">My Earnings &amp; History</h4>
                <p className="text-xs text-muted-foreground">Track your pending &amp; confirmed cashback.</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </Link>

          <Link
            href="/#withdraw"
            className="group flex items-center justify-between rounded-xl border border-border/50 bg-background/80 p-4 transition-all hover:border-success/40 hover:bg-muted/40 hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-sm">Withdraw to Bank / UPI</h4>
                <p className="text-xs text-muted-foreground">Transfer your confirmed cashback instantly.</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-success" />
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
