"use client";

import { useMemo, useState } from "react";
import { Send, Search, Megaphone, User, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader, SectionCard, EmptyState } from "./primitives";
import { AdminRole, type NotificationRecord, formatDateTime } from "./data";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const MAX_LEN = 300;

export function CommunicationsTab({ notificationLog }: { notificationLog: NotificationRecord[] }) {
  const { toast } = useToast();
  const [recipientType, setRecipientType] = useState<"all" | "single">("all");
  const [userEmail, setUserEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<NotificationRecord[]>(notificationLog);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return log;
    const q = query.toLowerCase();
    return log.filter(
      (n) =>
        n.message.toLowerCase().includes(q) ||
        n.sentBy.toLowerCase().includes(q) ||
        (n.recipient ?? "").toLowerCase().includes(q),
    );
  }, [log, query]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast({ title: "Message required", variant: "destructive" });
      return;
    }
    if (recipientType === "single" && !userEmail.trim()) {
      toast({ title: "Recipient email required", variant: "destructive" });
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 700));
    setSending(false);
    const newRec: NotificationRecord = {
      id: `N-${5013 + log.length}`,
      recipientType,
      recipient: recipientType === "single" ? userEmail : undefined,
      message,
      sentBy: "Aarav Mehta",
      sentAt: new Date().toISOString(),
    };
    setLog((prev) => [newRec, ...prev]);
    toast({
      title: "Notification sent",
      description:
        recipientType === "all"
          ? "Broadcast delivered to all users."
          : `Delivered to ${userEmail}.`,
    });
    setMessage("");
    setUserEmail("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications"
        description="Send platform-wide broadcasts or targeted alerts to individual users."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Compose */}
        <SectionCard
          title="Compose notification"
          description="Pick a recipient scope and write a short message"
        >
          <form onSubmit={handleSend} className="space-y-4">
            {/* Recipient scope toggle */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Recipient</label>
              <div className="grid grid-cols-2 gap-2">
                <ScopeButton
                  active={recipientType === "all"}
                  onClick={() => setRecipientType("all")}
                  icon={Users}
                  label="All users"
                  description="Broadcast to everyone"
                />
                <ScopeButton
                  active={recipientType === "single"}
                  onClick={() => setRecipientType("single")}
                  icon={User}
                  label="Single user"
                  description="Targeted alert"
                />
              </div>
            </div>

            {recipientType === "single" && (
              <div>
                <label htmlFor="comm-email" className="mb-1.5 block text-xs font-medium text-slate-700">
                  Recipient email
                </label>
                <Input
                  id="comm-email"
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="border-slate-200 focus-visible:ring-violet-500/40"
                />
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="comm-msg" className="text-xs font-medium text-slate-700">
                  Message
                </label>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    message.length > MAX_LEN - 30 ? "text-amber-600" : "text-slate-400",
                  )}
                >
                  {message.length}/{MAX_LEN}
                </span>
              </div>
              <Textarea
                id="comm-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
                placeholder="Write a clear, concise message for users."
                rows={5}
                className="resize-none border-slate-200 text-sm focus-visible:ring-violet-500/40"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-slate-200"
                onClick={() => {
                  setMessage("");
                  setUserEmail("");
                }}
              >
                Clear
              </Button>
              <Button
                type="submit"
                disabled={sending}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {sending ? "Sending…" : "Send notification"}
              </Button>
            </div>
          </form>
        </SectionCard>

        {/* Log */}
        <SectionCard
          title="Notification history"
          description="Most recent messages sent from this console"
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search log"
                className="h-8 w-48 border-slate-200 pl-8 text-xs focus-visible:ring-violet-500/40"
              />
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No notifications yet"
              description="Sent broadcasts and alerts will appear here."
            />
          ) : (
            <div className="-mx-5 -mb-5 divide-y divide-slate-100">
              {filtered.map((n) => (
                <div key={n.id} className="px-5 py-3.5 transition-colors hover:bg-slate-50/70">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                      <Megaphone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700">{n.message}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-slate-200 text-[10px]",
                            n.recipientType === "all"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-violet-50 text-violet-700",
                          )}
                        >
                          {n.recipientType === "all" ? "All users" : n.recipient}
                        </Badge>
                        <span>·</span>
                        <span>by {n.sentBy}</span>
                        <span>·</span>
                        <span>{formatDateTime(n.sentAt)}</span>
                      </div>
                    </div>
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ScopeButton({
  active,
  onClick,
  icon: Icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-violet-300 bg-violet-50"
          : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4",
          active ? "text-violet-600" : "text-slate-400",
        )}
      />
      <div>
        <p className={cn("text-sm font-semibold", active ? "text-violet-900" : "text-slate-900")}>
          {label}
        </p>
        <p className="text-[11px] text-slate-500">{description}</p>
      </div>
    </button>
  );
}
