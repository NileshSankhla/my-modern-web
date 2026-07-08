import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const oauthProviderEnum = pgEnum("oauth_provider", [
  "google",
  "email",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  oauthProvider: oauthProviderEnum("oauth_provider"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isFinanceManager: boolean("is_finance_manager").notNull().default(false),
  timezone: varchar("timezone", { length: 255 }).default("Asia/Kolkata"),
  updatedById: integer("updated_by_id"),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorBackupCodes: text("two_factor_backup_codes"),
  resetTokenHash: text("reset_token_hash"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  passwordHistory: text("password_history"),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const walletTransactionTypeEnum = pgEnum("wallet_transaction_type", [
  "credit",
  "debit",
]);

export const walletTypeEnum = pgEnum("wallet_type", [
  "cashback",
  "amazon_rewards",
]);

export const clickTrackingStatusEnum = pgEnum("click_tracking_status", [
  "unreviewed",
  "tracked",
  "approved",
  "deleted",
]);

export const withdrawalStatusEnum = pgEnum("withdrawal_status", [
  "pending",
  "approved",
  "rejected",
  "paid",
]);

export const giftCardRequestStatusEnum = pgEnum("gift_card_request_status", [
  "pending",
  "approved",
  "fulfilled",
  "rejected",
]);

export const networks = pgTable("networks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  postbackSecret: text("postback_secret"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const merchants = pgTable(
  "merchants",
  {
    id: serial("id").primaryKey(),
    networkId: integer("network_id").references(() => networks.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    baseUrl: text("base_url").notNull(),
    cashbackRate: text("cashback_rate").notNull(),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("merchants_network_id_idx").on(table.networkId),
    uniqueIndex("merchants_lower_name_unique").on(sql`lower(${table.name})`),
  ],
);

export const clicks = pgTable(
  "clicks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    merchantId: integer("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    trackingStatus: clickTrackingStatusEnum("tracking_status")
      .notNull()
      .default("unreviewed"),
    rewardAmountInPaise: integer("reward_amount_in_paise").notNull().default(0),
    reviewedByAdminId: integer("reviewed_by_admin_id").references(
      () => users.id,
    ),
    reviewedAt: timestamp("reviewed_at"),
    affiliateLinkIndex: integer("affiliate_link_index"),
    affiliateLinkUrl: text("affiliate_link_url"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    referrerUrl: text("referrer_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("clicks_user_id_idx").on(table.userId),
    index("clicks_user_id_created_at_idx").on(table.userId, table.createdAt),
    index("clicks_user_status_created_at_idx").on(
      table.userId,
      table.trackingStatus,
      table.createdAt,
    ),
    index("clicks_merchant_id_idx").on(table.merchantId),
    index("clicks_tracking_status_idx").on(table.trackingStatus),
    index("clicks_reviewed_by_admin_id_idx").on(table.reviewedByAdminId),
    index("clicks_created_at_idx").on(table.createdAt),
    index("clicks_ip_address_idx").on(table.ipAddress),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").unique(),
    tokenHash: text("token_hash").unique(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
    index("sessions_token_idx").on(table.token),
    index("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_token_expires_at_idx").on(table.token, table.expiresAt),
  ],
);

export const trustedDevices = pgTable(
  "trusted_devices",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    label: text("label"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    trustedUntil: timestamp("trusted_until").notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("trusted_devices_user_id_idx").on(table.userId),
    uniqueIndex("trusted_devices_user_fingerprint_unique").on(
      table.userId,
      table.fingerprint,
    ),
  ],
);

export const wallets = pgTable(
  "wallets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    walletType: walletTypeEnum("wallet_type").notNull().default("cashback"),
    balanceInPaise: integer("balance_in_paise").notNull().default(0),
    lastLedgerSequence: integer("last_ledger_sequence").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("wallets_user_id_idx").on(table.userId),
    uniqueIndex("wallets_user_id_wallet_type_unique").on(
      table.userId,
      table.walletType,
    ),
    check("wallets_balance_non_negative", sql`${table.balanceInPaise} >= 0`),
  ],
);

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    walletId: integer("wallet_id").references(() => wallets.id),
    walletType: walletTypeEnum("wallet_type").notNull().default("cashback"),
    type: walletTransactionTypeEnum("type").notNull(),
    amountInPaise: integer("amount_in_paise").notNull(),
    sequenceNumber: integer("sequence_number").notNull().default(0),
    balanceAfterInPaise: integer("balance_after_in_paise").notNull().default(0),
    note: text("note"),
    internalNote: text("internal_note"),
    userNote: text("user_note"),
    adminUserId: integer("admin_user_id").references(() => users.id),
    sourceClickId: uuid("source_click_id").references(() => clicks.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("wallet_transactions_user_id_idx").on(table.userId),
    index("wallet_transactions_user_id_wallet_type_idx").on(
      table.userId,
      table.walletType,
    ),
    index("wallet_transactions_user_id_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("wallet_transactions_admin_user_id_idx").on(table.adminUserId),
    uniqueIndex("wallet_transactions_source_click_id_unique")
      .on(table.sourceClickId)
      .where(sql`${table.sourceClickId} is not null`),
    index("wallet_transactions_wallet_id_idx").on(table.walletId),
    uniqueIndex("wallet_transactions_wallet_id_sequence_idx").on(
      table.walletId,
      table.sequenceNumber,
    ),
    index("wallet_transactions_source_click_id_idx").on(table.sourceClickId),
    index("wallet_transactions_created_at_idx").on(table.createdAt),
    check(
      "wallet_transactions_amount_positive",
      sql`${table.amountInPaise} > 0`,
    ),
  ],
);

export const withdrawalRequests = pgTable(
  "withdrawal_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    upiId: varchar("upi_id", { length: 255 }).notNull(),
    amountInPaise: integer("amount_in_paise").notNull(),
    status: withdrawalStatusEnum("status").notNull().default("pending"),
    adminNote: text("admin_note"),
    processedByAdminId: integer("processed_by_admin_id").references(
      () => users.id,
    ),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("withdrawal_requests_user_id_idx").on(table.userId),
    uniqueIndex("withdrawal_requests_user_pending_unique")
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
    index("withdrawal_requests_user_status_created_at_idx").on(
      table.userId,
      table.status,
      table.createdAt,
    ),
    index("withdrawal_requests_status_idx").on(table.status),
    index("withdrawal_requests_created_at_idx").on(table.createdAt),
    check(
      "withdrawal_requests_amount_positive",
      sql`${table.amountInPaise} > 0`,
    ),
  ],
);

export const amazonGiftCardRequests = pgTable(
  "amazon_gift_card_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    amountInPaise: integer("amount_in_paise").notNull(),
    status: giftCardRequestStatusEnum("status").notNull().default("pending"),
    giftCardCode: text("gift_card_code"),
    giftCardCodeEncrypted: text("gift_card_code_encrypted"),
    adminNote: text("admin_note"),
    processedByAdminId: integer("processed_by_admin_id").references(
      () => users.id,
    ),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("amazon_gift_card_requests_user_id_idx").on(table.userId),
    uniqueIndex("amazon_gift_card_requests_user_pending_unique")
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
    uniqueIndex("gift_card_code_encrypted_unique")
      .on(table.giftCardCodeEncrypted)
      .where(sql`${table.giftCardCodeEncrypted} is not null`),
    index("amazon_gift_card_requests_user_status_created_at_idx").on(
      table.userId,
      table.status,
      table.createdAt,
    ),
    index("amazon_gift_card_requests_status_idx").on(table.status),
    index("amazon_gift_card_requests_created_at_idx").on(table.createdAt),
    check(
      "amazon_gift_card_requests_amount_positive",
      sql`${table.amountInPaise} > 0`,
    ),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at"),
    adminUserId: integer("admin_user_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_user_unread_idx").on(table.userId, table.isRead),
    index("notifications_user_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("notifications_is_read_idx").on(table.isRead),
    index("notifications_created_at_idx").on(table.createdAt),
  ],
);

export const affiliateLinkCounter = pgTable("affiliate_link_counter", {
  id: serial("id").primaryKey(),
  linkCount: integer("link_count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const affiliateLinks = pgTable(
  "affiliate_links",
  {
    id: serial("id").primaryKey(),
    merchantId: integer("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    linkNumber: integer("link_number").notNull(),
    url: text("url").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("affiliate_links_merchant_id_idx").on(table.merchantId),
    index("affiliate_links_merchant_link_number_idx").on(
      table.merchantId,
      table.linkNumber,
    ),
    uniqueIndex("affiliate_links_merchant_link_number_unique").on(
      table.merchantId,
      table.linkNumber,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: integer("actor_id").references(() => users.id),
    actionType: text("action_type").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"), // Store arbitrary JSON data
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_actor_id_idx").on(table.actorId),
    index("audit_logs_action_type_idx").on(table.actionType),
    index("audit_logs_entity_type_idx").on(table.entityType),
    index("audit_logs_entity_id_idx").on(table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export const reconciliationResults = pgTable(
  "reconciliation_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: integer("wallet_id").references(() => wallets.id),
    userId: integer("user_id").references(() => users.id),
    walletType: walletTypeEnum("wallet_type"),
    cachedBalance: integer("cached_balance"),
    ledgerBalance: integer("ledger_balance"),
    difference: integer("difference"),
    status: text("status").notNull(), // e.g., 'MISMATCH', 'RECONCILIATION_COMPLETE', 'RECONCILIATION_FAILED'
    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    metadata: jsonb("metadata"), // Store arbitrary JSON data
  },
  (table) => [
    index("reconciliation_results_wallet_id_idx").on(table.walletId),
    index("reconciliation_results_user_id_idx").on(table.userId),
    index("reconciliation_results_status_idx").on(table.status),
    index("reconciliation_results_detected_at_idx").on(table.detectedAt),
  ],
);
