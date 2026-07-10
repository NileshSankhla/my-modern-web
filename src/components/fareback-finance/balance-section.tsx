"use client";

import { useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ArrowDownUp,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowDown,
  ArrowUp,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr, type BalanceRow } from "./data";

const PREVIEW_COUNT = 10;

type SortKey = "alpha" | "money" | "gift" | "total";
type SortDir = "asc" | "desc";

export function BalanceSection({ users = [] }: { users?: any[] }) {
  const items = useMemo<BalanceRow[]>(
    () =>
      users.map((u) => ({
        userId: u.userId,
        userName: u.userName || u.userEmail,
        // Values are already in paise from DB
        moneyBalance: u.cashbackBalance || 0,
        giftBalance: u.amazonBalance || 0,
      })),
    [users],
  );

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const enriched = useMemo(
    () => items.map((r) => ({ ...r, total: r.moneyBalance + r.giftBalance })),
    [items],
  );

  const sorted = useMemo(() => {
    const copy = [...enriched];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "alpha":  cmp = a.userName.localeCompare(b.userName); break;
        case "money":  cmp = a.moneyBalance - b.moneyBalance; break;
        case "gift":   cmp = a.giftBalance - b.giftBalance; break;
        case "total":  cmp = a.total - b.total; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [enriched, sortKey, sortDir]);

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (r) =>
        String(r.userId || "").toLowerCase().includes(q) ||
        String(r.userName || "").toLowerCase().includes(q),
    );
  }, [sorted, query]);

  const visible = expanded ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const hiddenCount = filtered.length - PREVIEW_COUNT;

  const toggleDir = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));

  const SortIcon = () => {
    if (sortKey === "alpha") {
      return sortDir === "asc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />;
    }
    return sortDir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const totalMoney = useMemo(() => items.reduce((s, r) => s + r.moneyBalance, 0), [items]);
  const totalGift = useMemo(() => items.reduce((s, r) => s + r.giftBalance, 0), [items]);
  const grandTotal = totalMoney + totalGift;

  // Determine top balances for ranking indicators
  const maxTotal = enriched.length > 0 ? Math.max(...enriched.map((r) => r.total)) : 0;

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-amber-400 to-violet-500" />
      <CardHeader className="border-b border-slate-100 pb-4 pt-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm shadow-emerald-200">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                User Balances
                <span className="text-sm font-normal text-slate-400">({items.length} users)</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Cashback (money) and Amazon rewards wallet balances across all users
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search user"
                className="h-9 border-slate-200 bg-slate-50 pl-9 text-sm placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-emerald-500/30"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={sortKey} onValueChange={(v: SortKey) => setSortKey(v)}>
                <SelectTrigger className="h-9 w-40 border-slate-200 text-sm focus:ring-emerald-500/30">
                  <ArrowDownUp className="mr-2 h-4 w-4 text-slate-400" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Total Balance</SelectItem>
                  <SelectItem value="money">Cashback</SelectItem>
                  <SelectItem value="gift">Amazon</SelectItem>
                  <SelectItem value="alpha">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={toggleDir}
                aria-label="Toggle sort direction"
              >
                <SortIcon />
              </Button>
            </div>
          </div>
        </div>

        {/* Summary chips */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            {
              label: "Total Cashback",
              value: inr(totalMoney),
              color: "text-emerald-700",
              bg: "bg-emerald-50 border-emerald-100",
            },
            {
              label: "Total Amazon",
              value: inr(totalGift),
              color: "text-amber-700",
              bg: "bg-amber-50 border-amber-100",
            },
            {
              label: "Grand Total",
              value: inr(grandTotal),
              color: "text-slate-900",
              bg: "bg-slate-50 border-slate-100",
            },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border px-4 py-2.5 ${s.bg}`}>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
                {s.label}
              </p>
              <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Column header */}
        <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:grid">
          <div className="col-span-1">#</div>
          <div className="col-span-4">User</div>
          <div className="col-span-2 text-right">Cashback</div>
          <div className="col-span-2 text-right">Amazon</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-1 text-right">Mix</div>
        </div>

        <div className="divide-y divide-slate-100">
          {visible.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              No users match your search.
            </div>
          )}

          {visible.map((r, idx) => {
            const moneyPct = r.total > 0 ? (r.moneyBalance / r.total) * 100 : 0;
            const giftPct = r.total > 0 ? 100 - moneyPct : 0;
            const rank = sorted.findIndex((s) => s.userId === r.userId) + 1;
            const isTop3 = rank <= 3 && !query.trim();

            return (
              <div
                key={r.userId}
                className={`grid grid-cols-12 items-center gap-3 px-6 py-3.5 transition-colors hover:bg-slate-50/60 ${
                  isTop3 ? "bg-amber-50/30" : ""
                }`}
              >
                {/* Rank */}
                <div className="col-span-1">
                  {isTop3 ? (
                    <span className="text-base">
                      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300 tabular-nums">{rank}</span>
                  )}
                </div>

                {/* User */}
                <div className="col-span-12 md:col-span-4">
                  <p className="text-sm font-semibold text-slate-900">{r.userName}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{r.userId}</p>
                </div>

                {/* Cashback */}
                <div className="col-span-4 md:col-span-2 md:text-right">
                  <p className="text-[10px] text-slate-400 md:hidden mb-0.5">Cashback</p>
                  <p className="text-sm font-semibold text-emerald-700 tabular-nums">
                    {inr(r.moneyBalance)}
                  </p>
                </div>

                {/* Amazon */}
                <div className="col-span-4 md:col-span-2 md:text-right">
                  <p className="text-[10px] text-slate-400 md:hidden mb-0.5">Amazon</p>
                  <p className="text-sm font-semibold text-amber-700 tabular-nums">
                    {inr(r.giftBalance)}
                  </p>
                </div>

                {/* Total */}
                <div className="col-span-4 md:col-span-2 md:text-right">
                  <p className="text-[10px] text-slate-400 md:hidden mb-0.5">Total</p>
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    {inr(r.total)}
                  </p>
                </div>

                {/* Mix bar */}
                <div className="col-span-12 md:col-span-1">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 md:ml-auto md:w-16">
                    <div className="h-full bg-emerald-500" style={{ width: `${moneyPct}%` }} />
                    <div className="h-full bg-amber-500" style={{ width: `${giftPct}%` }} />
                  </div>
                  {/* Progress bar relative to max */}
                  {maxTotal > 0 && (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100 md:w-16">
                      <div
                        className="h-full bg-violet-400/60"
                        style={{ width: `${(r.total / maxTotal) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length > PREVIEW_COUNT && (
          <div className="border-t border-slate-100 p-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-emerald-700"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <><ChevronUp className="mr-1.5 h-4 w-4" /> Show less</>
              ) : (
                <><ChevronDown className="mr-1.5 h-4 w-4" /> View {hiddenCount} more</>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
