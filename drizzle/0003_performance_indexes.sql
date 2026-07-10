CREATE INDEX "clicks_user_id_created_at_idx" ON "clicks" USING btree ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX "clicks_user_status_created_at_idx" ON "clicks" USING btree ("user_id", "tracking_status", "created_at");--> statement-breakpoint
CREATE INDEX "sessions_token_expires_at_idx" ON "sessions" USING btree ("token", "expires_at");--> statement-breakpoint
CREATE INDEX "wallet_transactions_user_id_created_at_idx" ON "wallet_transactions" USING btree ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX "withdrawal_requests_user_status_created_at_idx" ON "withdrawal_requests" USING btree ("user_id", "status", "created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id", "is_read");--> statement-breakpoint
CREATE INDEX "notifications_user_created_at_idx" ON "notifications" USING btree ("user_id", "created_at");