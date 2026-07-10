import { formatDate, formatPaiseAsINR } from "@/lib/utils";
import MerchantLogo from "@/components/ui/merchant-logo";
import {
  CheckCircle2,
  Clock,
  Hourglass,
  BadgeCheck,
  XCircle,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export interface TrackedHistoryItem {
  id: string | number;
  merchantName: string;
  merchantLogo?: string | null;
  clickDate: Date;
  rewardAmount: number;
  trackingStatus: "tracked" | "approved" | "unreviewed" | "deleted";
  reviewedAt?: Date | null;
}

interface TrackedHistoryProps {
  items: TrackedHistoryItem[];
}

const STATUS_CONFIG = {
  unreviewed: {
    label: "Detection Pending",
    detail: "Purchase detected. Awaiting merchant tracking confirmation.",
    icon: Hourglass,
    badgeClass:
      "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400",
    accentClass: "bg-slate-300 dark:bg-slate-600",
    glowClass: "",
    amountLabel: "Expected Reward",
    showAmount: false,
    amountClass: "",
  },
  tracked: {
    label: "Tracked",
    detail: "Purchase confirmed by merchant. Finance team is reviewing and setting your cashback reward.",
    icon: Clock,
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
    accentClass: "bg-amber-400",
    glowClass: "bg-amber-500/5 blur-2xl",
    amountLabel: "Expected Reward",
    showAmount: true,
    amountClass: "text-amber-600 dark:text-amber-400",
  },
  approved: {
    label: "Cashback Credited",
    detail: "Reward confirmed and added to your wallet balance.",
    icon: BadgeCheck,
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
    accentClass: "bg-emerald-400",
    glowClass: "bg-emerald-500/8 blur-2xl",
    amountLabel: "Reward Credited",
    showAmount: true,
    amountClass: "text-emerald-600 dark:text-emerald-400",
  },
  deleted: {
    label: "Not Eligible",
    detail: "This purchase did not qualify for cashback.",
    icon: XCircle,
    badgeClass:
      "border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400",
    accentClass: "bg-rose-400",
    glowClass: "",
    amountLabel: "Reward",
    showAmount: false,
    amountClass: "text-rose-400 line-through opacity-60",
  },
} as const;

const TrackedHistory = ({ items }: TrackedHistoryProps) => {
  // Show all statuses — fully reflects finance panel in real time
  const visibleItems = items.filter(
    (item) => item.trackingStatus !== undefined
  );

  if (visibleItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/50 bg-muted/5 px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <ShoppingBag className="h-7 w-7 text-primary/60" />
        </div>
        <p className="font-bold text-foreground">No purchases tracked yet</p>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
          Shop through a Fareback partner store and your cashback will appear
          here within 48 hours.
        </p>
        <Link
          href="/stores"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
        >
          Browse Stores
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {visibleItems.map((item) => {
        const cfg = STATUS_CONFIG[item.trackingStatus] ?? STATUS_CONFIG.unreviewed;
        const StatusIcon = cfg.icon;
        const isApproved = item.trackingStatus === "approved";
        const isDeleted = item.trackingStatus === "deleted";

        return (
          <div
            key={item.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-background/70 shadow-sm backdrop-blur-sm transition-all hover:border-border hover:shadow-md"
          >
            {/* Glow orb for approved/tracked */}
            {cfg.glowClass && (
              <div
                className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full ${cfg.glowClass}`}
              />
            )}

            {/* Top accent strip */}
            <div className={`h-1 w-full ${cfg.accentClass}`} />

            <div className="relative z-10 flex flex-1 flex-col p-5">
              {/* Row 1: Merchant + Status badge */}
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Merchant Icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background shadow-sm">
                    <MerchantLogo
                      name={item.merchantName}
                      logoUrl={item.merchantLogo}
                      className="h-6 w-6 object-contain"
                      fallbackIcon="bag"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`truncate font-bold leading-tight ${isDeleted ? "text-muted-foreground/60" : "text-foreground"}`}>
                      {item.merchantName}
                    </h4>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDate(item.clickDate)}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cfg.badgeClass}`}
                >
                  <StatusIcon className="h-3 w-3" />
                  {cfg.label}
                </div>
              </div>

              {/* Row 2: Amount */}
              <div className="mt-auto border-t border-border/40 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {cfg.amountLabel}
                  </span>

                  {isApproved && item.rewardAmount > 0 ? (
                    <span className={`text-base font-black ${cfg.amountClass}`}>
                      +{formatPaiseAsINR(item.rewardAmount)}
                    </span>
                  ) : item.trackingStatus === "tracked" && item.rewardAmount > 0 ? (
                    <span className={`text-sm font-bold ${cfg.amountClass}`}>
                      ~{formatPaiseAsINR(item.rewardAmount)}
                    </span>
                  ) : item.trackingStatus === "tracked" ? (
                    <span className="text-xs font-semibold text-amber-500/80">
                      Being reviewed
                    </span>
                  ) : isDeleted ? (
                    <span className="text-sm font-bold text-muted-foreground/40">
                      —
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground/60">
                      Awaiting confirmation
                    </span>
                  )}
                </div>

                {/* Status description */}
                <p className="mt-1.5 text-[11px] text-muted-foreground/60">
                  {cfg.detail}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrackedHistory;
