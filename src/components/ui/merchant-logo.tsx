"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Store, ShoppingBag } from "lucide-react";

interface MerchantLogoProps {
  name: string;
  logoUrl?: string | null;
  className?: string;
  fallbackIcon?: "store" | "bag";
}

export default function MerchantLogo({
  name,
  logoUrl,
  className = "h-8 w-8 object-contain",
  fallbackIcon = "store",
}: MerchantLogoProps) {
  const [errorCount, setErrorCount] = useState(0);

  const getLocalSlug = (merchantName: string) => {
    if (!merchantName) return null;
    const clean = merchantName.toLowerCase().trim();
    if (clean.includes("amazon")) return "amazon";
    if (clean.includes("flipkart")) return "flipkart";
    if (clean.includes("myntra")) return "myntra";
    if (clean.includes("ajio")) return "ajio";
    if (clean.includes("nykaa")) return "nykaa";
    if (clean.includes("meesho")) return "meesho";
    if (clean.includes("snapdeal")) return "snapdeal";
    if (clean.includes("tata")) return "tatacliq";
    return null;
  };

  const slug = getLocalSlug(name);
  const localSvgUrl = slug ? `/merchants/${slug}.svg` : null;

  // Step 0: Always try local same-origin SVG first (NEVER blocked by mobile ad-blockers or DNS)
  // Step 1: If local SVG fails, try Clearbit CDN
  // Step 2: Try original DB logoUrl
  let effectiveUrl: string | null = null;

  if (errorCount === 0) {
    effectiveUrl = localSvgUrl || logoUrl || null;
  } else if (errorCount === 1) {
    const domain = slug === "tatacliq" ? "tatacliq.com" : slug === "amazon" ? "amazon.in" : slug ? `${slug}.com` : null;
    effectiveUrl = domain ? `https://logo.clearbit.com/${domain}` : logoUrl || null;
  } else if (errorCount === 2) {
    effectiveUrl = logoUrl || null;
  }

  if (!effectiveUrl || errorCount > 2) {
    const Icon = fallbackIcon === "bag" ? ShoppingBag : Store;
    return <Icon className="h-5 w-5 text-muted-foreground/70" />;
  }

  return (
    <img
      src={effectiveUrl}
      alt={`${name} logo`}
      className={className}
      onError={() => setErrorCount((prev) => prev + 1)}
      loading="lazy"
    />
  );
}
