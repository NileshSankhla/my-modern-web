"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, Wallet, User, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    name: "Home",
    href: "/",
    icon: Home,
    exact: true,
  },
  {
    name: "Stores",
    href: "/stores",
    icon: Store,
    exact: false,
  },
  {
    name: "Wallet",
    href: "/dashboard",
    icon: Wallet,
    exact: false,
  },
  {
    name: "Earnings",
    href: "/earnings",
    icon: LayoutDashboard,
    exact: false,
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
    exact: false,
  },
];

export default function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border/40 bg-background/95 px-1 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/") || pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-all duration-200",
              isActive
                ? "text-primary"
                : "text-muted-foreground active:text-foreground",
            )}
          >
            {/* Active indicator pill */}
            {isActive && (
              <span className="absolute top-0.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-primary/60" />
            )}
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
                isActive ? "bg-primary/12 scale-110" : "",
              )}
            >
              <Icon
                className={cn("h-5 w-5", isActive && "fill-primary/15")}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
            </div>
            <span
              className={cn(
                "text-[9px] font-semibold leading-tight tracking-wide",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              {item.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
