"use client";

import { useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Activity,
  ExternalLink,
  Info,
  Smartphone,
  Globe,
  Link as LinkIcon,
  Clock,
  Store,
  MapPin,
  Undo2,
  IndianRupee,
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
import { inr, type TxSection, type WalletTransaction } from "./data";

import {
  adminMarkClickTrackedFormAction,
  adminApproveClickFormAction,
  adminDeleteUnreviewedClickFormAction,
  adminUndoTrackedClickFormAction,
  adminUndoApprovedClickFormAction,
} from "@/app/actions/wallet";

const PREVIEW_COUNT = 5;

const SECTION_META: Record<
  TxSection,
  { label: string; description: string; dot: string; band: string }
> = {
  not_review: {
    label: "Awaiting Review",
    description: "Affiliate clicks awaiting first review — mark as Tracked (merchant confirmed) or Not Tracked (invalid click).",
    dot: "bg-amber-400",
    band: "border-amber-100 bg-amber-50",
  },
  tracked: {
    label: "Tracked — Awaiting Approval",
    description: "Purchase confirmed by merchant. Enter exact cashback amount in ₹ and approve to credit user wallet.",
    dot: "bg-emerald-400",
    band: "border-emerald-100 bg-emerald-50",
  },
  not_tracked: {
    label: "Not Tracked",
    description: "Flagged as failed/untracked — undo to move back to review.",
    dot: "bg-rose-400",
    band: "border-rose-100 bg-rose-50",
  },
  paid: {
    label: "Paid / Approved",
    description: "Cashback credited and wallet updated. Can be reversed (debits user wallet with REVERSAL_DEBIT).",
    dot: "bg-violet-400",
    band: "border-violet-100 bg-violet-50",
  },
};

function statusToSection(status: string): TxSection {
  switch (status) {
    case "unreviewed": return "not_review";
    case "tracked":    return "tracked";
    case "approved":   return "paid";
    case "deleted":    return "not_tracked";
    default:           return "not_review";
  }
}

export interface ClickRow {
  id: string;
  userEmail: string;
  userName: string | null;
  merchantName: string;
  trackingStatus: string;
  rewardAmountInPaise: number;
  createdAt: Date;
  // Extended metadata
  affiliateLinkUrl?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  referrerUrl?: string | null;
  reviewedAt?: Date | null;
}

interface TransactionHistoryProps {
  clicks?: ClickRow[];
}

const EMPTY: ClickRow[] = [];

export function TransactionHistory({ clicks = EMPTY }: TransactionHistoryProps) {
  const rows = useMemo<WalletTransaction[]>(
    () =>
      clicks.map((c) => ({
        id: c.id,
        userId: c.userName || c.userEmail,
        time: new Date(c.createdAt).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        store: c.merchantName,
        linkId: c.id.slice(0, 12),
        amount: c.rewardAmountInPaise,
        type: "money" as const,
        section: statusToSection(c.trackingStatus),
      })),
    [clicks],
  );

  // Map from id → full ClickRow for popup
  const clickMap = useMemo(
    () => new Map(clicks.map((c) => [c.id, c])),
    [clicks],
  );

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<TxSection, boolean>>({
    not_review: false,
    tracked: false,
    not_tracked: false,
    paid: false,
  });
  // click ID being viewed in the detail popup
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailClick = detailId ? clickMap.get(detailId) : null;

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (t) =>
        (t.userId || "").toLowerCase().includes(q) ||
        (t.store || "").toLowerCase().includes(q) ||
        (t.linkId || "").toLowerCase().includes(q) ||
        String(t.id || "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const bySection = (s: TxSection) => filtered.filter((t) => t.section === s);

  const counts = useMemo(
    () => ({
      not_review: bySection("not_review").length,
      tracked:    bySection("tracked").length,
      not_tracked: bySection("not_tracked").length,
      paid:       bySection("paid").length,
    }),
    [filtered],
  );

  return (
    <>
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-emerald-400 to-violet-500" />
        <CardHeader className="border-b border-slate-100 pb-4 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Affiliate Click Tracking
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Track every affiliate click through review → tracked → paid lifecycle.
                  Click <Info className="inline h-3 w-3 text-violet-500" /> on any row to see full click details.
                </CardDescription>
              </div>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search user / merchant / click id"
                className="h-9 border-slate-200 bg-slate-50 pl-9 text-sm placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-emerald-500/30"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <Tabs defaultValue="not_review">
            <TabsList className="grid w-full grid-cols-2 gap-1 bg-slate-100/70 p-1 sm:grid-cols-4 h-auto">
              {(["not_review", "tracked", "not_tracked", "paid"] as TxSection[]).map((s) => {
                const meta = SECTION_META[s];
                return (
                  <TabsTrigger
                    key={s}
                    value={s}
                    className="flex items-center gap-2 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <span className="font-medium">{meta.label}</span>
                    <Badge
                      variant="outline"
                      className={`border-0 text-[10px] font-bold px-1.5 ${
                        counts[s] > 0
                          ? "bg-slate-200 text-slate-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {counts[s]}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {(["not_review", "tracked", "not_tracked", "paid"] as TxSection[]).map((section) => {
              const sectionRows = bySection(section);
              const isExpanded = expanded[section];
              const visible = isExpanded ? sectionRows : sectionRows.slice(0, PREVIEW_COUNT);
              const hiddenCount = sectionRows.length - PREVIEW_COUNT;
              const meta = SECTION_META[section];

              return (
                <TabsContent key={section} value={section} className="mt-4">
                  <div
                    className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 ${meta.band}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <p className="text-xs text-slate-600 font-medium">{meta.description}</p>
                  </div>

                  {visible.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
                      No clicks in this bucket.
                    </div>
                  ) : (
                    <>
                      <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 md:grid">
                        <div className="col-span-3">User</div>
                        <div className="col-span-2">Time</div>
                        <div className="col-span-2">Merchant</div>
                        <div className="col-span-2">Click ID</div>
                        <div className="col-span-3 text-right">Amount / Action</div>
                      </div>
                      <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                        {visible.map((t) => (
                          <TxRow
                            key={t.id}
                            tx={t}
                            section={section}
                            onViewDetails={() => setDetailId(t.id)}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {sectionRows.length > PREVIEW_COUNT && (
                    <div className="mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-emerald-700"
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [section]: !prev[section] }))
                        }
                      >
                        {isExpanded ? (
                          <><ChevronUp className="mr-1.5 h-4 w-4" /> Show less</>
                        ) : (
                          <><ChevronDown className="mr-1.5 h-4 w-4" /> View {hiddenCount} more</>
                        )}
                      </Button>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Click Detail Popup ─────────────────────────────────────────────── */}
      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-2xl border-slate-200 p-0 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-emerald-500 to-amber-400" />
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-500" />
              Click Detail
              {detailClick && (
                <Badge
                  variant="outline"
                  className={`ml-2 text-xs font-semibold ${
                    detailClick.trackingStatus === "approved"
                      ? "border-violet-200 bg-violet-50 text-violet-700"
                      : detailClick.trackingStatus === "tracked"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : detailClick.trackingStatus === "deleted"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {detailClick.trackingStatus}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Full click metadata for finance review. This information helps verify genuine purchases.
            </DialogDescription>
          </DialogHeader>

          {detailClick && (
            <div className="px-6 pb-6 pt-4 space-y-4">
              {/* Identity */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">User &amp; Click Identity</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "User", value: detailClick.userName || detailClick.userEmail, icon: Activity },
                    { label: "Email", value: detailClick.userEmail, icon: Activity },
                    { label: "Merchant", value: detailClick.merchantName, icon: Store },
                    { label: "Click ID", value: detailClick.id, mono: true, icon: LinkIcon },
                  ].map((f) => (
                    <div key={f.label} className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">{f.label}</p>
                      <p className={`text-sm mt-0.5 text-slate-800 truncate ${f.mono ? "font-mono text-xs" : "font-medium"}`}>
                        {f.value || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timing */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    <Clock className="inline h-3 w-3 mr-1" />Clicked At
                  </p>
                  <p className="text-sm font-semibold text-slate-800" suppressHydrationWarning>
                    {new Date(detailClick.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
                <div className={`rounded-xl border p-4 ${
                  detailClick.rewardAmountInPaise > 0
                    ? "border-emerald-200 bg-emerald-50"
                    : detailClick.trackingStatus === "tracked"
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-100 bg-slate-50"
                }`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    <IndianRupee className="inline h-3 w-3 mr-1" />Cashback Amount
                  </p>
                  {detailClick.rewardAmountInPaise > 0 ? (
                    <div>
                      <p className="text-lg font-black tabular-nums text-emerald-700">
                        {inr(detailClick.rewardAmountInPaise)}
                      </p>
                      {detailClick.trackingStatus === "tracked" && (
                        <p className="text-[10px] text-amber-600 mt-0.5 font-semibold">Pre-set · Enter final amount below to approve</p>
                      )}
                      {detailClick.trackingStatus === "approved" && (
                        <p className="text-[10px] text-emerald-600 mt-0.5 font-semibold">✓ Credited to wallet</p>
                      )}
                    </div>
                  ) : detailClick.trackingStatus === "tracked" ? (
                    <div>
                      <p className="text-sm font-bold text-amber-600">Not set yet</p>
                      <p className="text-[10px] text-amber-500/80 mt-0.5">Enter amount below to approve</p>
                    </div>
                  ) : (
                    <p className="text-lg font-bold tabular-nums text-slate-400">
                      —
                    </p>
                  )}
                </div>
              </div>

              {/* Network metadata */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Network &amp; Device Metadata
                </p>

                <div className="space-y-2">
                  {/* Affiliate Link */}
                  <div>
                    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400">
                      <ExternalLink className="h-3 w-3" /> Affiliate URL
                    </p>
                    {detailClick.affiliateLinkUrl ? (
                      <a
                        href={detailClick.affiliateLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block text-xs text-violet-600 hover:underline break-all font-mono"
                      >
                        {detailClick.affiliateLinkUrl}
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400 mt-0.5">—</p>
                    )}
                  </div>

                  {/* Referrer */}
                  <div>
                    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400">
                      <Globe className="h-3 w-3" /> Referrer URL
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600 break-all font-mono">
                      {detailClick.referrerUrl || "—"}
                    </p>
                  </div>

                  {/* IP */}
                  <div>
                    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400">
                      <MapPin className="h-3 w-3" /> IP Address
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600 font-mono">
                      {detailClick.ipAddress || "—"}
                    </p>
                  </div>

                  {/* User Agent */}
                  <div>
                    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400">
                      <Smartphone className="h-3 w-3" /> User Agent
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 break-all leading-relaxed">
                      {detailClick.userAgent || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick action buttons inside popup */}
              {detailClick.trackingStatus === "unreviewed" && (
                <div className="space-y-3 pt-1">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-700 mb-1">Mark as Tracked (Merchant Confirmed)</p>
                    <p className="text-[11px] text-slate-500">Required: set the expected cashback amount.</p>
                  </div>
                  <div className="flex gap-2">
                    <form action={adminMarkClickTrackedFormAction} className="flex flex-1 gap-2">
                      <input type="hidden" name="clickId" value={detailClick.id} />
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                        <Input
                          name="expectedReward"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Expected cashback"
                          required
                          className="pl-7 border-slate-200 focus-visible:ring-emerald-500/30"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-auto bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Tracked
                      </Button>
                    </form>
                    <form action={adminDeleteUnreviewedClickFormAction}>
                      <input type="hidden" name="clickId" value={detailClick.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        className="border-rose-200 text-sm font-medium text-rose-600 hover:bg-rose-50"
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Not Tracked
                      </Button>
                    </form>
                  </div>
                </div>
              )}

              {detailClick.trackingStatus === "tracked" && (
                <div className="space-y-3 pt-1">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                    <p className="text-xs font-bold text-emerald-800 mb-1">💰 Approve Cashback — Credit User Wallet</p>
                    <p className="text-[11px] text-emerald-700/80">
                      Enter the exact cashback amount in ₹ for this purchase.
                      {detailClick.merchantName?.toLowerCase() === "amazon"
                        ? " Amazon purchases go to the Amazon Rewards wallet."
                        : " Amount will be credited to the Cashback wallet."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={adminApproveClickFormAction} className="flex flex-1 gap-2">
                      <input type="hidden" name="clickId" value={detailClick.id} />
                      {/* Remove hardcoded walletType so server auto-detects Amazon vs cashback */}
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                        <Input
                          name="amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="e.g. 45.50"
                          defaultValue={detailClick.rewardAmountInPaise > 0 ? (detailClick.rewardAmountInPaise / 100).toFixed(2) : ""}
                          className="pl-7 border-emerald-200 focus-visible:ring-emerald-500/30"
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200"
                      >
                        Approve &amp; Credit Wallet
                      </Button>
                    </form>
                    <form action={adminUndoTrackedClickFormAction}>
                      <input type="hidden" name="clickId" value={detailClick.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        className="text-slate-500 hover:text-slate-700"
                        title="Undo to Not Reviewed"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              )}

              {detailClick.trackingStatus === "deleted" && (
                <div className="pt-1">
                  <form action={adminUndoTrackedClickFormAction}>
                    <input type="hidden" name="clickId" value={detailClick.id} />
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full border-slate-200 text-slate-600 hover:bg-slate-100"
                    >
                      <Undo2 className="mr-2 h-4 w-4" /> Undo to Not Reviewed
                    </Button>
                  </form>
                </div>
              )}

              {detailClick.trackingStatus === "approved" && (
                <div className="pt-1">
                  <form action={adminUndoApprovedClickFormAction}>
                    <input type="hidden" name="clickId" value={detailClick.id} />
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full border-rose-200 text-rose-600 hover:bg-rose-50"
                    >
                      <Undo2 className="mr-2 h-4 w-4" /> Reverse Payout (Debit Wallet)
                    </Button>
                  </form>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── TxRow ─────────────────────────────────────────────────────────────────

interface TxRowProps {
  tx: WalletTransaction;
  section: TxSection;
  onViewDetails: () => void;
}

function TxRow({ tx, section, onViewDetails }: TxRowProps) {
  return (
    <div className="grid grid-cols-12 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/60">
      {/* User */}
      <div className="col-span-12 md:col-span-3">
        <p className="text-sm font-semibold text-slate-900 truncate">{tx.userId}</p>
        <p className="flex items-center gap-1 text-[10px] text-slate-400" suppressHydrationWarning>
          <Clock className="h-3 w-3" /> {tx.time}
        </p>
      </div>

      {/* Merchant */}
      <div className="col-span-6 md:col-span-2">
        <p className="flex items-center gap-1 text-[10px] text-slate-400">
          <Store className="h-3 w-3" /> Merchant
        </p>
        <p className="text-sm font-medium text-slate-700 truncate">{tx.store}</p>
      </div>

      {/* Click ID */}
      <div className="col-span-6 md:col-span-2">
        <p className="text-[10px] text-slate-400 mb-0.5">Click ID</p>
        <p className="font-mono text-xs text-slate-600 truncate">{tx.linkId}</p>
      </div>

      {/* Amount */}
      <div className="col-span-4 md:col-span-2">
        <p className="text-[10px] text-slate-400 mb-0.5">Reward</p>
        <p className="text-sm font-bold text-slate-800 tabular-nums">
          {tx.amount > 0 ? inr(tx.amount) : <span className="text-slate-300 text-xs">Pending</span>}
        </p>
      </div>

      {/* Actions */}
      <div className="col-span-8 flex flex-wrap items-center justify-end gap-1.5 md:col-span-3">
        {/* View Details button — always shown */}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1 text-[11px] font-medium text-violet-600 hover:bg-violet-50 hover:text-violet-700"
          onClick={onViewDetails}
        >
          <Info className="h-3.5 w-3.5" /> Details
        </Button>

        {/* Quick inline actions */}
        {section === "not_review" && (
          <>

            <form action={adminDeleteUnreviewedClickFormAction}>
              <input type="hidden" name="clickId" value={tx.id} />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-8 border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                <XCircle className="mr-1 h-3.5 w-3.5" /> Not Tracked
              </Button>
            </form>
          </>
        )}

        {section === "tracked" && (
          <span className="text-xs text-slate-400 italic">Open Details to approve</span>
        )}

        {section === "not_tracked" && (
          <form action={adminUndoTrackedClickFormAction}>
            <input type="hidden" name="clickId" value={tx.id} />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8 border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" /> Undo
            </Button>
          </form>
        )}

        {section === "paid" && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-violet-200 bg-violet-50 text-violet-700 font-semibold text-xs h-8 items-center"
            >
              ✓ Paid
            </Badge>
            <form action={adminUndoApprovedClickFormAction}>
              <input type="hidden" name="clickId" value={tx.id} />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-8 border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
                title="Reverse Payout"
              >
                <Undo2 className="mr-1 h-3.5 w-3.5" /> Revert
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
