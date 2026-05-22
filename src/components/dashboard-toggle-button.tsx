"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, X } from "lucide-react";

const DashboardToggleButton = () => {
  const pathname = usePathname();
  const isDashboardOpen = pathname.startsWith("/dashboard");

  return (
    <Link
      href={isDashboardOpen ? "/" : "/dashboard"}
      className={`group flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300 ${
        isDashboardOpen
          ? "border-border/50 bg-secondary/50 text-foreground hover:bg-secondary"
          : "border-primary/20 bg-primary/10 text-primary hover:border-primary/50 hover:bg-primary/20 hover:shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
      }`}
    >
      {isDashboardOpen ? (
        <>
          <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
          <span className="hidden sm:inline">Close</span>
        </>
      ) : (
        <>
          <LayoutDashboard className="h-4 w-4 transition-transform group-hover:scale-110" />
          <span className="hidden sm:inline">Dashboard</span>
        </>
      )}
    </Link>
  );
};

export default DashboardToggleButton;
