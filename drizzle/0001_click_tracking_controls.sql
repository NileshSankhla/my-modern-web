CREATE TYPE "public"."click_tracking_status" AS ENUM('unreviewed', 'tracked', 'approved');--> statement-breakpoint
ALTER TABLE "clicks" ADD COLUMN "tracking_status" "click_tracking_status" DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE "clicks" ADD COLUMN "reward_amount_in_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clicks" ADD COLUMN "reviewed_by_admin_id" integer;--> statement-breakpoint
ALTER TABLE "clicks" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN "source_click_id" uuid;--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_reviewed_by_admin_id_users_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_source_click_id_clicks_id_fk" FOREIGN KEY ("source_click_id") REFERENCES "public"."clicks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clicks_tracking_status_idx" ON "clicks" USING btree ("tracking_status");--> statement-breakpoint
CREATE INDEX "clicks_reviewed_by_admin_id_idx" ON "clicks" USING btree ("reviewed_by_admin_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_source_click_id_idx" ON "wallet_transactions" USING btree ("source_click_id");
