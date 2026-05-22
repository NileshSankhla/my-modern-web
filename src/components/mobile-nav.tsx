"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    name: "Home",
    href: "/",
    icon: Home,
  },
  {
    name: "Stores",
    href: "/stores",
    icon: Store,
  },
  {
    name: "Earnings",
    href: "/earnings",
    icon: Wallet,
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
  },
];

export default function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border/40 bg-background/80 px-2 pb-safe pt-1 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", isActive && "fill-primary/20")} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
