"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  breadcrumbCurrent,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  breadcrumbCurrent?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const formatSegment = (href: string) => {
    const clean = href.replace(/^\//, "").replace(/\?.*/, "").replace(/-/g, " ");
    return clean || "Home";
  };

  return (
    <div className={cn("mb-6 flex flex-col gap-2", className)}>
      {/* Desktop Breadcrumbs */}
      {backHref ? (
        <nav aria-label="Breadcrumb" className="hidden md:flex items-center space-x-2 text-xs font-semibold text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span>/</span>
          {backHref === "/stores" ? (
            <Link href="/stores" className="hover:text-primary transition-colors">Stores</Link>
          ) : (
            <Link href={backHref} className="hover:text-primary transition-colors capitalize">
              {backLabel || formatSegment(backHref)}
            </Link>
          )}
          {(title && typeof title === "string" && title.length > 0) || breadcrumbCurrent ? (
            <>
              <span>/</span>
              <span className="text-foreground">{breadcrumbCurrent || title}</span>
            </>
          ) : null}
        </nav>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors border border-border/40 bg-background/80"
              aria-label={backLabel || "Go back"}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : null}

          {(title && title !== "") || subtitle ? (
            <div>
              {title && title !== "" ? <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1> : null}
              {subtitle ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
