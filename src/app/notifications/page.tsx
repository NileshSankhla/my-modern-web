import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import MarkReadOnView from "@/components/notifications/mark-read-on-view";

export const metadata: Metadata = {
  title: "Notifications",
  description: "User alerts from admin.",
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

  return (
    <div className="container mx-auto px-4 py-10">
      <MarkReadOnView />
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Alerts sent by admin are listed here. Opening this page marks unread alerts as read.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {items.length === 0 ? (
              <p className="text-muted-foreground">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/60 p-3">
                  <p className="font-medium">{item.message}</p>
                  <p className="text-muted-foreground">{formatDate(item.createdAt)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotificationsPage;
