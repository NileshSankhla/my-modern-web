"use client";

import { useState, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Wallet,
  ArrowUpRight,
  Receipt,
  Star,
  Search,
  Filter,
  ArrowDownLeft,
  RefreshCcw,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Gift,
} from "lucide-react";
import { formatPaiseAsINR } from "@/lib/utils";
import Link from "next/link";

export interface UnifiedHistoryItem {
  id: string;
  category: "upi" | "gift_card" | "ledger";
  title: string;
  subtitle: string;
  amountInPaise: number;
  isCredit: boolean;
  status: "completed" | "pending" | "rejected" | "processing";
  statusLabel: string;
  timestamp: string;
  rawDate: number;
  referenceId?: string;
  note?: string;
}

interface PaymentHistoryClientProps {
  items: UnifiedHistoryItem[];
  totalPaidOut: number;
  totalPending: number;
  totalLedgerCount: number;
}

export default function PaymentHistoryClient({
  items,
  totalPaidOut,
  totalPending,
  totalLedgerCount,
}: PaymentHistoryClientProps) {
  const [activeTab, setActiveTab] = useState<"all" | "upi" | "gift_card" | "ledger">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (activeTab !== "all" && item.category !== activeTab) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          (item.referenceId && item.referenceId.toLowerCase().includes(q)) ||
          (item.note && item.note.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.rawDate - a.rawDate);
  }, [items, activeTab, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Enterprise Financial Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-success/30 bg-gradient-to-br from-success/15 via-success/5 to-background p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-success/80">
                Total Disbursed Cash
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {formatPaiseAsINR(totalPaidOut)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Successfully paid via UPI & Gift Cards
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/20 text-success shadow-inner">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/15 via-warning/5 to-background p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-warning/90">
                Pending Settlements
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {formatPaiseAsINR(totalPending)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Queued for processing & review
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/20 text-warning shadow-inner">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-background p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Ledger Entries
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {totalLedgerCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Verified immutable ledger rows
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary shadow-inner">
              <Receipt className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-background text-foreground shadow-sm scale-[1.02]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            All Activity ({items.length})
          </button>
          <button
            onClick={() => setActiveTab("upi")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "upi"
                ? "bg-background text-foreground shadow-sm scale-[1.02]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
            UPI Payouts
          </button>
          <button
            onClick={() => setActiveTab("gift_card")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "gift_card"
                ? "bg-background text-foreground shadow-sm scale-[1.02]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Gift className="h-3.5 w-3.5 text-amber-500" />
            Gift Cards
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "ledger"
                ? "bg-background text-foreground shadow-sm scale-[1.02]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wallet className="h-3.5 w-3.5 text-blue-500" />
            Ledger Adjustments
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search reference, note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border/60 bg-background pl-9 pr-4 py-1.5 text-xs font-medium placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Transaction Feed */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border/50 bg-card/40 py-20 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/60">
            <Receipt className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-base font-bold text-foreground">No matching financial records</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {searchQuery
              ? `No results found matching "${searchQuery}". Try a different term.`
              : "No transactions found in this category."}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="mt-4 rounded-xl bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isSuccess = item.status === "completed";
            const isPending = item.status === "pending" || item.status === "processing";
            const isRejected = item.status === "rejected";

            return (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-md sm:p-5"
              >
                {/* Left accent indicator */}
                <div
                  className={`absolute left-0 top-0 h-full w-1.5 transition-all group-hover:w-2 ${
                    isSuccess
                      ? "bg-emerald-500"
                      : isPending
                      ? "bg-amber-500"
                      : isRejected
                      ? "bg-rose-500"
                      : "bg-blue-500"
                  }`}
                />

                <div className="flex flex-col gap-3 pl-2 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: Icon & Description */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-inner ${
                        item.category === "upi"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : item.category === "gift_card"
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {item.category === "upi" ? (
                        <CreditCard className="h-5 w-5" />
                      ) : item.category === "gift_card" ? (
                        <Gift className="h-5 w-5" />
                      ) : (
                        <Wallet className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground/80">
                          {item.category === "upi"
                            ? "UPI Bank Payout"
                            : item.category === "gift_card"
                            ? "Amazon Pay Gift Card"
                            : "Ledger Settlement"}
                        </span>
                        {item.referenceId && (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {item.referenceId}
                          </span>
                        )}
                      </div>
                      <h4 className="mt-0.5 truncate text-sm font-extrabold text-foreground sm:text-base">
                        {item.title}
                      </h4>
                      <p className="mt-0.5 text-xs font-medium text-muted-foreground line-clamp-1">
                        {item.subtitle}
                      </p>
                      {item.note && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                          <span className="font-bold text-foreground">Note:</span> {item.note}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount & Status Badge */}
                  <div className="flex items-center justify-between border-t border-border/40 pt-3 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <span
                        className={`text-base font-black tracking-tight sm:text-lg ${
                          item.isCredit
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground"
                        }`}
                      >
                        {item.isCredit ? "+" : "-"}{formatPaiseAsINR(item.amountInPaise)}
                      </span>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {item.timestamp}
                      </p>
                    </div>

                    <div
                      className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${
                        isSuccess
                          ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : isPending
                          ? "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 animate-pulse"
                          : isRejected
                          ? "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                          : "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                      }`}
                    >
                      {isSuccess && <CheckCircle2 className="h-3 w-3" />}
                      {isPending && <Clock className="h-3 w-3" />}
                      {isRejected && <XCircle className="h-3 w-3" />}
                      {item.statusLabel}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
