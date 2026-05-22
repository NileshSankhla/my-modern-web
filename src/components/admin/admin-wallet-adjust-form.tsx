"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import {
  adminAdjustWalletAction,
} from "@/app/actions/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SubmitButton = () => {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Processing..." : "Execute Adjustment"}
    </Button>
  );
};

const AdminWalletAdjustForm = () => {
  const router = useRouter();
  const [state, formAction] = useActionState(
    adminAdjustWalletAction,
    {},
  );
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const normalized = query.trim();

    if (normalized.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/users/search?mode=basic&limit=8&q=${encodeURIComponent(normalized)}`,
          { signal: controller.signal, cache: "no-store" },
        );

        if (!response.ok) {
          return;
        }

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
  }, [query]);

  const visibleSuggestions = query.trim().length < 2 ? [] : suggestions;

  useEffect(() => {
    if (!state.success) {
      return;
    }

    router.refresh();
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex-1">
          <Input
            name="userEmail"
            placeholder="Target User Email"
            required
            list="admin-user-email-suggestions"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full focus-visible:ring-1"
          />
          <datalist id="admin-user-email-suggestions">
            {visibleSuggestions.map((email) => (
              <option key={email} value={email} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            name="walletType"
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            defaultValue="cashback"
          >
            <option value="cashback">Cashback Wallet</option>
            <option value="amazon_rewards">Amazon Rewards Wallet</option>
          </select>
          <select
            name="type"
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            defaultValue="credit"
          >
            <option value="credit">Credit (+)</option>
            <option value="debit">Debit (-)</option>
          </select>
          <div className="relative sm:col-span-2 lg:col-span-2">
            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">INR</span>
            <Input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              required
              inputMode="decimal"
              className="w-full pl-10 focus-visible:ring-1"
            />
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex-1 text-sm">
          {state.error ? <p className="font-medium text-destructive">{state.error}</p> : null}
          {state.success ? <p className="font-medium text-emerald-600">{state.success}</p> : null}
        </div>
        <SubmitButton />
      </div>
    </form>
  );
};

export default AdminWalletAdjustForm;
