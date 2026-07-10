"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";

// NameType is not re-exported from recharts v3 — defined inline to match the internal type
type TooltipNameType = number | string;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { inr } from "./data";

// Fareback brand palette
const PIE_COLORS = {
  disbursedMoney: "#059669", // emerald-600
  disbursedGift:  "#d97706", // amber-600
  pendingMoney:   "#6ee7b7", // emerald-300
  pendingGift:    "#fcd34d", // amber-300
};

// ─── Custom Tooltips ────────────────────────────────────────────────────────
// v3: use TooltipContentProps instead of the removed TooltipProps interface

type PiePayloadItem = {
  name: string | number | undefined;
  value: number;
};

const CustomTooltip = ({ active, payload }: TooltipContentProps<TooltipValueType, TooltipNameType>) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-slate-100 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-semibold text-slate-700">{item.name}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{inr(Number(item.value ?? 0))}</p>
    </div>
  );
};

type BarPayloadItem = {
  dataKey: string;
  name: string;
  value: number;
  fill: string;
};

const BarTooltip = ({
  active,
  payload,
  label,
}: TooltipContentProps<TooltipValueType, TooltipNameType>) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
      <p className="mb-1 text-xs font-semibold text-slate-600">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="text-xs" style={{ color: p.fill as string }}>
          {p.name}: <span className="font-bold">{inr(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChartsSectionProps {
  overview?: {
    totalCashbackBalance: number;
    totalAmazonBalance: number;
    totalPaidWithdrawals: number;
    totalFulfilledGiftCards: number;
    totalPendingWithdrawals: number;
    totalPendingGiftCards: number;
  };
  topUsers?: Array<{
    userId: number;
    userName: string | null;
    userEmail: string;
    cashbackBalance: number;
    amazonBalance: number;
  }>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ChartsSection({ overview, topUsers = [] }: ChartsSectionProps) {
  const rewardSummary = useMemo(
    () => ({
      disbursedMoney: overview?.totalPaidWithdrawals ?? 0,
      disbursedGift: overview?.totalFulfilledGiftCards ?? 0,
      pendingMoney: overview?.totalPendingWithdrawals ?? 0,
      pendingGift: overview?.totalPendingGiftCards ?? 0,
    }),
    [overview],
  );

  const pieData = useMemo(
    () => [
      {
        name: "Disbursed · Money",
        value: rewardSummary.disbursedMoney,
        color: PIE_COLORS.disbursedMoney,
      },
      {
        name: "Disbursed · Gift",
        value: rewardSummary.disbursedGift,
        color: PIE_COLORS.disbursedGift,
      },
      {
        name: "Pending · Money",
        value: rewardSummary.pendingMoney,
        color: PIE_COLORS.pendingMoney,
      },
      {
        name: "Pending · Gift",
        value: rewardSummary.pendingGift,
        color: PIE_COLORS.pendingGift,
      },
    ],
    [rewardSummary],
  );

  const barData = useMemo(
    () =>
      topUsers
        .slice(0, 10)
        .map((u) => ({
          name: (u.userName || u.userEmail).split(" ")[0],
          fullName: u.userName || u.userEmail,
          cashbackBalance: u.cashbackBalance,
          amazonBalance: u.amazonBalance,
        })),
    [topUsers],
  );

  const totalDisbursed = rewardSummary.disbursedMoney + rewardSummary.disbursedGift;
  const totalPending = rewardSummary.pendingMoney + rewardSummary.pendingGift;
  const grand = totalDisbursed + totalPending;

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* Pie chart — Reward disbursed vs pending */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-amber-400" />
        <CardHeader className="border-b border-slate-100 pb-4 pt-5">
          <CardTitle className="text-base font-bold text-slate-900">
            Reward Disbursement
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Disbursed vs pending payout — split by money &amp; gift rewards
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="md:col-span-3">
              {totalDisbursed === 0 && totalPending === 0 ? (
                <div className="flex h-[260px] w-full flex-col items-center justify-center text-slate-400">
                  <div className="h-24 w-24 rounded-full border-4 border-dashed border-slate-200" />
                  <p className="mt-4 text-xs">No disbursement data yet</p>
                </div>
              ) : (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        // v3: blendStroke removed — use stroke="none" directly
                        stroke="none"
                        strokeWidth={2}
                      >
                        {pieData.map((entry, index) => (
                          // Cell is deprecated in v3, scheduled for removal in v4.
                          // Still functional in 3.x — will migrate to `shape` prop in v4.
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={(props) => <CustomTooltip {...props} />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: 11, color: "#475569" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-slate-900 tabular-nums">
                      {inr(grand)}
                    </span>
                    <span className="text-[10px] text-slate-400">Total Pool</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center gap-3 md:col-span-2">
              {[
                {
                  label: "Total Disbursed",
                  value: totalDisbursed,
                  pct: grand > 0 ? ((totalDisbursed / grand) * 100).toFixed(1) : "0.0",
                  color: "text-emerald-600",
                  bg: "bg-emerald-50 border-emerald-100",
                  dot: "bg-emerald-500",
                },
                {
                  label: "Pending Payout",
                  value: totalPending,
                  pct: grand > 0 ? ((totalPending / grand) * 100).toFixed(1) : "0.0",
                  color: "text-amber-600",
                  bg: "bg-amber-50 border-amber-100",
                  dot: "bg-amber-500",
                },
                {
                  label: "Total Wallet",
                  value: (overview?.totalCashbackBalance ?? 0) + (overview?.totalAmazonBalance ?? 0),
                  pct: null,
                  color: "text-violet-600",
                  bg: "bg-violet-50 border-violet-100",
                  dot: "bg-violet-500",
                },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {s.label}
                    </p>
                  </div>
                  <p className={`mt-1 text-lg font-bold tabular-nums ${s.color}`}>
                    {inr(s.value)}
                  </p>
                  {s.pct && (
                    <p className="text-[11px] text-slate-400">{s.pct}% of pool</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bar chart — Top 10 users wallet holding */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-violet-400 to-emerald-400" />
        <CardHeader className="border-b border-slate-100 pb-4 pt-5">
          <CardTitle className="text-base font-bold text-slate-900">
            Top 10 User Wallet Holdings
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Cashback vs Amazon rewards balance per user
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {barData.length === 0 || barData.every((u) => u.cashbackBalance + u.amazonBalance === 0) ? (
            <div className="flex h-[300px] w-full flex-col items-center justify-center text-slate-400">
              <div className="flex items-end gap-2 opacity-50">
                <div className="w-4 h-8 bg-slate-200 rounded-t" />
                <div className="w-4 h-16 bg-slate-200 rounded-t" />
                <div className="w-4 h-12 bg-slate-200 rounded-t" />
              </div>
              <p className="mt-4 text-xs">No user balances to display</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={barData}
                margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const r = v / 100;
                    if (r >= 1000) return `₹${(r / 1000).toFixed(0)}K`;
                    return `₹${r}`;
                  }}
                />
                {/* v3: Tooltip must come before Legend in JSX for correct z-ordering */}
                <Tooltip content={(props) => <BarTooltip {...props} />} cursor={{ fill: "#f8fafc" }} />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "#475569", paddingBottom: 8 }}
                />
                <Bar
                  dataKey="cashbackBalance"
                  name="Cashback"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="amazonBalance"
                  name="Amazon"
                  fill="#d97706"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
