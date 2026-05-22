import { formatDate, formatPaiseAsINR } from "@/lib/utils";
import { CheckCircle2, Clock } from "lucide-react";

export interface TrackedHistoryItem {
  id: string | number;
  merchantName: string;
  clickDate: Date;
  rewardAmount: number;
  trackingStatus: "tracked" | "approved";
}

interface TrackedHistoryProps {
  items: TrackedHistoryItem[];
}

const TrackedHistory = ({ items }: TrackedHistoryProps) => {
  const visibleItems = items.filter(
    (item) => item.trackingStatus === "tracked" || item.trackingStatus === "approved",
  );

  if (visibleItems.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border/60 bg-muted/5 py-12 text-center">
        <p className="font-medium text-muted-foreground">No tracked rewards yet.</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Your cashback will appear here within 48 hours of purchase.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {visibleItems.map((item) => {
        const isApproved = item.trackingStatus === "approved";

        return (
          <div
            key={item.id}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/50 bg-background/50 p-6 backdrop-blur-sm transition-all hover:border-border hover:shadow-md"
          >
            {isApproved ? (
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-[40px]" />
            ) : null}

            <div className="relative z-10 mb-6 flex items-start justify-between">
              <div>
                <h4 className="text-lg font-bold text-foreground">{item.merchantName}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.clickDate)}</p>
              </div>
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  isApproved
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {isApproved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                {isApproved ? "Approved" : "Pending"}
              </div>
            </div>

            <div className="relative z-10 border-t border-border/40 pt-4">
              {isApproved ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Reward Added</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    +{formatPaiseAsINR(item.rewardAmount)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Expected Reward</span>
                  <span className="text-sm font-bold text-foreground">Calculating...</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrackedHistory;
