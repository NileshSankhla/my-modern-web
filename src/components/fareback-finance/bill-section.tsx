"use client";

import { useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  User,
  ReceiptText,
  Info,
  Wallet,
  FileText,
  IndianRupee,
  Hash,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { inr } from "./data";

const PREVIEW_COUNT = 5;

interface WalletTxRow {
  id: number;
  userEmail: string;
  userName: string | null;
  walletType: string;
  type: "credit" | "debit";
  amountInPaise: number;
  note: string | null;
  createdAt: string;
}

interface BillSectionProps {
  walletTransactions?: WalletTxRow[];
}

export function BillSection({ walletTransactions = [] }: BillSectionProps) {
  const [query, setQuery] = useState("");
  const [expandedCredits, setExpandedCredits] = useState(false);
  const [expandedDebits, setExpandedDebits] = useState(false);
  const [detailTx, setDetailTx] = useState<WalletTxRow | null>(null);

  const credits = useMemo(() => {
    const all = walletTransactions.filter((t) => t.type === "credit");
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(
      (t) =>
        String(t.userEmail || "").toLowerCase().includes(q) ||
        (t.userName && String(t.userName).toLowerCase().includes(q)) ||
        (t.note && String(t.note).toLowerCase().includes(q)),
    );
  }, [walletTransactions, query]);

  const debits = useMemo(() => {
    const all = walletTransactions.filter((t) => t.type === "debit");
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(
      (t) =>
        String(t.userEmail || "").toLowerCase().includes(q) ||
        (t.userName && String(t.userName).toLowerCase().includes(q)) ||
        (t.note && String(t.note).toLowerCase().includes(q)),
    );
  }, [walletTransactions, query]);

  const visibleCredits = expandedCredits ? credits : credits.slice(0, PREVIEW_COUNT);
  const visibleDebits = expandedDebits ? debits : debits.slice(0, PREVIEW_COUNT);
  const hiddenCredits = credits.length - PREVIEW_COUNT;
  const hiddenDebits = debits.length - PREVIEW_COUNT;

  const totalCredits = useMemo(
    () => credits.reduce((s, t) => s + t.amountInPaise, 0),
    [credits],
  );
  const totalDebits = useMemo(
    () => debits.reduce((s, t) => s + t.amountInPaise, 0),
    [debits],
  );

  return (
    <>
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-rose-400" />
        <CardHeader className="border-b border-slate-100 pb-4 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-sm">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Wallet Bills &amp; Transactions
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  All wallet credits &amp; debits across users. Click{" "}
                  <Info className="inline h-3 w-3 text-violet-500" /> on any row to view full bill details.
                </CardDescription>
              </div>
            </div>

            {/* Totals + search */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
                  Total Credits
                </p>
                <p className="text-base font-bold text-emerald-700 tabular-nums">
                  {inr(totalCredits)}
                </p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
                  Total Debits
                </p>
                <p className="text-base font-bold text-rose-700 tabular-nums">
                  {inr(totalDebits)}
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-3 w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search user / note"
              className="h-9 border-slate-200 bg-slate-50 pl-9 text-sm placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-emerald-500/30"
            />
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <Tabs defaultValue="credits">
            <TabsList className="grid w-full grid-cols-2 gap-1 bg-slate-100/70 p-1 h-auto">
              <TabsTrigger
                value="credits"
                className="flex items-center gap-2 py-2 text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                Credits
                <Badge
                  variant="outline"
                  className="ml-1 border-0 bg-emerald-100 text-emerald-700 text-[10px] font-bold"
                >
                  {credits.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="debits"
                className="flex items-center gap-2 py-2 text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <ArrowUpRight className="h-4 w-4 text-rose-600" />
                Debits
                <Badge
                  variant="outline"
                  className="ml-1 border-0 bg-rose-100 text-rose-700 text-[10px] font-bold"
                >
                  {debits.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Credits */}
            <TabsContent value="credits" className="mt-4">
              {visibleCredits.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
                  No credit transactions found.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {visibleCredits.map((t) => (
                    <TxRow key={t.id} tx={t} onViewDetails={() => setDetailTx(t)} />
                  ))}
                </div>
              )}
              {credits.length > PREVIEW_COUNT && (
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-emerald-700"
                    onClick={() => setExpandedCredits((v) => !v)}
                  >
                    {expandedCredits ? (
                      <><ChevronUp className="mr-1.5 h-4 w-4" /> Show less</>
                    ) : (
                      <><ChevronDown className="mr-1.5 h-4 w-4" /> View {hiddenCredits} more</>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Debits */}
            <TabsContent value="debits" className="mt-4">
              {visibleDebits.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
                  No debit transactions found.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {visibleDebits.map((t) => (
                    <TxRow key={t.id} tx={t} onViewDetails={() => setDetailTx(t)} />
                  ))}
                </div>
              )}
              {debits.length > PREVIEW_COUNT && (
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-emerald-700"
                    onClick={() => setExpandedDebits((v) => !v)}
                  >
                    {expandedDebits ? (
                      <><ChevronUp className="mr-1.5 h-4 w-4" /> Show less</>
                    ) : (
                      <><ChevronDown className="mr-1.5 h-4 w-4" /> View {hiddenDebits} more</>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Bill Detail Popup ─────────────────────────────────────────────── */}
      <Dialog open={!!detailTx} onOpenChange={(open) => !open && setDetailTx(null)}>
        <DialogContent className="max-w-lg border-slate-200 p-0 overflow-hidden">
          <div
            className={`h-1 w-full ${
              detailTx?.type === "credit"
                ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                : "bg-gradient-to-r from-rose-400 to-orange-400"
            }`}
          />
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <FileText
                className={`h-5 w-5 ${
                  detailTx?.type === "credit" ? "text-emerald-600" : "text-rose-600"
                }`}
              />
              Transaction Bill
              {detailTx && (
                <Badge
                  className={`ml-1 text-xs font-semibold ${
                    detailTx.type === "credit"
                      ? "bg-emerald-600 text-white"
                      : "bg-rose-600 text-white"
                  }`}
                >
                  {detailTx.type.toUpperCase()}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Full ledger record for this wallet transaction.
            </DialogDescription>
          </DialogHeader>

          {detailTx && (
            <div className="px-6 pb-6 pt-4 space-y-4">
              {/* Main amount card */}
              <div
                className={`rounded-xl border p-5 text-center ${
                  detailTx.type === "credit"
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-rose-200 bg-rose-50"
                }`}
              >
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                  {detailTx.type === "credit" ? "Amount Credited" : "Amount Debited"}
                </p>
                <p
                  className={`text-4xl font-bold tabular-nums mt-1.5 ${
                    detailTx.type === "credit" ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {detailTx.type === "credit" ? "+" : "−"}{inr(detailTx.amountInPaise)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {(detailTx.amountInPaise / 100).toFixed(2)} ₹ · {detailTx.amountInPaise} paise
                </p>
              </div>

              {/* Details grid */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                {[
                  {
                    icon: User,
                    label: "User Name",
                    value: detailTx.userName || "—",
                  },
                  {
                    icon: User,
                    label: "Email",
                    value: detailTx.userEmail,
                    mono: true,
                  },
                  {
                    icon: Wallet,
                    label: "Wallet",
                    value: detailTx.walletType === "cashback" ? "💰 Cashback Wallet" : "🎁 Amazon Rewards Wallet",
                  },
                  {
                    icon: Hash,
                    label: "Transaction ID",
                    value: String(detailTx.id),
                    mono: true,
                  },
                  {
                    icon: Clock,
                    label: "Date & Time",
                    value: new Date(detailTx.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }),
                    suppressHydrationWarning: true,
                  },
                  {
                    icon: FileText,
                    label: "Note / Reason",
                    value: detailTx.note || "No note provided",
                  },
                ].map((f) => (
                  <div key={f.label} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100">
                      <f.icon className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {f.label}
                      </p>
                      <p
                        className={`text-sm mt-0.5 text-slate-800 break-all ${
                          f.mono ? "font-mono text-xs" : "font-medium"
                        }`}
                        suppressHydrationWarning={f.suppressHydrationWarning}
                      >
                        {f.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info note */}
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <IndianRupee className="inline h-3 w-3 mr-0.5" />
                  This is a ledger entry. Ledger rows are <strong>immutable</strong> and cannot be deleted.
                  All wallet balance changes are derived from the sum of these entries.
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full border-slate-200"
                onClick={() => setDetailTx(null)}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TxRow({
  tx,
  onViewDetails,
}: {
  tx: WalletTxRow;
  onViewDetails: () => void;
}) {
  const isCredit = tx.type === "credit";
  return (
    <div className="grid grid-cols-12 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/60">
      {/* User */}
      <div className="col-span-12 md:col-span-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <User className="h-4 w-4 text-slate-300" />
          {tx.userName || tx.userEmail}
        </p>
        <p className="text-[11px] text-slate-400 font-mono truncate pl-5">{tx.userEmail}</p>
      </div>

      {/* Wallet type */}
      <div className="col-span-4 md:col-span-2">
        <Badge
          variant="outline"
          className={
            tx.walletType === "cashback"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold"
              : "border-amber-200 bg-amber-50 text-amber-700 font-semibold"
          }
        >
          {tx.walletType === "cashback" ? "💰 Cashback" : "🎁 Amazon"}
        </Badge>
      </div>

      {/* Note */}
      <div className="col-span-8 md:col-span-3">
        <p className="text-xs text-slate-500 truncate" title={tx.note || ""}>
          {tx.note || "—"}
        </p>
      </div>

      {/* Time */}
      <div className="col-span-6 md:col-span-2">
        <p
          className="flex items-center gap-1 text-[11px] text-slate-400"
          suppressHydrationWarning
        >
          <Clock className="h-3.5 w-3.5" />
          {new Date(tx.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Amount + detail */}
      <div className="col-span-6 md:col-span-2 flex items-center justify-end gap-2">
        <p
          className={`text-sm font-bold tabular-nums ${
            isCredit ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {isCredit ? "+" : "−"}
          {inr(tx.amountInPaise)}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-violet-500 hover:bg-violet-50 hover:text-violet-700"
          onClick={onViewDetails}
          title="View bill details"
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
