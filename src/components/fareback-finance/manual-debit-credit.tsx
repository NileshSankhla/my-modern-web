"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  SlidersHorizontal,
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { inr, type ManualEntry } from "./data";
import { useToast } from "@/hooks/use-toast";
import { adminAdjustWalletAction } from "@/app/actions/wallet";

const PREVIEW_COUNT = 5;

type ActionKind = "credit" | "debit";

interface PendingAction {
  entry: ManualEntry;
  kind: ActionKind;
  /** Amount in rupees (input value) */
  amount: number;
}

export function ManualDebitCredit({ users = [] }: { users?: any[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [drafts, setDrafts] = useState<
    Record<string, { kind: ActionKind; amount: string; walletType: string }>
  >({});
  const [pending, setPending] = useState<PendingAction | null>(null);

  const items = useMemo(
    () =>
      users.map((u) => ({
        id: u.userId,
        userId: u.userEmail,
        userName: u.userName || u.userEmail,
        // Combined wallet balance in paise
        walletBalance: (u.cashbackBalance || 0) + (u.amazonBalance || 0),
        cashbackBalance: u.cashbackBalance || 0,
        amazonBalance: u.amazonBalance || 0,
      })) as (ManualEntry & { cashbackBalance: number; amazonBalance: number })[],
    [users],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (e) =>
        String(e.userId || "").toLowerCase().includes(q) ||
        String(e.userName || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const visible = expanded ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const hiddenCount = filtered.length - PREVIEW_COUNT;

  const getDraft = (id: string) =>
    drafts[id] ?? { kind: "credit" as ActionKind, amount: "", walletType: "cashback" };

  const setDraft = (
    id: string,
    patch: Partial<{ kind: ActionKind; amount: string; walletType: string }>,
  ) =>
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...getDraft(id), ...patch },
    }));

  const openConfirm = (entry: ManualEntry & { cashbackBalance: number; amazonBalance: number }) => {
    const draft = getDraft(entry.id);
    const amt = Number(draft.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({
        title: "Enter a valid amount",
        description: "Amount must be a positive number in rupees.",
        variant: "destructive",
      });
      return;
    }
    setPending({ entry, kind: draft.kind, amount: amt });
  };

  const confirmAction = () => {
    if (!pending) return;
    const { entry, kind, amount } = pending;
    const walletType = getDraft(entry.id).walletType || "cashback";

    startTransition(async () => {
      const formData = new FormData();
      formData.append("userEmail", entry.userId);
      formData.append("walletType", walletType);
      formData.append("type", kind);
      // adminAdjustWalletAction expects amount in rupees (parseRupeesToPaise handles conversion)
      formData.append("amount", amount.toString());

      const result = await adminAdjustWalletAction({}, formData);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: kind === "credit" ? "✅ Amount credited" : "✅ Amount debited",
          description: `₹${amount.toLocaleString("en-IN")} ${kind === "credit" ? "added to" : "deducted from"} ${entry.userName}'s ${walletType === "cashback" ? "cashback" : "Amazon"} wallet.`,
        });
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          return next;
        });
      }
      setPending(null);
    });
  };

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="h-1 w-full bg-gradient-to-r from-violet-400 to-emerald-400" />
      <CardHeader className="border-b border-slate-100 pb-4 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-sm shadow-violet-200">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Manual Debit / Credit
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Directly adjust a user&apos;s wallet balance. Requires confirmation before applying.
              </CardDescription>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search user"
              className="h-9 border-slate-200 bg-slate-50 pl-9 text-sm placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-emerald-500/30"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Desktop header */}
        <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:grid">
          <div className="col-span-4">User</div>
          <div className="col-span-2">Wallet Balance</div>
          <div className="col-span-2">Wallet Type</div>
          <div className="col-span-2">Action</div>
          <div className="col-span-2">Amount (₹)</div>
        </div>

        <div className="divide-y divide-slate-100">
          {visible.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              No users match your search.
            </div>
          )}

          {visible.map((entry) => {
            const draft = getDraft(entry.id);
            return (
              <div
                key={entry.id}
                className="grid grid-cols-12 items-center gap-3 px-6 py-4 transition-colors hover:bg-slate-50/60"
              >
                {/* User */}
                <div className="col-span-12 md:col-span-4">
                  <p className="text-sm font-semibold text-slate-900">{entry.userName}</p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">{entry.userId}</p>
                </div>

                {/* Balance breakdown */}
                <div className="col-span-6 md:col-span-2">
                  <p className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Wallet className="h-3.5 w-3.5" /> Combined
                  </p>
                  <p className="text-sm font-bold text-slate-800 tabular-nums">
                    {inr(entry.walletBalance)}
                  </p>
                  <div className="flex gap-1 mt-0.5">
                    <span className="text-[10px] text-emerald-600">
                      CB: {inr(entry.cashbackBalance)}
                    </span>
                    <span className="text-[10px] text-amber-600">
                      AMZ: {inr(entry.amazonBalance)}
                    </span>
                  </div>
                </div>

                {/* Wallet type selector */}
                <div className="col-span-6 md:col-span-2">
                  <Select
                    value={draft.walletType}
                    onValueChange={(v) => setDraft(entry.id, { walletType: v })}
                  >
                    <SelectTrigger className="h-9 w-full border-slate-200 text-xs focus:ring-emerald-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashback">
                        <span className="flex items-center gap-2 text-emerald-700">
                          💰 Cashback
                        </span>
                      </SelectItem>
                      <SelectItem value="amazon_rewards">
                        <span className="flex items-center gap-2 text-amber-700">
                          🎁 Amazon
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Action kind selector */}
                <div className="col-span-6 md:col-span-2">
                  <Select
                    value={draft.kind}
                    onValueChange={(v: ActionKind) => setDraft(entry.id, { kind: v })}
                  >
                    <SelectTrigger className="h-9 w-full border-slate-200 text-xs focus:ring-emerald-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">
                        <span className="flex items-center gap-2">
                          <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" /> Credit
                        </span>
                      </SelectItem>
                      <SelectItem value="debit">
                        <span className="flex items-center gap-2">
                          <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" /> Debit
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount input + proceed */}
                <div className="col-span-6 md:col-span-2 flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    min="1"
                    value={draft.amount}
                    onChange={(e) => setDraft(entry.id, { amount: e.target.value })}
                    className="h-9 border-slate-200 text-sm focus-visible:ring-emerald-500/30 tabular-nums"
                  />
                  <Button
                    size="sm"
                    className={`h-9 shrink-0 text-xs font-semibold text-white shadow-sm ${
                      draft.kind === "credit"
                        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                        : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
                    }`}
                    onClick={() => openConfirm(entry)}
                  >
                    Go
                  </Button>
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

      {/* Verification dialog */}
      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-md border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900">⚠️ Confirm Wallet Adjustment</DialogTitle>
            <DialogDescription className="text-slate-500">
              This will immediately change the user&apos;s wallet balance. Please review carefully.
            </DialogDescription>
          </DialogHeader>

          {pending && (
            <div className="space-y-4">
              <div
                className={`rounded-xl border p-4 ${
                  pending.kind === "credit"
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-rose-200 bg-rose-50"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{pending.entry.userName}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{pending.entry.userId}</p>
                  </div>
                  <Badge
                    className={
                      pending.kind === "credit"
                        ? "bg-emerald-600 text-white font-semibold"
                        : "bg-rose-600 text-white font-semibold"
                    }
                  >
                    {pending.kind === "credit" ? "CREDIT" : "DEBIT"}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    {
                      label: "Current",
                      value: inr(pending.entry.walletBalance),
                      color: "text-slate-900",
                    },
                    {
                      label: "Adjustment",
                      value: `${pending.kind === "credit" ? "+" : "−"}₹${pending.amount.toLocaleString("en-IN")}`,
                      color: pending.kind === "credit" ? "text-emerald-700" : "text-rose-700",
                    },
                    {
                      label: "New Balance",
                      value: inr(
                        pending.kind === "credit"
                          ? pending.entry.walletBalance + pending.amount * 100
                          : Math.max(0, pending.entry.walletBalance - pending.amount * 100),
                      ),
                      color: "text-slate-900",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg bg-white/60 p-2 border border-white/80"
                    >
                      <p className="text-[10px] uppercase text-slate-400 font-semibold">
                        {s.label}
                      </p>
                      <p className={`text-sm font-bold tabular-nums mt-0.5 ${s.color}`}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-500">
                {pending.kind === "credit"
                  ? `This user will receive ₹${pending.amount.toLocaleString("en-IN")} in their wallet. This action is logged in the audit trail.`
                  : `₹${pending.amount.toLocaleString("en-IN")} will be deducted from this user's wallet. This action is logged in the audit trail.`}
              </p>
            </div>
          )}

          <DialogFooter className="pt-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setPending(null)}
              className="border-slate-200"
            >
              Cancel
            </Button>
            <Button
              disabled={isPending}
              className={
                pending?.kind === "credit"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
                  : "bg-rose-600 text-white hover:bg-rose-700 font-semibold"
              }
              onClick={confirmAction}
            >
              {isPending
                ? "Processing…"
                : `Confirm ${pending?.kind === "credit" ? "Credit" : "Debit"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
