import { db } from "./src/lib/db";
import { clicks, merchants } from "./src/lib/db/schema";
import { desc } from "drizzle-orm";

async function run() {
  const latestClicks = await db.select().from(clicks).orderBy(desc(clicks.createdAt)).limit(5);
  console.log("Latest Clicks:", latestClicks);
}

run().catch(console.error).finally(() => process.exit(0));
