"use client";

import { useMemo, useState } from "react";
import {
  Search,
  History,
  ShieldCheck,
  Link2,
  DatabaseZap,
  Upload,
  Megaphone,
  Settings2,
  Crown,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, SectionCard, EmptyState } from "./primitives";
import { type AuditEntry, type AuditAction, formatDateTime } from "./data";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<AuditAction, string> = {
  role_granted: "Role granted",
  role_revoked: "Role revoked",
  link_added: "Link added",
  link_removed: "Link removed",
  link_toggled: "Link toggled",
  cache_flushed: "Cache flushed",
  cache_reloaded: "Cache reloaded",
  csv_imported: "CSV imported",
  notification_sent: "Notification sent",
  settings_updated: "Settings updated",
};

const ACTION_VERBS: Record<AuditAction, string> = {
  role_granted: "granted role to",
  role_revoked: "revoked role from",
  link_added: "added affiliate link",
  link_removed: "removed affiliate link",
  link_toggled: "toggled affiliate link",
  cache_flushed: "flushed the Redis cache",
  cache_reloaded: "reloaded links from database",
  csv_imported: "imported CSV review data",
  notification_sent: "sent notification to",
  settings_updated: "updated platform settings for",
};

const ACTION_ICONS: Record<AuditAction, typeof Crown> = {
  role_granted: Crown,
  role_revoked: Crown,
  link_added: Link2,
  link_removed: Link2,
  link_toggled: Link2,
  cache_flushed: DatabaseZap,
  cache_reloaded: DatabaseZap,
  csv_imported: Upload,
  notification_sent: Megaphone,
  settings_updated: Settings2,
};

const ACTION_TONES: Record<AuditAction, string> = {
  role_granted: "bg-violet-50 text-violet-600",
  role_revoked: "bg-rose-50 text-rose-600",
  link_added: "bg-emerald-50 text-emerald-600",
  link_removed: "bg-rose-50 text-rose-600",
  link_toggled: "bg-amber-50 text-amber-600",
  cache_flushed: "bg-rose-50 text-rose-600",
  cache_reloaded: "bg-sky-50 text-sky-600",
  csv_imported: "bg-amber-50 text-amber-600",
  notification_sent: "bg-rose-50 text-rose-600",
  settings_updated: "bg-slate-100 text-slate-600",
};

export function AuditLogTab({ auditLog }: { auditLog: AuditEntry[] }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");

  const filtered = useMemo(() => {
    return auditLog.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        e.actorName.toLowerCase().includes(q) ||
        e.actorEmail.toLowerCase().includes(q) ||
        (e.target ?? "").toLowerCase().includes(q) ||
        ACTION_LABELS[e.action].toLowerCase().includes(q) ||
        e.ip.toLowerCase().includes(q)
      );
    });
  }, [query, actionFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Immutable trail of every privileged action. Filter by action type or search by actor, target, or IP."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => toast({ title: "Export queued", description: "CSV will be emailed when ready." })}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
        }
      />

      <SectionCard
        title="Event trail"
        description={`${filtered.length} of ${auditLog.length} events shown`}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search actor, target, IP"
                className="h-8 w-56 border-slate-200 pl-8 text-xs focus-visible:ring-violet-500/40"
              />
            </div>
            <Select
              value={actionFilter}
              onValueChange={(v) => setActionFilter(v as AuditAction | "all")}
            >
              <SelectTrigger className="h-8 w-44 border-slate-200 text-xs focus:ring-violet-500/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="role_granted">Role granted</SelectItem>
                <SelectItem value="role_revoked">Role revoked</SelectItem>
                <SelectItem value="link_added">Link added</SelectItem>
                <SelectItem value="link_removed">Link removed</SelectItem>
                <SelectItem value="link_toggled">Link toggled</SelectItem>
                <SelectItem value="cache_flushed">Cache flushed</SelectItem>
                <SelectItem value="cache_reloaded">Cache reloaded</SelectItem>
                <SelectItem value="csv_imported">CSV imported</SelectItem>
                <SelectItem value="notification_sent">Notification sent</SelectItem>
                <SelectItem value="settings_updated">Settings updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={History}
            title="No audit events match"
            description="Try clearing the search or switching the action filter."
          />
        ) : (
          <div className="-mx-5 -mb-5">
            {/* Timeline */}
            <div className="relative">
              {filtered.map((event, idx) => {
                const Icon = ACTION_ICONS[event.action];
                const tone = ACTION_TONES[event.action];
                const isSystem = event.actorName === "System";
                return (
                  <div
                    key={event.id}
                    className="relative flex gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70"
                  >
                    {/* Timeline rail */}
                    {idx !== filtered.length - 1 && (
                      <div className="absolute left-[33px] top-12 bottom-0 w-px bg-slate-200" />
                    )}
                    <div
                      className={cn(
                        "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white",
                        tone,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">{event.actorName}</span>{" "}
                          {ACTION_VERBS[event.action]}
                          {event.target && (
                            <>
                              {" "}
                              <span className="font-medium text-slate-900">{event.target}</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                        <Badge
                          variant="outline"
                          className={cn("border-transparent text-[10px]", tone)}
                        >
                          {ACTION_LABELS[event.action]}
                        </Badge>
                        <span>·</span>
                        <span>{formatDateTime(event.createdAt)}</span>
                        <span>·</span>
                        <code className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">{event.ip}</code>
                        {!isSystem && (
                          <>
                            <span>·</span>
                            <span>{event.actorEmail}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
