import { defineConfig } from "drizzle-kit";

// Migrations (db:push / db:migrate / db:studio) use the UNPOOLED (direct)
// connection so that DDL statements work correctly against Neon.
// PgBouncer in transaction mode can interfere with schema-altering DDL.
// The running app uses DATABASE_URL (pooled) instead — see src/lib/db/index.ts.
const migrationUrl =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error(
    "Set DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL before running drizzle-kit."
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
});
