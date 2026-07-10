"use client";

import { IndianRupee, Wallet, Clock, TrendingUp, Gift, AlertTriangle } from "lucide-react";
import { inr, inrCompact } from "./data";

interface KpiBarProps {
  overview?: {
    totalCashbackBalance: number;
    totalAmazonBalance: number;
    totalPaidWithdrawals: number;
    totalFulfilledGiftCards: number;
    totalPendingWithdrawals: number;
    totalPendingGiftCards: number;
  };
  pendingCount?: number;
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md ${
        highlight
          ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50"
          : "border-slate-100 bg-white"
      }`}
    >
      {/* Decorative gradient blob */}
      <div
        className={`absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10 ${accent}`}
      />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent} text-white shadow-sm`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function KpiBar({ overview, pendingCount = 0 }: KpiBarProps) {
  const totalWallet =
    (overview?.totalCashbackBalance ?? 0) + (overview?.totalAmazonBalance ?? 0);
  const totalDisbursed =
    (overview?.totalPaidWithdrawals ?? 0) + (overview?.totalFulfilledGiftCards ?? 0);
  const totalPending =
    (overview?.totalPendingWithdrawals ?? 0) + (overview?.totalPendingGiftCards ?? 0);

  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label="Total Wallet Balance"
        value={inrCompact(totalWallet)}
        sub={inr(totalWallet) + " total"}
        icon={Wallet}
        accent="bg-emerald-600"
      />
      <KpiCard
        label="Cashback Balance"
        value={inrCompact(overview?.totalCashbackBalance ?? 0)}
        sub="Money wallet"
        icon={IndianRupee}
        accent="bg-emerald-500"
      />
      <KpiCard
        label="Amazon Rewards"
        value={inrCompact(overview?.totalAmazonBalance ?? 0)}
        sub="Gift wallet"
        icon={Gift}
        accent="bg-amber-500"
      />
      <KpiCard
        label="Total Disbursed"
        value={inrCompact(totalDisbursed)}
        sub={inr(totalDisbursed)}
        icon={TrendingUp}
        accent="bg-violet-600"
      />
      <KpiCard
        label="Pending Payout"
        value={inrCompact(totalPending)}
        sub={inr(totalPending)}
        icon={Clock}
        accent="bg-orange-500"
        highlight={totalPending > 0}
      />
      <KpiCard
        label="Pending Requests"
        value={String(pendingCount)}
        sub={pendingCount === 1 ? "1 request" : `${pendingCount} requests`}
        icon={AlertTriangle}
        accent={pendingCount > 0 ? "bg-rose-500" : "bg-slate-400"}
        highlight={pendingCount > 0}
      />
    </section>
  );
}
