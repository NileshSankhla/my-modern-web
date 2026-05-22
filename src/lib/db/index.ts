import "server-only";

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

// Enforce online-only database usage for all environments.
if (/localhost|127\.0\.0\.1/.test(connectionString)) {
  throw new Error(
    "Local database URLs are disabled. Set DATABASE_URL to your Neon pooled connection string.",
  );
}

neonConfig.webSocketConstructor = ws;
// Route simple pool.query calls through fetch to avoid websocket upgrade flakiness
// in local Next.js dev, while still allowing explicit pooled transactions.
//neonConfig.poolQueryViaFetch = true;

const globalForDb = globalThis as typeof globalThis & {
  farebackPool?: Pool;
};

const pool = globalForDb.farebackPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  globalForDb.farebackPool = pool;
}

export const db = drizzle({ client: pool, schema });
