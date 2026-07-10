import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  ShoppingBag,
  Shirt,
  Sparkles,
  ArrowRight,
} from "lucide-react";

import PageShell from "@/components/ui/page-shell";
import PageHeader from "@/components/ui/page-header";

type MerchantSlug = "flipkart" | "myntra" | "ajio";

const brandConfig: Record<
  MerchantSlug,
  {
    name: string;
    brandColor: string;
    bgGradient: string;
    buttonClass: string;
    icon: typeof ShoppingBag;
    tagline: string;
    description: string;
  }
> = {
  flipkart: {
    name: "Flipkart",
    brandColor: "text-blue-600 dark:text-blue-400",
    bgGradient: "from-blue-500/15 to-blue-500/5",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
    icon: ShoppingBag,
    tagline: "The Big Billion Days of cashback are almost here.",
    description:
      "We are finalizing our partnership with Flipkart to bring you strong rewards on electronics, home goods, and more.",
  },
  myntra: {
    name: "Myntra",
    brandColor: "text-pink-500 dark:text-pink-400",
    bgGradient: "from-pink-500/15 to-pink-500/5",
    buttonClass: "bg-pink-500 hover:bg-pink-600 text-white",
    icon: Shirt,
    tagline: "India's fashion cashback experience is getting ready.",
    description:
      "Get your wishlists ready. We are integrating Myntra so you can earn cashback on top fashion brands.",
  },
  ajio: {
    name: "AJIO",
    brandColor: "text-slate-900 dark:text-slate-100",
    bgGradient: "from-slate-500/15 to-slate-500/5",
    buttonClass:
      "bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-black text-white",
    icon: Sparkles,
    tagline: "Premium rewards are coming in.",
    description:
      "Exclusive cashback rates for AJIO are currently in progress. Elevate your wardrobe with Fareback very soon.",
  },
};

interface ComingSoonPageProps {
  params: Promise<{ merchant: string }>;
}

export async function generateMetadata({
  params,
}: ComingSoonPageProps): Promise<Metadata> {
  const { merchant } = await params;
  const slug = merchant.toLowerCase() as MerchantSlug;
  const brand = brandConfig[slug];

  return {
    title: brand
      ? `${brand.name} Coming Soon | Fareback`
      : "Merchant Coming Soon | Fareback",
    description: brand
      ? `${brand.name} cashback offers are coming soon on Fareback.`
      : "Merchant cashback offers are coming soon on Fareback.",
  };
}

const ComingSoonPage = async ({ params }: ComingSoonPageProps) => {
  const { merchant } = await params;
  const merchantSlug = merchant.toLowerCase() as MerchantSlug;
  const brand = brandConfig[merchantSlug];

  if (!brand) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="mb-4 h-14 w-14 text-muted-foreground" />
          <h1 className="text-xl font-bold">Merchant Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We could not find the store you are looking for.
          </p>
          <Link
            href="/stores"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Browse Stores
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </PageShell>
    );
  }

  const BrandIcon = brand.icon;

  return (
    <PageShell>
      <PageHeader backHref="/stores" backLabel="Stores" title="" breadcrumbCurrent={`${brand.name} (Coming Soon)`} />

      <div className="flex flex-col items-center text-center">
        {/* Brand card */}
        <div
          className={`mb-6 w-full rounded-2xl bg-gradient-to-br ${brand.bgGradient} border border-border/50 p-8`}
        >
          <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-current bg-background shadow-md">
            <BrandIcon
              className={`h-9 w-9 animate-bounce ${brand.brandColor}`}
              style={{ animationDuration: "3s" }}
            />
            <div
              className={`absolute inset-0 animate-ping rounded-full border-2 opacity-15 ${brand.brandColor}`}
              style={{ animationDuration: "2s" }}
            />
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className={brand.brandColor}>{brand.name}</span> is coming to
            Fareback
          </h1>
          <p className="mt-2 text-sm font-medium text-foreground/70">
            {brand.tagline}
          </p>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          {brand.description}
        </p>

        {/* CTA buttons */}
        <div className="flex w-full flex-col gap-3">
          <a
            href={`mailto:support@fareback.in?subject=Notify%20me%20for%20${encodeURIComponent(brand.name)}`}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-bold shadow-sm transition-all active:scale-[0.98] ${brand.buttonClass}`}
          >
            <Bell className="h-4 w-4" />
            Notify Me When Live
          </a>
          <Link
            href="/stores"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/50 bg-card px-6 py-4 text-sm font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Explore Active Stores
          </Link>
        </div>
      </div>
    </PageShell>
  );
};

export default ComingSoonPage;
