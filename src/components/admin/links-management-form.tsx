"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addAffiliateLinkAction,
  removeAffiliateLinkAction,
  toggleAffiliateLinkAction,
} from "@/app/actions/affiliate-links";
import {
  Trash2,
  Plus,
  ExternalLink,
  Loader2,
  Check,
  X,
  Link2,
} from "lucide-react";

interface AffiliateLink {
  id: number;
  linkNumber: number;
  url: string;
  isActive: boolean;
}

export function LinksManagementForm({ links }: { links: AffiliateLink[] }) {
  const [newUrl, setNewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await addAffiliateLinkAction(newUrl);
      if (res?.error) throw new Error(res.error);
      setMessage({ text: res.success || "Added.", type: "success" });
      setNewUrl("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setMessage({ text: message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remove this link?")) return;
    setLoading(true);
    try {
      await removeAffiliateLinkAction(id);
      setMessage({ text: "Link removed.", type: "success" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setMessage({ text: message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: number, currentStatus: boolean) => {
    setLoading(true);
    try {
      await toggleAffiliateLinkAction(id, !currentStatus);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setMessage({ text: message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Add form */}
      <form onSubmit={handleAdd} className="space-y-2">
        <label
          htmlFor="url"
          className="text-xs font-medium text-slate-700"
        >
          Add new Amazon URL (with tag)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            id="url"
            type="url"
            placeholder="https://amazon.in/?tag=your-tag"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            required
            className="border-slate-200 bg-white transition-all focus-visible:ring-emerald-500/30"
          />
          <Button
            type="submit"
            disabled={loading || !newUrl}
            className="group shrink-0 rounded-xl bg-emerald-600 text-white transition-all hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="mr-1.5 h-4 w-4 transition-transform group-hover:rotate-90" />
                Add Link
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Inline message */}
      {message && (
        <div
          className={`fade-in-up flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
            message.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {message.type === "success" ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Links table */}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5">No.</th>
              <th className="px-3 py-2.5">URL</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link, idx) => (
              <tr
                key={link.id}
                className={`border-t border-slate-100 transition-colors hover:bg-slate-50/60 ${
                  idx % 2 === 1 ? "bg-slate-50/30" : ""
                }`}
              >
                <td className="px-3 py-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-xs font-semibold text-slate-600">
                    {link.linkNumber}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="h-3 w-3 shrink-0 text-slate-400" />
                    <span
                      className="block max-w-[200px] truncate text-slate-700"
                      title={link.url}
                    >
                      {link.url}
                    </span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 transition-colors hover:text-emerald-600"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {/* iOS-style toggle switch */}
                  <button
                    onClick={() => handleToggle(link.id, link.isActive)}
                    disabled={loading}
                    className={`group relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      link.isActive
                        ? "bg-emerald-500"
                        : "bg-slate-300"
                    }`}
                    aria-label={link.isActive ? "Disable link" : "Enable link"}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                        link.isActive ? "translate-x-[18px]" : "translate-x-1"
                      }`}
                    />
                  </button>
                </td>
                <td className="px-3 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(link.id)}
                    disabled={loading}
                    className="h-8 w-8 rounded-lg p-0 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {links.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  <Link2 className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  No tracking links found. Add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {links.length > 0 && (
        <p className="text-xs text-slate-400">
          {links.length} link{links.length === 1 ? "" : "s"} in rotation ·{" "}
          {links.filter((l) => l.isActive).length} active
        </p>
      )}
    </div>
  );
}
