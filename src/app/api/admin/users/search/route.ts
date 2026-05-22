import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { users, wallets } from "@/lib/db/schema";
import { rateLimitByKey } from "@/lib/rate-limit";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

const normalizeLimit = (raw: string | null) => {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
};

const cashbackBalanceSql = sql<number>`coalesce(sum(case when ${wallets.walletType} = 'cashback' then ${wallets.balanceInPaise} end)::int, 0)`;
const amazonRewardsBalanceSql = sql<number>`coalesce(sum(case when ${wallets.walletType} = 'amazon_rewards' then ${wallets.balanceInPaise} end)::int, 0)`;

export async function GET(request: Request) {
  const noStoreHeaders = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };

  try {
    const admin = await requireAdminUser();

    const rateLimitResult = await rateLimitByKey(`admin-user-search:${admin.id}`, {
      limit: 60,
      windowSeconds: 60,
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            "Retry-After": String(Math.max(1, Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000))),
          },
        },
      );
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim().slice(0, 120);
    const mode = searchParams.get("mode") === "wallet" ? "wallet" : "basic";
    const sort = searchParams.get("sort") ?? "wallet-desc";
    const limit = normalizeLimit(searchParams.get("limit"));

    const filters = q
      ? or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`))
      : null;

    if (mode === "basic") {
      const baseBasicQuery = db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
        })
        .from(users);

      const rows = filters
        ? await baseBasicQuery
            .where(filters)
            .orderBy(asc(users.email))
            .limit(limit)
        : await baseBasicQuery
            .orderBy(asc(users.email))
            .limit(limit);

      return NextResponse.json(
        { users: rows, totalCount: rows.length },
        { headers: noStoreHeaders },
      );
    }

    const orderByExpr = (() => {
      if (sort === "name-asc") {
        return asc(users.name);
      }
      if (sort === "name-desc") {
        return desc(users.name);
      }
      if (sort === "wallet-asc") {
        return asc(sql<number>`coalesce(sum(${wallets.balanceInPaise})::int, 0)`);
      }
      if (sort === "latest") {
        return desc(sql<Date>`coalesce((select max(w.updated_at) from wallets w where w.user_id = ${users.id}), now())`);
      }
      return desc(sql<number>`coalesce(sum(${wallets.balanceInPaise})::int, 0)`);
    })();

    const baseWalletQuery = db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        cashbackBalanceInPaise: cashbackBalanceSql,
        amazonRewardBalanceInPaise: amazonRewardsBalanceSql,
        updatedAt: sql<Date>`coalesce(max(${wallets.updatedAt}), now())`,
      })
      .from(users)
      .leftJoin(wallets, eq(wallets.userId, users.id));

    const rows = filters
      ? await baseWalletQuery
          .where(filters)
          .groupBy(users.id, users.email, users.name)
          .orderBy(orderByExpr, asc(users.id))
          .limit(limit)
      : await baseWalletQuery
          .groupBy(users.id, users.email, users.name)
          .orderBy(orderByExpr, asc(users.id))
          .limit(limit);

    const baseCountQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    const countRows = filters
      ? await baseCountQuery.where(filters)
      : await baseCountQuery;

    return NextResponse.json(
      {
        users: rows,
        totalCount: countRows[0]?.count ?? 0,
        limit,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("Admin user search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
