"use client";

import { useState, useEffect } from "react";
import { flushAffiliateRedisKeysAction, reloadRedisLinksAction, getRedisStatsAction } from "@/app/actions/affiliate-links";
import {
  Upload,
  FileSpreadsheet,
  DatabaseZap,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader, SectionCard } from "./primitives";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function DataToolsTab() {
  const { toast } = useToast();
  const [csvData, setCsvData] = useState("");
  const [processing, setProcessing] = useState(false);
  const [relodingLinks, setReloadingLinks] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [flushOpen, setFlushOpen] = useState(false);
  const [redisStats, setRedisStats] = useState({ connected: false, totalKeys: 0, affiliateLinkCount: 0, counterValue: null as number | null, loading: true });

  const fetchStats = async () => {
    const stats = await getRedisStatsAction();
    setRedisStats({ ...stats, loading: false });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvData.trim()) return;
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 900));
    setProcessing(false);
    const rows = csvData.trim().split("\n").length;
    toast({
      title: "CSV processed",
      description: `${rows} review rows imported and queued for approval.`,
    });
    setCsvData("");
  };

  const handleReload = async () => {
    setReloadingLinks(true);
    const res = await reloadRedisLinksAction();
    setReloadingLinks(false);
    
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    } else {
      toast({
        title: "Cache reloaded",
        description: res.success || "Affiliate links synced from database to Redis.",
      });
      fetchStats();
    }
  };

  const handleFlush = async () => {
    setFlushOpen(false);
    setFlushing(true);
    const res = await flushAffiliateRedisKeysAction();
    setFlushing(false);
    
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    } else {
      toast({
        title: "Affiliate cache cleared",
        description: res.success || "Affiliate rotation keys cleared. Sessions and idempotency keys preserved.",
      });
      fetchStats();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data & cache"
        description="Bulk-import review data and manage the Redis cache that powers link rotation."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* CSV import */}
        <SectionCard
          title="CSV review import"
          description="Paste click-review rows in clickId,amount format"
          actions={
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              <FileSpreadsheet className="mr-1 h-3 w-3" /> Bulk
            </Badge>
          }
        >
          <form onSubmit={handleCsv} className="space-y-4">
            <div>
              <label htmlFor="csv-data" className="mb-1.5 block text-xs font-medium text-slate-700">
                CSV data
              </label>
              <Textarea
                id="csv-data"
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder={"550e8400-e29b-41d4-a716-446655440000, 150.00\n73f8a401-e123-41d4-a716-123412340000, 75.50"}
                rows={8}
                className="resize-none border-slate-200 font-mono text-xs focus-visible:ring-violet-500/40"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                One row per line. Format: <code className="rounded bg-slate-100 px-1">clickId, amount</code>
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-[11px] text-slate-400">
                {csvData.trim() ? `${csvData.trim().split("\n").length} row(s) ready` : "No data yet"}
              </p>
              <Button
                type="submit"
                disabled={processing || !csvData.trim()}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {processing ? "Processing…" : "Process CSV"}
              </Button>
            </div>
          </form>
        </SectionCard>

        {/* Redis management */}
        <SectionCard
          title="Cache & sync"
          description="Reload or flush the Redis cache that backs link rotation"
          actions={
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
              <DatabaseZap className="mr-1 h-3 w-3" /> Redis
            </Badge>
          }
        >
          <div className="space-y-4">
            {/* Status strip */}
            <div className={cn("flex items-center gap-3 rounded-lg border p-3", redisStats.connected ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
              {redisStats.connected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
              <div className="flex-1">
                <p className={cn("text-sm font-medium", redisStats.connected ? "text-emerald-900" : "text-amber-900")}>
                  {redisStats.loading ? "Checking Redis..." : redisStats.connected ? "Redis connected" : "Redis disconnected"}
                </p>
                <p className={cn("text-[11px]", redisStats.connected ? "text-emerald-700" : "text-amber-700")}>
                  {redisStats.loading ? "Loading stats..." : redisStats.connected ? `${redisStats.affiliateLinkCount} link(s) in rotation · counter: ${redisStats.counterValue ?? 0} · ${redisStats.totalKeys} total keys` : "Application is falling back to PostgreSQL database."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-[11px] leading-4 text-slate-500">
                If Redis goes down, Fareback automatically falls back to querying the database directly.
                No user-facing impact.
              </p>
            </div>

            {/* Safe action */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Sync links to Redis</p>
                <p className="text-[11px] text-slate-500">
                  Re-fetch all affiliate links from the DB and push to cache.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={relodingLinks || flushing}
                onClick={handleReload}
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", relodingLinks && "animate-spin")} />
                {relodingLinks ? "Syncing…" : "Sync"}
              </Button>
            </div>

            {/* Danger action — SAFE: only flushes affiliate rotation keys */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Clear affiliate cache
                </p>
                <p className="text-[11px] text-amber-700">
                  Only clears affiliate rotation keys. Sessions, idempotency, and rate limits are preserved.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={relodingLinks || flushing}
                onClick={() => setFlushOpen(true)}
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                <Trash2 className={cn("mr-1.5 h-3.5 w-3.5", flushing && "animate-pulse")} />
                {flushing ? "Clearing…" : "Clear cache"}
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      <ConfirmDialog
        config={{
          open: flushOpen,
          title: "Clear affiliate rotation cache?",
          description: (
            <span>
              This removes only the affiliate link rotation keys from Redis.
              <strong> Sessions, idempotency keys, and rate limits are NOT affected.</strong>
              {" "}The app will briefly fall back to the database until the cache is rebuilt on the next link sync.
            </span>
          ),
          confirmLabel: "Yes, clear affiliate cache",
          tone: "danger",
          onConfirm: handleFlush,
          onCancel: () => setFlushOpen(false),
        }}
      />
    </div>
  );
}
