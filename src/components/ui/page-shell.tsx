"use client";

import React from "react";
import { cn } from "@/lib/utils";

export default function PageShell({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        // Mobile: pb-20 to clear the fixed bottom nav. Desktop: no extra bottom padding.
        // fade-in-up: subtle entrance animation on every page load.
        "min-h-[100dvh] w-full bg-background px-4 pt-6 pb-20 md:pb-8 fade-in-up",
        className,
      )}
    >
      {/* Use a max-width container for comfortable reading on large screens */}
      <div className="container mx-auto max-w-7xl">{children}</div>
    </div>
  );
}
