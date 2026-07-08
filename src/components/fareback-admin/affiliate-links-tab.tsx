"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, SectionCard, EmptyState,  } from "./primitives";
import { ConfirmDialog } from "./confirm-dialog";
import { type AffiliateLink, formatNumber, formatDateTime } from "./data";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type SortKey = "linkNumber" | "clicks" | "addedAt";

export function AffiliateLinksTab({ affiliateLinks }: { affiliateLinks: AffiliateLink[] }) {
  const { toast } = useToast();
  const [links, setLinks] = useState<AffiliateLink[]>(affiliateLinks);
  const [newUrl, setNewUrl] = useState("");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("linkNumber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [removeTarget, setRemoveTarget] = useState<AffiliateLink | null>(null);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    if (!newUrl.includes("tag=")) {
      toast({
        title: "Missing affiliate tag",
        description: "URL must include a `?tag=` parameter.",
        variant: "destructive",
      });
      return;
    }
    setAdding(true);
    await new Promise((r) => setTimeout(r, 500));
    setAdding(false);
    const tag = newUrl.split("tag=")[1]?.split("&")[0] ?? `fareback-${links.length + 20}`;
    const newLink: AffiliateLink = {
      id: Math.max(...links.map((l) => l.id), 0) + 1,
      linkNumber: Math.max(...links.map((l) => l.linkNumber), 0) + 1,
      url: newUrl.trim(),
      tag,
      isActive: true,
      clicks: 0,
      addedAt: new Date().toISOString().slice(0, 10),
    };
    setLinks((prev) => [...prev, newLink]);
    toast({
      title: "Link added to rotation",
      description: `${tag} is now active.`,
    });
    setNewUrl("");
  };

  const toggle = (id: number) => {
    setLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, isActive: !l.isActive } : l)),
    );
    const link = links.find((l) => l.id === id);
    toast({
      title: link?.isActive ? "Link disabled" : "Link enabled",
      description: `${link?.tag} is now ${link?.isActive ? "inactive" : "active"}.`,
    });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard?.writeText(url).catch(() => {});
    toast({ title: "URL copied to clipboard" });
  };

  const confirmRemove = () => {
    if (!removeTarget) return;
    setLinks((prev) => prev.filter((l) => l.id !== removeTarget.id));
    toast({
      title: "Link removed",
      description: `${removeTarget.tag} is no longer in rotation.`,
      variant: "destructive",
    });
    setRemoveTarget(null);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const activeCount = links.filter((l) => l.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Affiliate links"
        description="Manage Amazon partner URLs in the click-rotation pool."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
              {activeCount} active
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
              {formatNumber(totalClicks)} total clicks
            </Badge>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* Add link */}
        <SectionCard
          title="Add new link"
          description="Paste an Amazon URL with your affiliate tag"
        >
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label htmlFor="link-url" className="mb-1.5 block text-xs font-medium text-slate-700">
                Amazon URL
              </label>
              <Input
                id="link-url"
                type="url"
                required
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://www.amazon.in/?tag=fareback-21"
                className="border-slate-200 focus-visible:ring-violet-500/40"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Must include <code className="rounded bg-slate-100 px-1 text-[10px]">?tag=</code> parameter.
              </p>
            </div>
            <Button
              type="submit"
              disabled={adding || !newUrl.trim()}
              className="w-full bg-violet-600 text-white hover:bg-violet-700"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {adding ? "Adding…" : "Add to rotation"}
            </Button>
          </form>
        </SectionCard>

        {/* Table */}
        <SectionCard
          title="Rotation pool"
          description="Click column headers to sort. Use the switch to enable/disable a link."
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search URL or tag"
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
                    <tr key={link.id} className="transition-colors hover:bg-slate-50/70">
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
                        {new Date(link.addedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={link.isActive}
                            onCheckedChange={() => toggle(link.id)}
                            aria-label="Toggle link"
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
                            <DropdownMenuItem
                              className="text-xs text-slate-700"
                              onClick={() => copyUrl(link.url)}
                            >
                              <Copy className="mr-2 h-3.5 w-3.5 text-slate-400" /> Copy URL
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-xs text-slate-700"
                              onClick={() => toast({ title: "Edit coming soon" })}
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5 text-slate-400" /> Edit
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

      <ConfirmDialog
        config={{
          open: !!removeTarget,
          title: "Remove this affiliate link?",
          description: (
            <span>
              <code className="rounded bg-slate-100 px-1">{removeTarget?.tag}</code> will be removed
              from the rotation pool. Existing clicks are preserved in the audit log.
            </span>
          ),
          confirmLabel: "Remove link",
          tone: "danger",
          onConfirm: confirmRemove,
          onCancel: () => setRemoveTarget(null),
        }}
      />
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
