"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { adminSendAlertAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SubmitButton = () => {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending..." : "Send Alert"}
    </Button>
  );
};

const AdminAlertForm = () => {
  const [state, formAction] = useActionState(adminSendAlertAction, {});
  const [userEmail, setUserEmail] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const normalized = userEmail.trim();

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
  }, [userEmail]);

  const visibleSuggestions = userEmail.trim().length < 2 ? [] : suggestions;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <select
          name="recipientType"
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue="all"
        >
          <option value="all">All users</option>
          <option value="single">Single user (email)</option>
        </select>
        <Input
          name="userEmail"
          placeholder="user@example.com (for single user)"
          list="admin-alert-email-suggestions"
          autoComplete="off"
          value={userEmail}
          onChange={(event) => setUserEmail(event.target.value)}
          className="md:col-span-2"
        />
        <datalist id="admin-alert-email-suggestions">
          {visibleSuggestions.map((email) => (
            <option key={email} value={email} />
          ))}
        </datalist>
      </div>

      <textarea
        name="message"
        placeholder="Write alert message for users"
        required
        maxLength={300}
        className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-600">{state.success}</p> : null}

      <SubmitButton />
    </form>
  );
};

export default AdminAlertForm;
