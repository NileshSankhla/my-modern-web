"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, Megaphone, User, Users } from "lucide-react";

import { adminSendAlertAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SubmitButton = () => {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="group w-full rounded-2xl bg-rose-600 text-white transition-all hover:bg-rose-700 disabled:opacity-60 sm:w-auto"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <Megaphone className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
          Send Alert
        </>
      )}
    </Button>
  );
};

const AdminAlertForm = () => {
  const [state, formAction] = useActionState(adminSendAlertAction, {});
  const [userEmail, setUserEmail] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recipientType, setRecipientType] = useState<"all" | "single">("all");

  useEffect(() => {
    const normalized = userEmail.trim();
    if (normalized.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/users/search?mode=basic&limit=8&q=${encodeURIComponent(normalized)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          users?: Array<{ email: string }>;
        };
        setSuggestions((data.users ?? []).map((user) => user.email));
      } catch {
        // Ignore canceled requests and transient fetch errors.
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [userEmail]);

  const visibleSuggestions = userEmail.trim().length < 2 ? [] : suggestions;

  return (
    <form action={formAction} className="space-y-4">
      {/* Recipient toggle */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-700">
          Recipient
        </label>
        <div className="grid grid-cols-2 gap-2">
          <RecipientButton
            active={recipientType === "all"}
            onClick={() => setRecipientType("all")}
            icon={Users}
            label="All users"
          />
          <RecipientButton
            active={recipientType === "single"}
            onClick={() => setRecipientType("single")}
            icon={User}
            label="Single user"
          />
        </div>
        {/* Hidden field syncs with state */}
        <input type="hidden" name="recipientType" value={recipientType} />
      </div>

      {/* Email input (only when single) */}
      {recipientType === "single" && (
        <div className="space-y-2">
          <label
            htmlFor="userEmail"
            className="text-xs font-medium text-slate-700"
          >
            User email
          </label>
          <Input
            name="userEmail"
            placeholder="user@example.com"
            list="admin-alert-email-suggestions"
            autoComplete="off"
            value={userEmail}
            onChange={(event) => setUserEmail(event.target.value)}
            className="border-slate-200 bg-white transition-all focus-visible:ring-rose-500/30"
          />
          <datalist id="admin-alert-email-suggestions">
            {visibleSuggestions.map((email) => (
              <option key={email} value={email} />
            ))}
          </datalist>
          {visibleSuggestions.length > 0 && (
            <div className="fade-in-up flex flex-wrap gap-1.5 pt-1">
              {visibleSuggestions.slice(0, 4).map((email) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => setUserEmail(email)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                >
                  {email}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message textarea */}
      <div className="space-y-2">
        <label
          htmlFor="message"
          className="text-xs font-medium text-slate-700"
        >
          Alert message
        </label>
        <textarea
          name="message"
          placeholder="Write alert message for users"
          required
          maxLength={300}
          className="min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-all placeholder:text-slate-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
        />
        <p className="text-right text-[11px] text-slate-400">Max 300 characters</p>
      </div>

      {/* Inline feedback */}
      {state.error ? (
        <div className="fade-in-up rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="fade-in-up flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <Check className="h-4 w-4 text-emerald-600" />
          {state.success}
        </div>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
};

function RecipientButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-medium transition-all ${
        active
          ? "border-rose-300 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export default AdminAlertForm;
