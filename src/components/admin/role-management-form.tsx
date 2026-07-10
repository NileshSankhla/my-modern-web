"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Loader2, ShieldCheck, Wallet } from "lucide-react";
import {
  setAdminAction,
  setFinanceManagerAction,
} from "@/app/actions/admin-config";

export function RoleManagementForm() {
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFinance, setIsFinance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const adminRes = await setAdminAction(email, isAdmin);
      if (adminRes?.error) throw new Error(adminRes.error);

      const financeRes = await setFinanceManagerAction(email, isFinance);
      if (financeRes?.error) throw new Error(financeRes.error);

      setMessage({ text: "Access updated successfully.", type: "success" });
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
        <label
          htmlFor="email"
          className="text-sm font-medium leading-none text-slate-700"
        >
          User email
        </label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="border-slate-200 bg-white transition-all focus-visible:ring-violet-500/30"
        />
      </div>

      <div className="grid gap-3 pt-1 sm:grid-cols-2">
        {/* Admin role card */}
        <RoleCard
          icon={ShieldCheck}
          title="Administrator"
          description="Full platform control and settings access."
          checked={isAdmin}
          onChange={setIsAdmin}
          accent="violet"
        />
        {/* Finance role card */}
        <RoleCard
          icon={Wallet}
          title="Specialist access"
          description="Controlled access for restricted internal workflows."
          checked={isFinance}
          onChange={setIsFinance}
          accent="emerald"
        />
      </div>

      {/* Inline message */}
      {message ? (
        <div
          className={`fade-in-up flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${
            message.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {message.type === "success" ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : null}
          <span>{message.text}</span>
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={loading}
        className="group w-full rounded-2xl bg-slate-950 text-white transition-all hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          "Update access"
        )}
      </Button>
    </form>
  );
}

// ── Role card (premium checkbox replacement) ────────────────────────────────

const ROLE_ACCENTS: Record<string, { active: string; icon: string }> = {
  violet: {
    active: "border-violet-300 bg-violet-50",
    icon: "bg-violet-100 text-violet-600",
  },
  emerald: {
    active: "border-emerald-300 bg-emerald-50",
    icon: "bg-emerald-100 text-emerald-600",
  },
};

function RoleCard({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  accent = "violet",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  accent?: keyof typeof ROLE_ACCENTS | string;
}) {
  const colors = ROLE_ACCENTS[accent] ?? ROLE_ACCENTS.violet;
  return (
    <label
      className={`group flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${
        checked
          ? colors.active
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {/* Custom checkbox */}
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
          checked
            ? "border-violet-600 bg-violet-600"
            : "border-slate-300 group-hover:border-slate-400"
        }`}
      >
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
              checked ? colors.icon : "bg-slate-100 text-slate-500"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold text-slate-950">{title}</span>
        </div>
        <p className="mt-1.5 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </label>
  );
}
