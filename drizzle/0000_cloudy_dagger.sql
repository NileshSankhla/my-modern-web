CREATE TYPE "public"."wallet_transaction_type" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('pending', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TABLE "clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"merchant_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" serial PRIMARY KEY NOT NULL,
	"network_id" integer,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"cashback_rate" text NOT NULL,
	"logo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "networks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"postback_secret" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "networks_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"password_hash" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "wallet_transaction_type" NOT NULL,
	"amount_in_paise" integer NOT NULL,
	"note" text,
	"admin_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_transactions_amount_positive" CHECK ("wallet_transactions"."amount_in_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"balance_in_paise" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "wallets_balance_non_negative" CHECK ("wallets"."balance_in_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "withdrawal_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"upi_id" varchar(255) NOT NULL,
	"amount_in_paise" integer NOT NULL,
	"status" "withdrawal_status" DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"processed_by_admin_id" integer,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "withdrawal_requests_amount_positive" CHECK ("withdrawal_requests"."amount_in_paise" > 0)
);
--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_processed_by_admin_id_users_id_fk" FOREIGN KEY ("processed_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clicks_user_id_idx" ON "clicks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clicks_merchant_id_idx" ON "clicks" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "clicks_created_at_idx" ON "clicks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "merchants_network_id_idx" ON "merchants" USING btree ("network_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "wallet_transactions_user_id_idx" ON "wallet_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_admin_user_id_idx" ON "wallet_transactions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wallets_user_id_idx" ON "wallets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "withdrawal_requests_user_id_idx" ON "withdrawal_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "withdrawal_requests_status_idx" ON "withdrawal_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "withdrawal_requests_created_at_idx" ON "withdrawal_requests" USING btree ("created_at");