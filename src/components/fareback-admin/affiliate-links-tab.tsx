"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  Search,
  Plus,
  Trash2,
  ExternalLink,
  Link2,
  Copy,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Activity,
  AlertCircle,
  CheckCircle2,
  Database,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader, SectionCard, EmptyState } from "./primitives";
import { ConfirmDialog } from "./confirm-dialog";
import { type AffiliateLink, formatNumber, formatDateTime } from "./data";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  addAffiliateLinkAction,
  updateAffiliateLinkAction,
  removeAffiliateLinkAction,
  toggleAffiliateLinkAction,
  reloadRedisLinksAction,
  getRedisStatsAction,
  resetAffiliateLinkCounterAction,
  flushAffiliateRedisKeysAction,
} from "@/app/actions/affiliate-links";

type SortKey = "linkNumber" | "clicks" | "addedAt";

interface RedisStats {
  connected: boolean;
  totalKeys: number;
  affiliateLinkCount: number;
  counterValue: number | null;
  error?: string;
}

export function AffiliateLinksTab({
  affiliateLinks: initialLinks,
}: {
  affiliateLinks: AffiliateLink[];
}) {
  const { toast } = useToast();
  const [links, setLinks] = useState<AffiliateLink[]>(initialLinks);
  const [newUrl, setNewUrl] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("linkNumber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [removeTarget, setRemoveTarget] = useState<AffiliateLink | null>(null);
  const [editTarget, setEditTarget] = useState<AffiliateLink | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [redisStats, setRedisStats] = useState<RedisStats | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const copy = [...links];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "linkNumber") cmp = a.linkNumber - b.linkNumber;
      else if (sortKey === "clicks") cmp = a.clicks - b.clicks;
      else cmp = a.addedAt.localeCompare(b.addedAt);
      return sortDir === "asc" ? cmp : -cmp;
    });
    if (!query.trim()) return copy;
    const q = query.toLowerCase();
    return copy.filter(
      (l) => l.url.toLowerCase().includes(q) || l.tag.toLowerCase().includes(q),
    );
  }, [links, query, sortKey, sortDir]);

  const showResult = useCallback(
    (result: { success?: string; error?: string }, onSuccess?: () => void) => {
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Done", description: result.success });
        onSuccess?.();
      }
    },
    [toast],
  );

  // ── ADD ──────────────────────────────────────────────────────────────────────
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    startTransition(async () => {
      const result = await addAffiliateLinkAction(newUrl.trim());
      showResult(result, () => {
        // Optimistic append — page will revalidate on next visit
        const tag = newUrl.includes("tag=") ? newUrl.split("tag=")[1].split("&")[0] : "unknown";
        const newLink: AffiliateLink = {
          id: result.linkId ?? Math.max(...links.map((l) => l.id), 0) + 1,
          linkNumber: Math.max(...links.map((l) => l.linkNumber), 0) + 1,
          url: newUrl.trim(),
          tag,
          isActive: true,
          clicks: 0,
          addedAt: new Date().toISOString().slice(0, 10),
        };
        setLinks((prev) => [...prev, newLink]);
        setNewUrl("");
      });
    });
  };

  // ── TOGGLE ───────────────────────────────────────────────────────────────────
  const handleToggle = (id: number) => {
    const link = links.find((l) => l.id === id);
    if (!link) return;
    const nextState = !link.isActive;
    // Optimistic update
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, isActive: nextState } : l)));
    startTransition(async () => {
      const result = await toggleAffiliateLinkAction(id, nextState);
      if (result.error) {
        // Revert on failure
        setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, isActive: !nextState } : l)));
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: nextState ? "Link activated" : "Link paused", description: result.success });
      }
    });
  };

  // ── REMOVE ───────────────────────────────────────────────────────────────────
  const confirmRemove = () => {
    if (!removeTarget) return;
    startTransition(async () => {
      const result = await removeAffiliateLinkAction(removeTarget.id);
      showResult(result, () => {
        setLinks((prev) => prev.filter((l) => l.id !== removeTarget.id));
      });
      setRemoveTarget(null);
    });
  };

  // ── EDIT ─────────────────────────────────────────────────────────────────────
  const openEdit = (link: AffiliateLink) => {
    setEditTarget(link);
    setEditUrl(link.url);
  };
  const confirmEdit = () => {
    if (!editTarget) return;
    startTransition(async () => {
      const result = await updateAffiliateLinkAction(editTarget.id, editUrl);
      showResult(result, () => {
        const tag = editUrl.includes("tag=") ? editUrl.split("tag=")[1].split("&")[0] : editTarget.tag;
        setLinks((prev) =>
          prev.map((l) => (l.id === editTarget.id ? { ...l, url: editUrl.trim(), tag } : l)),
        );
      });
      setEditTarget(null);
      setEditUrl("");
    });
  };

  // ── REDIS ─────────────────────────────────────────────────────────────────────
  const handleRefreshRedis = () => {
    startTransition(async () => {
      const result = await reloadRedisLinksAction();
      showResult(result);
    });
  };

  const handleLoadRedisStats = () => {
    startTransition(async () => {
      const stats = await getRedisStatsAction();
      setRedisStats(stats);
    });
  };

  const handleResetCounter = () => {
    startTransition(async () => {
      const result = await resetAffiliateLinkCounterAction();
      showResult(result, () => setRedisStats((s) => s ? { ...s, counterValue: 0 } : s));
    });
  };

  const handleFlushAffiliateCache = () => {
    startTransition(async () => {
      const result = await flushAffiliateRedisKeysAction();
      showResult(result, () => setRedisStats((s) => s ? { ...s, affiliateLinkCount: 0, counterValue: 0 } : s));
    });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard?.writeText(url).catch(() => {});
    toast({ title: "URL copied to clipboard" });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const activeCount = links.filter((l) => l.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Affiliate Link Manager"
        description="Manage Amazon affiliate URLs in the click-rotation pool. All changes sync to Redis instantly."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
              {activeCount} active
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
              {links.length} total
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
              {formatNumber(totalClicks)} clicks
            </Badge>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* ── Left column: Add + Redis Controls ─── */}
        <div className="space-y-4">
          {/* Add link */}
          <SectionCard title="Add new link" description="Paste an Amazon URL with your affiliate tag">
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label htmlFor="link-url" className="mb-1.5 block text-xs font-medium text-slate-700">
                  Amazon Affiliate URL
                </label>
                <Input
                  id="link-url"
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://www.amazon.in/?tag=yourstore-21"
                  className="border-slate-200 focus-visible:ring-violet-500/40"
                  disabled={isPending}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Must be <code className="rounded bg-slate-100 px-1">amazon.in</code> or{" "}
                  <code className="rounded bg-slate-100 px-1">amazon.com</code> with a{" "}
                  <code className="rounded bg-slate-100 px-1">?tag=</code> parameter.
                </p>
              </div>
              <Button
                type="submit"
                disabled={isPending || !newUrl.trim()}
                className="w-full bg-violet-600 text-white hover:bg-violet-700"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {isPending ? "Saving…" : "Add to rotation"}
              </Button>
            </form>
          </SectionCard>

          {/* Redis Controls */}
          <SectionCard title="Redis Cache" description="Affiliate links are cached in Redis for fast rotation">
            <div className="space-y-3">
              {/* Stats panel */}
              {redisStats && (
                <div className={cn(
                  "rounded-xl border p-3 text-xs space-y-1",
                  redisStats.connected
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-rose-200 bg-rose-50",
                )}>
                  <div className="flex items-center gap-1.5 font-semibold">
                    {redisStats.connected
                      ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /><span className="text-emerald-700">Connected</span></>
                      : <><AlertCircle className="h-3.5 w-3.5 text-rose-600" /><span className="text-rose-700">Disconnected</span></>
                    }
                    {redisStats.error && <span className="text-rose-500">— {redisStats.error}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-slate-600">
                    <span>Total keys:</span><span className="font-mono font-semibold">{redisStats.totalKeys}</span>
                    <span>Links in Redis:</span><span className="font-mono font-semibold">{redisStats.affiliateLinkCount}</span>
                    <span>Rotation counter:</span><span className="font-mono font-semibold">{redisStats.counterValue ?? "—"}</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-slate-200 text-xs"
                  onClick={handleLoadRedisStats}
                  disabled={isPending}
                >
                  <Activity className="mr-2 h-3.5 w-3.5 text-slate-400" />
                  Check Redis status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-emerald-200 text-xs text-emerald-700 hover:bg-emerald-50"
                  onClick={handleRefreshRedis}
                  disabled={isPending}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Sync DB → Redis
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-amber-200 text-xs text-amber-700 hover:bg-amber-50"
                  onClick={handleResetCounter}
                  disabled={isPending}
                >
                  <Zap className="mr-2 h-3.5 w-3.5" />
                  Reset rotation counter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-rose-200 text-xs text-rose-600 hover:bg-rose-50"
                  onClick={handleFlushAffiliateCache}
                  disabled={isPending}
                >
                  <Database className="mr-2 h-3.5 w-3.5" />
                  Flush affiliate cache only
                </Button>
              </div>
              <p className="text-[10px] text-slate-400">
                "Sync DB → Redis" is safe to run anytime. The database is always the source of truth.
                Flushing only removes affiliate rotation keys — sessions and idempotency keys are preserved.
              </p>
            </div>
          </SectionCard>
        </div>

        {/* ── Right column: Links table ─── */}
        <SectionCard
          title="Rotation pool"
          description="All active links rotate in sequence per user per day. Disable to pause without deleting."
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search URL or tag…"
                className="h-8 w-56 border-slate-200 pl-8 text-xs focus-visible:ring-violet-500/40"
              />
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No links found"
              description="Add a new affiliate link to start the rotation."
            />
          ) : (
            <div className="-mx-5 -mb-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2.5 font-medium">
                      <SortButton label="#" active={sortKey === "linkNumber"} dir={sortDir} onClick={() => toggleSort("linkNumber")} />
                    </th>
                    <th className="px-3 py-2.5 font-medium">URL &amp; tag</th>
                    <th className="px-3 py-2.5 font-medium">
                      <SortButton label="Clicks" active={sortKey === "clicks"} dir={sortDir} onClick={() => toggleSort("clicks")} />
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      <SortButton label="Added" active={sortKey === "addedAt"} dir={sortDir} onClick={() => toggleSort("addedAt")} />
                    </th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((link) => (
                    <tr key={link.id} className={cn("transition-colors hover:bg-slate-50/70", !link.isActive && "opacity-50")}>
                      <td className="px-5 py-3 align-middle">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-[11px] font-semibold text-slate-600">
                          {link.linkNumber}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                            {link.tag}
                          </code>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 transition-colors hover:text-violet-600"
                            aria-label="Open URL"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <p className="mt-0.5 max-w-[260px] truncate text-[11px] text-slate-400" title={link.url}>
                          {link.url}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-middle tabular-nums text-slate-700">
                        {formatNumber(link.clicks)}
                      </td>
                      <td className="px-3 py-3 align-middle text-xs text-slate-500">
                        {new Date(link.addedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={link.isActive}
                            onCheckedChange={() => handleToggle(link.id)}
                            aria-label="Toggle link"
                            disabled={isPending}
                          />
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              link.isActive
                                ? "border-violet-200 bg-violet-50 text-violet-700"
                                : "border-slate-200 bg-slate-50 text-slate-500",
                            )}
                          >
                            {link.isActive ? "Active" : "Paused"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right align-middle">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 border-slate-200">
                            <DropdownMenuItem className="text-xs text-slate-700" onClick={() => copyUrl(link.url)}>
                              <Copy className="mr-2 h-3.5 w-3.5 text-slate-400" /> Copy URL
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-xs text-slate-700" onClick={() => openEdit(link)}>
                              <Pencil className="mr-2 h-3.5 w-3.5 text-slate-400" /> Edit URL
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-xs text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                              onClick={() => setRemoveTarget(link)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Remove Confirm Dialog ─── */}
      <ConfirmDialog
        config={{
          open: !!removeTarget,
          title: "Remove this affiliate link?",
          description: (
            <span>
              <code className="rounded bg-slate-100 px-1">{removeTarget?.tag}</code> will be removed
              from the rotation pool. Click history for this tag is preserved in the audit log.
            </span>
          ),
          confirmLabel: isPending ? "Removing…" : "Remove link",
          tone: "danger",
          onConfirm: confirmRemove,
          onCancel: () => setRemoveTarget(null),
        }}
      />

      {/* ── Edit URL Dialog ─── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); setEditUrl(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit affiliate link #{editTarget?.linkNumber}</DialogTitle>
            <DialogDescription>
              Update the Amazon affiliate URL. The tag must remain valid. Redis will be synced automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="edit-url" className="block text-xs font-medium text-slate-700">
              New URL
            </label>
            <Input
              id="edit-url"
              type="url"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder="https://www.amazon.in/?tag=yourstore-21"
              className="border-slate-200 focus-visible:ring-violet-500/40"
            />
            <p className="text-[11px] text-slate-400">
              Must be <code className="rounded bg-slate-100 px-1">amazon.in</code> or{" "}
              <code className="rounded bg-slate-100 px-1">amazon.com</code> with{" "}
              <code className="rounded bg-slate-100 px-1">?tag=</code>.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTarget(null); setEditUrl(""); }}>
              Cancel
            </Button>
            <Button
              className="bg-violet-600 text-white hover:bg-violet-700"
              onClick={confirmEdit}
              disabled={isPending || !editUrl.trim()}
            >
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-slate-900",
        active && "text-violet-700",
      )}
    >
      {label}
      {active &&
        (dir === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        ))}
    </button>
  );
}
