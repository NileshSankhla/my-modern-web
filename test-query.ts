import { db } from "./src/lib/db";
import { users, wallets } from "./src/lib/db/schema";
import { sql } from "drizzle-orm";

const query = db
  .select({
    userId: users.id,
    cashbackBalance: sql<number>`coalesce((select sum(${wallets.balanceInPaise})::int from ${wallets} where ${wallets.userId} = ${users.id} and ${wallets.walletType} = 'cashback'), 0)`,
  })
  .from(users)
  .toSQL();

console.log(query);
