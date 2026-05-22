import { and, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [counts] = await db
      .select({
        unreadCount: sql<number>`count(*)::int`,
      })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

    return NextResponse.json(
      {
        unreadCount: counts?.unreadCount ?? 0,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Unread notifications API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch unread count" },
      { status: 500 }
    );
  }
}
