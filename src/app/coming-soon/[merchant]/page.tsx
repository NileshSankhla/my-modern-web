import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  ShoppingBag,
  Shirt,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type MerchantSlug = "flipkart" | "myntra" | "ajio";

const brandConfig: Record<
  MerchantSlug,
  {
    name: string;
    brandColor: string;
    bgGlow: string;
    buttonClass: string;
    icon: typeof ShoppingBag;
    tagline: string;
    description: string;
  }
> = {
  flipkart: {
    name: "Flipkart",
    brandColor: "text-blue-600 dark:text-blue-400",
    bgGlow: "bg-blue-500/10",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
    icon: ShoppingBag,
    tagline: "The Big Billion Days of cashback are almost here.",
    description:
      "We are finalizing our partnership with Flipkart to bring you strong rewards on electronics, home goods, and more.",
  },
  myntra: {
    name: "Myntra",
    brandColor: "text-pink-500 dark:text-pink-400",
    bgGlow: "bg-pink-500/10",
    buttonClass: "bg-pink-500 hover:bg-pink-600 text-white",
    icon: Shirt,
    tagline: "India's fashion cashback experience is getting ready.",
    description:
      "Get your wishlists ready. We are integrating Myntra so you can earn cashback on top fashion brands.",
  },
  ajio: {
    name: "AJIO",
    brandColor: "text-slate-900 dark:text-slate-100",
    bgGlow: "bg-slate-500/10",
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

export async function generateMetadata({ params }: ComingSoonPageProps): Promise<Metadata> {
  const { merchant } = await params;
  const slug = merchant.toLowerCase() as MerchantSlug;
  const brand = brandConfig[slug];

  return {
    title: brand ? `${brand.name} Coming Soon` : "Merchant Coming Soon",
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
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Merchant Not Found</h1>
        <p className="text-muted-foreground mb-6">
          We could not find the store you are looking for.
        </p>
        <Button variant="outline" asChild>
          <Link href="/">Return Home</Link>
        </Button>
      </div>
    );
  }

  const BrandIcon = brand.icon;

  return (
    <div className="relative min-h-[85vh] flex flex-col items-center justify-center overflow-hidden px-4">
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[100px] -z-10 ${brand.bgGlow} transition-colors duration-700`}
      />

      <div className="w-full max-w-lg mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-center">
          <div
            className={`relative flex items-center justify-center w-24 h-24 rounded-full bg-background border shadow-lg ${brand.brandColor}`}
          >
            <BrandIcon className="w-10 h-10 animate-bounce" style={{ animationDuration: "3s" }} />
            <div
              className={`absolute inset-0 rounded-full border-2 opacity-20 animate-ping ${brand.brandColor}`}
              style={{ animationDuration: "2s" }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            <span className={brand.brandColor}>{brand.name}</span> is coming to Fareback
          </h1>
          <p className="text-xl font-medium text-foreground/80">{brand.tagline}</p>
          <p className="text-muted-foreground leading-relaxed">{brand.description}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button className={`w-full sm:w-auto h-12 px-8 text-base font-semibold ${brand.buttonClass}`} asChild>
            <a href={`mailto:support@fareback.in?subject=Notify%20me%20for%20${encodeURIComponent(brand.name)}`}>
              <Bell className="w-4 h-4 mr-2" />
              Notify Me When Live
            </a>
          </Button>

          <Button variant="outline" className="w-full sm:w-auto h-12 px-8" asChild>
            <Link href="/#offers">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Explore Active Offers
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonPage;
