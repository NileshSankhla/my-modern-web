import postgres from "postgres";

async function main() {
  console.log("Adding idempotency_key column and unique constraint...");
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    await sql`ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;`;
    console.log("Successfully added constraint.");
  } catch (error) {
    console.error("Error adding constraint:", error);
  } finally {
    await sql.end();
  }
}

main();
