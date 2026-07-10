import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Bell, CheckCheck } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";
import PageShell from "@/components/ui/page-shell";
import PageHeader from "@/components/ui/page-header";
import MarkReadOnView from "@/components/notifications/mark-read-on-view";

export const metadata: Metadata = {
  title: "Notifications | Fareback",
  description: "Your Fareback alerts and updates.",
};

const NotificationsPage = async () => {
  const user = await requireUser();

  const items = await db
    .select({
      id: notifications.id,
      message: notifications.message,
      createdAt: notifications.createdAt,
      isRead: notifications.isRead,
    })
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(200);

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <PageShell>
      <MarkReadOnView />
      <PageHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
            : "All caught up"
        }
        backHref="/profile"
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-card py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
            <Bell className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-foreground">No notifications yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We'll notify you when there are updates on your orders
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* All read indicator */}
          {unreadCount === 0 && items.length > 0 && (
            <div className="mb-2 flex items-center justify-center gap-2 rounded-xl bg-success/5 border border-success/20 py-2.5">
              <CheckCheck className="h-4 w-4 text-success" />
              <p className="text-xs font-semibold text-success">
                All notifications read
              </p>
            </div>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 transition-colors ${
                !item.isRead
                  ? "border-primary/20 bg-primary/5"
                  : "border-border/50 bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    !item.isRead ? "bg-primary/10" : "bg-muted/60"
                  }`}
                >
                  <Bell
                    className={`h-4 w-4 ${!item.isRead ? "text-primary" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {item.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                {!item.isRead && (
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default NotificationsPage;
