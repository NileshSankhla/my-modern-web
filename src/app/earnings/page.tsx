import Link from "next/link";
import { TrendingUp, Clock, CheckCircle, Store } from "lucide-react";
import { db } from "@/lib/db";
import { clicks, merchants } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

const Filters = ["Overview", "Pending", "Confirmed", "Withdrawn"];

export default async function EarningsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect=/earnings");
  }

  const userClicks = await db
    .select({
      id: clicks.id,
      clickDate: clicks.createdAt,
      merchantName: merchants.name,
      trackingStatus: clicks.trackingStatus,
      rewardAmount: clicks.rewardAmountInPaise,
    })
    .from(clicks)
    .innerJoin(merchants, eq(merchants.id, clicks.merchantId))
    .where(eq(clicks.userId, user.id))
    .orderBy(desc(clicks.createdAt))
    .limit(20);

  const totalEarned = userClicks.reduce((acc, item) => acc + item.rewardAmount, 0) / 100;
  
  const statusColors: Record<string, { text: string; bg: string; icon: any }> = {
    unreviewed: { text: "text-muted-foreground", bg: "bg-muted/10", icon: Clock },
    tracked: { text: "text-amber-500", bg: "bg-amber-500/10", icon: Clock },
    approved: { text: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle },
    deleted: { text: "text-destructive", bg: "bg-destructive/10", icon: Store },
  };

  return (
    <div className="flex min-h-[100dvh] w-full flex-col space-y-6 overflow-x-hidden bg-background px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Earnings</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {Filters.map((filter, i) => (
          <button
            key={filter}
            className={`flex-shrink-0 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              i === 0 ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Earnings Graph Card */}
      <div className="overflow-hidden rounded-3xl border border-border/50 bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Total Earnings</p>
        <div className="mt-2 flex items-end gap-3">
          <h2 className="text-4xl font-bold text-foreground">₹{totalEarned.toLocaleString()}</h2>
          <div className="mb-1 flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-500">
            <TrendingUp className="mr-1 h-3 w-3" />
            12.5% this month
          </div>
        </div>

        {/* Dummy Graph */}
        <div className="mt-8 h-32 w-full relative">
          <svg viewBox="0 0 100 40" className="h-full w-full overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 30 Q 10 25, 20 28 T 40 20 T 60 15 T 80 20 T 100 5 L 100 40 L 0 40 Z"
              fill="url(#gradient)"
            />
            <path
              d="M0 30 Q 10 25, 20 28 T 40 20 T 60 15 T 80 20 T 100 5"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
            />
            {/* Graph points */}
            <circle cx="20" cy="28" r="1.5" fill="hsl(var(--primary))" />
            <circle cx="40" cy="20" r="1.5" fill="hsl(var(--primary))" />
            <circle cx="60" cy="15" r="1.5" fill="hsl(var(--primary))" />
            <circle cx="80" cy="20" r="1.5" fill="hsl(var(--primary))" />
            <circle cx="100" cy="5" r="1.5" fill="hsl(var(--primary))" />
          </svg>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground px-2">
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
            <span>Jul</span>
            <span>Aug</span>
          </div>
        </div>
      </div>

      {/* Stats Breakdown */}
      <div className="grid grid-cols-1 gap-3">
        {[
          { label: "Pending", amount: "430", color: "text-amber-500", bg: "bg-amber-500/10", icon: Clock },
          { label: "Confirmed", amount: "1,100", color: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle },
          { label: "Withdrawn", amount: "1,910", color: "text-primary", bg: "bg-primary/10", icon: Wallet },
        ].map((stat) => {
          const Icon = stat.icon as any;
          return (
            <div key={stat.label} className="flex items-center justify-between rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <span className="font-medium">{stat.label}</span>
              </div>
              <span className="text-lg font-bold">₹{stat.amount}</span>
            </div>
          );
        })}
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Recent Transactions</h3>
          <button className="text-xs font-semibold text-primary">View All &gt;</button>
        </div>
        <div className="flex flex-col gap-3">
          {userClicks.length > 0 ? (
            userClicks.map((click) => {
              const status = statusColors[click.trackingStatus] || statusColors.unreviewed;
              const StatusIcon = status.icon;

              return (
                <div key={click.id} className="flex items-center justify-between rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white p-2">
                      <Store className="h-6 w-6 text-black" />
                    </div>
                    <div>
                      <h4 className="font-bold">{click.merchantName}</h4>
                      <p className="text-xs text-muted-foreground">Order • {click.clickDate.toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">₹{(click.rewardAmount / 100).toLocaleString()}</p>
                    <p className={`text-[10px] font-bold ${status.text} capitalize flex items-center justify-end gap-1`}>
                      {click.trackingStatus}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-sm">
              <Store className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No recent transactions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Additional lucide imports that I missed earlier
import { Wallet } from "lucide-react";
