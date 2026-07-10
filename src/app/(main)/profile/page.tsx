import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  User,
  CreditCard,
  ShoppingBag,
  Receipt,
  HelpCircle,
  LogOut,
  ChevronRight,
  Info,
  BadgeCheck,
  Wallet,
  Bell,
  FileText,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { signOutAction } from "@/app/actions/auth";
import PageShell from "@/components/ui/page-shell";
import PageHeader from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { wallets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatPaiseAsINR } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Profile | Fareback",
  description: "Your Fareback profile, account settings, and payment history.",
};

const MENU_GROUPS = [
  {
    title: "Account",
    items: [
      {
        icon: User,
        label: "Account Details",
        href: "/profile/account",
        description: "Name, email, member since",
      },
      {
        icon: CreditCard,
        label: "Wallet & Withdrawals",
        href: "/dashboard",
        description: "Request UPI payout or gift card",
      },
    ],
  },
  {
    title: "Activity",
    items: [
      {
        icon: ShoppingBag,
        label: "My Orders",
        href: "/earnings",
        description: "Tracked cashback transactions",
      },
      {
        icon: Receipt,
        label: "Payment History",
        href: "/profile/payment-history",
        description: "All withdrawals & gift card requests",
      },
    ],
  },
  {
    title: "App",
    items: [
      {
        icon: Bell,
        label: "Notifications",
        href: "/notifications",
        description: "Alerts from Fareback",
      },
      {
        icon: Info,
        label: "How It Works",
        href: "/how-it-works",
        description: "Learn how to earn cashback",
      },
      {
        icon: HelpCircle,
        label: "Help & Support",
        href: "/profile/help",
        description: "FAQs, contact us",
      },
    ],
  },
  {
    title: "Legal",
    items: [
      {
        icon: FileText,
        label: "Privacy Policy",
        href: "/privacy",
        description: "How we handle your data",
      },
      {
        icon: FileText,
        label: "Terms of Service",
        href: "/terms",
        description: "Rules for using Fareback",
      },
    ],
  },
];

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect=/profile");
  }

  // Fetch wallet balance for display
  const userWallets = await db
    .select({
      walletType: wallets.walletType,
      balanceInPaise: wallets.balanceInPaise,
    })
    .from(wallets)
    .where(eq(wallets.userId, user.id));

  const cashbackBalance =
    userWallets.find((w) => w.walletType === "cashback")?.balanceInPaise ?? 0;
  const amazonBalance =
    userWallets.find((w) => w.walletType === "amazon_rewards")
      ?.balanceInPaise ?? 0;
  const totalBalance = cashbackBalance + amazonBalance;

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <PageShell>
      <PageHeader title="Profile" />

      {/* User avatar + info card */}
      <Link
        href="/profile/account"
        className="mb-5 flex items-center gap-4 rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-colors hover:bg-muted/30 active:scale-[0.98]"
      >
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-primary-foreground shadow-md">
          <span className="text-xl font-bold">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-extrabold tracking-tight">
            {user.name ?? "Fareback User"}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-bold text-success">
            <BadgeCheck className="h-3 w-3" />
            Verified
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      {/* Wallet balance summary */}
      <Link
        href="/dashboard"
        className="mb-5 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4 transition-colors hover:bg-primary/10 active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              Total Balance
            </p>
            <p className="text-xl font-black text-primary">
              {formatPaiseAsINR(totalBalance)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Tap to withdraw</p>
          <ChevronRight className="ml-auto h-4 w-4 text-primary" />
        </div>
      </Link>

      {/* Menu groups */}
      <div className="space-y-4">
        {MENU_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {group.title}
            </p>
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm divide-y divide-border/40">
              {group.items.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={idx}
                    href={item.href}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/40 active:bg-muted/60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60">
                      <Icon className="h-4 w-4 text-foreground/70" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight text-foreground">
                        {item.label}
                      </p>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Sign out */}
        <form action={signOutAction} className="w-full pt-2">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 active:bg-destructive/15"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </form>
      </div>
    </PageShell>
  );
}
