-- Add forensic tracking columns to clicks
ALTER TABLE "clicks" ADD COLUMN IF NOT EXISTS "ip_address" varchar(45);--> statement-breakpoint
ALTER TABLE "clicks" ADD COLUMN IF NOT EXISTS "user_agent" text;--> statement-breakpoint
ALTER TABLE "clicks" ADD COLUMN IF NOT EXISTS "referrer_url" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clicks_ip_address_idx" ON "clicks" USING btree ("ip_address");--> statement-breakpoint

-- Add unhackable ledger columns to wallet_transactions (nullable during backfill)
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "wallet_id" integer;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "sequence_number" integer;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "balance_after_in_paise" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_transactions_wallet_id_idx" ON "wallet_transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_transactions_wallet_id_sequence_idx" ON "wallet_transactions" USING btree ("wallet_id", "sequence_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_transactions_wallet_id_sequence_unique" ON "wallet_transactions" USING btree ("wallet_id", "sequence_number") WHERE "wallet_id" IS NOT NULL AND "sequence_number" IS NOT NULL;--> statement-breakpoint

-- Add ledger sync anchor to wallets
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "last_ledger_sequence" integer DEFAULT 0 NOT NULL;
