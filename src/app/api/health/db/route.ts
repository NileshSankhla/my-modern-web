import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pingResult = await db.execute(sql`select 1 as ok`);
    const countResult = await db.execute(
      sql`select count(*)::int as count from ${merchants}`
    );

    const ok = Number(pingResult.rows[0]?.ok ?? 0);
    const count = Number(countResult.rows[0]?.count ?? 0);

    return NextResponse.json({
      status: "ok",
      db: "connected",
      ping: ok,
      merchantsCount: count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    const isAuthError =
      message.includes("password authentication failed") ||
      message.includes("authentication failed");

    console.error("Database health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        code: isAuthError ? "db_auth_failed" : "db_unavailable",
        message: "Database unavailable.",
      },
      { status: 500 }
    );
  }
}
