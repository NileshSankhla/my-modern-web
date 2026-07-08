"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { bulkApproveCSVAction } from "@/app/actions/admin-config";
import { FileSpreadsheet, Loader2, Check, AlertCircle, Upload } from "lucide-react";

export function CSVUploadForm() {
  const [csvData, setCsvData] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const rowCount = csvData.trim() ? csvData.trim().split("\n").length : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await bulkApproveCSVAction(csvData);
      if (res?.error) throw new Error(res.error);

      setMessage({
        text: res.success || "Processed successfully.",
        type: "success",
      });
      setCsvData("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setMessage({ text: message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="csv"
            className="flex items-center gap-1.5 text-sm font-medium leading-none text-slate-700"
          >
            <FileSpreadsheet className="h-4 w-4 text-amber-600" />
            Paste CSV data (clickId, amount)
          </label>
          {rowCount > 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              {rowCount} row{rowCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="relative">
          <textarea
            id="csv"
            rows={6}
            required
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            placeholder={"e.g.\n550e8400-e29b-41d4-a716-446655440000, 150.00\n73f8a401-e123-41d4-a716-123412340000, 75.50"}
            className="flex min-h-[120px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 font-mono text-sm leading-relaxed text-slate-800 transition-all placeholder:text-slate-400 focus:border-amber-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1 text-[11px] text-slate-400">
            <Upload className="h-3 w-3" />
            CSV format
          </div>
        </div>
        <p className="text-xs text-slate-400">
          One row per line. Format:{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-600">
            clickId, amount
          </code>
        </p>
      </div>

      {/* Inline message */}
      {message && (
        <div
          className={`fade-in-up flex items-start gap-2 rounded-xl p-3 text-sm ${
            message.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {message.type === "success" ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={loading || !csvData.trim()}
          className="group rounded-xl bg-amber-600 text-white transition-all hover:bg-amber-700 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              Process review CSV
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
