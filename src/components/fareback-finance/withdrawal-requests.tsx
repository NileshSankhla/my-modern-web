"use client";

import { useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Pencil,
  Wallet,
  IndianRupee,
  Gift,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inr } from "./data";
import { useToast } from "@/hooks/use-toast";

import {
  adminProcessWithdrawalFormAction,
  adminProcessAmazonGiftCardRequestFormAction,
} from "@/app/actions/wallet";

const PREVIEW_COUNT = 5;

export function WithdrawalRequests({
  pendingWithdrawals = [],
  pendingGiftCards = [],
}: {
  pendingWithdrawals?: any[];
  pendingGiftCards?: any[];
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");

  const items = useMemo(() => {
    type RequestItem = {
      id: string;
      userId: string;
      userName: string;
      amount: number;
      walletBalance: number;
      type: "money" | "gift";
      requestedAt: string;
      upiId?: string;
      giftCardCode?: string;
    };

    const w: RequestItem[] = pendingWithdrawals.map((r) => ({
      id: r.id,
      userId: r.userEmail,
      userName: r.userName || "User",
      // amountInPaise from DB
      amount: r.amountInPaise,
      walletBalance: 0, // not fetched; shown as N/A
      type: "money" as const,
      requestedAt: new Date(r.createdAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      upiId: r.upiId as string | undefined,
    }));

    const g: RequestItem[] = pendingGiftCards.map((r) => ({
      id: r.id,
      userId: r.userEmail,
      userName: r.userName || "User",
      amount: r.amountInPaise,
      walletBalance: 0,
      type: "gift" as const,
      requestedAt: new Date(r.createdAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      giftCardCode: r.giftCardCode,
    }));

    return [...w, ...g].sort(
      (a, b) =>
        new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
    );
  }, [pendingWithdrawals, pendingGiftCards]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (r) =>
        String(r.userId || "").toLowerCase().includes(q) ||
        String(r.userName || "").toLowerCase().includes(q) ||
        String(r.id || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const visible = expanded ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const hiddenCount = filtered.length - PREVIEW_COUNT;

  const startEdit = (r: any) => {
    setEditingId(r.id);
    // Show amount in rupees for editing UX
    setEditAmount(String(Math.round(r.amount / 100)));
  };

  const saveEdit = () => {
    toast({
      title: "Not Supported",
      description: "Editing amount is disabled in real-time mode.",
      variant: "destructive",
    });
    setEditingId(null);
  };

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="h-1 w-full bg-gradient-to-r from-rose-400 via-orange-400 to-amber-400" />
      <CardHeader className="border-b border-slate-100 pb-4 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-sm shadow-rose-200">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                Withdrawal Requests
                {items.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                    {items.length} pending
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Review and approve pending user payout requests
              </CardDescription>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search user / request id"
              className="h-9 border-slate-200 bg-slate-50 pl-9 text-sm placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-emerald-500/30"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Desktop column headers */}
        <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:grid">
          <div className="col-span-3">User / ID</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Requested At</div>
          <div className="col-span-2">UPI / Code</div>
          <div className="col-span-3 text-right">Amount &amp; Action</div>
        </div>

        <div className="divide-y divide-slate-100">
          {visible.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-slate-600">All clear! No pending requests.</p>
              <p className="text-xs text-slate-400">Withdrawal requests will appear here.</p>
            </div>
          )}

          {visible.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-12 items-center gap-3 px-6 py-4 transition-colors hover:bg-slate-50/60"
            >
              {/* User */}
              <div className="col-span-12 md:col-span-3">
                <p className="text-sm font-semibold text-slate-900">{r.userName}</p>
                <p className="text-[11px] text-slate-400 font-mono">{r.userId}</p>
                <p className="text-[10px] text-slate-300 font-mono">{r.id}</p>
              </div>

              {/* Type */}
              <div className="col-span-4 md:col-span-2">
                <Badge
                  variant="outline"
                  className={
                    r.type === "money"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold"
                      : "border-amber-200 bg-amber-50 text-amber-700 font-semibold"
                  }
                >
                  {r.type === "money" ? (
                    <><IndianRupee className="mr-1 h-3 w-3" />Money</>
                  ) : (
                    <><Gift className="mr-1 h-3 w-3" />Amazon Gift</>
                  )}
                </Badge>
              </div>

              {/* Requested at */}
              <div className="col-span-4 md:col-span-2">
                <p className="text-xs text-slate-600 font-medium" suppressHydrationWarning>
                  {r.requestedAt}
                </p>
              </div>

              {/* UPI / code */}
              <div className="col-span-4 md:col-span-2">
                {r.upiId ? (
                  <p className="text-xs text-slate-600 font-mono truncate" title={r.upiId}>
                    {r.upiId}
                  </p>
                ) : r.giftCardCode ? (
                  <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 text-[10px]">
                    Code issued
                  </Badge>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>

              {/* Amount + Actions */}
              <div className="col-span-12 flex flex-wrap items-center justify-end gap-2 md:col-span-3">
                {/* Amount display / edit */}
                {editingId === r.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">₹</span>
                    <Input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="h-8 w-24 border-emerald-300 text-sm focus-visible:ring-emerald-500/30"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-emerald-600"
                      onClick={saveEdit}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-400"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold text-slate-900 tabular-nums">
                      {inr(r.amount)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-slate-300 hover:text-emerald-600"
                      onClick={() => startEdit(r)}
                      title="Edit amount (disabled)"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                {/* Action buttons */}
                {r.type === "money" ? (
                  <form action={async (fd) => { await adminProcessWithdrawalFormAction(fd); }} className="flex gap-2">
                    <input type="hidden" name="requestId" value={r.id} />
                    <Button
                      type="submit"
                      name="decision"
                      value="mark-paid"
                      size="sm"
                      className="h-8 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200"
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Mark Paid
                    </Button>
                    <Button
                      type="submit"
                      name="decision"
                      value="reject"
                      size="sm"
                      variant="outline"
                      className="h-8 border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Reject
                    </Button>
                  </form>
                ) : (
                  <form
                    action={async (fd) => { await adminProcessAmazonGiftCardRequestFormAction(fd); }}
                    className="flex flex-col items-end gap-2"
                  >
                    <input type="hidden" name="requestId" value={r.id} />
                    <div className="flex gap-2">
                      <Input
                        name="giftCardCode"
                        placeholder="Amazon GC code"
                        className="h-8 w-36 border-amber-200 bg-amber-50 text-xs focus-visible:ring-amber-500/30 placeholder:text-amber-400"
                      />
                      <Button
                        type="submit"
                        name="decision"
                        value="fulfill"
                        size="sm"
                        className="h-8 bg-amber-500 text-xs font-semibold text-white hover:bg-amber-600 shadow-sm shadow-amber-200"
                      >
                        <Gift className="mr-1 h-3.5 w-3.5" /> Issue
                      </Button>
                      <Button
                        type="submit"
                        name="decision"
                        value="reject"
                        size="sm"
                        variant="outline"
                        className="h-8 border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ))}
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
                <>
                  <ChevronUp className="mr-1.5 h-4 w-4" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1.5 h-4 w-4" /> View {hiddenCount} more
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
