"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  flushAffiliateRedisKeysAction,
  reloadRedisLinksAction,
} from "@/app/actions/affiliate-links";
import {
  RefreshCw,
  Trash2,
  Loader2,
  Check,
  AlertTriangle,
  DatabaseZap,
  Info,
} from "lucide-react";

export function RedisManagement() {
  const [loadingFlush, setLoadingFlush] = useState(false);
  const [loadingReload, setLoadingReload] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const handleFlush = async () => {
    if (
      !confirm(
        "Are you sure you want to completely flush the Redis Cache? This will remove all locks, rate limits, and cached links.",
      )
    )
      return;
    setLoadingFlush(true);
    setMessage(null);
    try {
      const res = await flushAffiliateRedisKeysAction();
      if (res?.error) throw new Error(res.error);
      setMessage({ text: res.success || "Flushed.", type: "success" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setMessage({ text: message, type: "error" });
    } finally {
      setLoadingFlush(false);
    }
  };

  const handleReload = async () => {
    setLoadingReload(true);
    setMessage(null);
    try {
      const res = await reloadRedisLinksAction();
      if (res?.error) throw new Error(res.error);
      setMessage({ text: res.success || "Reloaded.", type: "success" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setMessage({ text: message, type: "error" });
    } finally {
      setLoadingReload(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status indicator */}
      <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">Redis online</p>
          <p className="text-[11px] text-slate-400">Cache-backed link rotation active</p>
        </div>
        <DatabaseZap className="h-4 w-4 text-sky-300" />
      </div>

      {/* Inline message */}
      {message && (
        <div
          className={`fade-in-up flex items-start gap-2 rounded-xl p-3 text-sm ${
            message.type === "success"
              ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border border-rose-400/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {message.type === "success" ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          onClick={handleReload}
          disabled={loadingReload || loadingFlush}
          className="group border-white/20 bg-white/5 text-white backdrop-blur transition-all hover:border-white/40 hover:bg-white/10"
        >
          {loadingReload ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4 transition-transform group-hover:rotate-180" />
          )}
          {loadingReload ? "Reloading..." : "Sync Links"}
        </Button>
        <Button
          variant="destructive"
          onClick={handleFlush}
          disabled={loadingReload || loadingFlush}
          className="group bg-rose-600 text-white transition-all hover:bg-rose-700"
        >
          {loadingFlush ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
          )}
          {loadingFlush ? "Flushing..." : "Flush Cache"}
        </Button>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <p className="text-[11px] leading-relaxed text-slate-400">
          If Redis is unavailable, the application automatically falls back to
          querying the database directly. No user-facing impact.
        </p>
      </div>
    </div>
  );
}
