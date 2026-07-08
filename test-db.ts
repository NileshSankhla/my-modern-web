import { db } from "./src/lib/db";
import { wallets, users, walletTransactions } from "./src/lib/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  console.log("Users:");
  const u = await db.select().from(users).limit(5);
  console.log(u);
  
  console.log("\nWallets:");
  const w = await db.select().from(wallets).limit(5);
  console.log(w);
  
  console.log("\nTransactions:");
  const tx = await db.select().from(walletTransactions).limit(5);
  console.log(tx);
}

run().catch(console.error).finally(() => process.exit(0));
