import { db } from "./src/lib/db/index.js";
import { users, wallets } from "./src/lib/db/schema.js";
import { sql } from "drizzle-orm";

async function run() {
  const query = db
    .select({
      userId: users.id,
      cashbackBalance: sql`coalesce((select sum(${wallets.balanceInPaise})::int from ${wallets} where ${wallets.userId} = ${users.id} and ${wallets.walletType} = 'cashback'), 0)`,
    })
    .from(users)
    .toSQL();
  console.log(query);
}
run();
