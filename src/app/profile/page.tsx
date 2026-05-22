import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Settings,
  User,
  CreditCard,
  ShoppingBag,
  Receipt,
  HelpCircle,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Info
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/actions/auth";

const MENU_ITEMS = [
  { icon: User, label: "Account Details", href: "#" },
  { icon: CreditCard, label: "Bank & UPI Details", href: "#" },
  { icon: ShoppingBag, label: "My Orders", href: "/earnings" },
  { icon: Receipt, label: "Payments", href: "/earnings" },
  { icon: Info, label: "How It Works", href: "/how-it-works" },
  { icon: HelpCircle, label: "Help & Support", href: "/#faq" },
];

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect=/profile");
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col space-y-6 overflow-x-hidden bg-background px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
          <Settings className="h-6 w-6" />
        </button>
      </div>

      {/* User Card */}
      <div className="flex items-center gap-4 rounded-3xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="h-16 w-16 overflow-hidden rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-2xl font-medium text-primary">{user.name?.charAt(0) || "U"}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <h2 className="truncate text-lg font-bold">{user.name}</h2>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-500">
            <ShieldCheck className="h-3 w-3" />
            Verified
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </div>

      {/* Menu List */}
      <div className="flex flex-col gap-2">
        {MENU_ITEMS.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              key={index}
              href={item.href}
              className="flex items-center justify-between rounded-2xl border border-border/50 bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{item.label}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          );
        })}

        <form action={signOutAction} className="w-full">
          <button
            type="submit"
            className="flex w-full items-center justify-between rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-destructive transition-colors hover:bg-destructive/10"
          >
            <div className="flex items-center gap-4">
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Logout</span>
            </div>
            <ChevronRight className="h-5 w-5 opacity-50" />
          </button>
        </form>
      </div>
    </div>
  );
}
