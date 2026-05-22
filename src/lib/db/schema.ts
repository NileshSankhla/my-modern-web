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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const walletTransactionTypeEnum = pgEnum("wallet_transaction_type", [
  "credit",
  "debit",
]);

export const walletTypeEnum = pgEnum("wallet_type", ["cashback", "amazon_rewards"]);

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
  (table) => [index("merchants_network_id_idx").on(table.networkId)],
);

export const clicks = pgTable(
  "clicks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    merchantId: integer("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    trackingStatus: clickTrackingStatusEnum("tracking_status")
      .notNull()
      .default("unreviewed"),
    rewardAmountInPaise: integer("reward_amount_in_paise").notNull().default(0),
    reviewedByAdminId: integer("reviewed_by_admin_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    affiliateLinkIndex: integer("affiliate_link_index"),
    affiliateLinkUrl: text("affiliate_link_url"),
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
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
    index("sessions_token_idx").on(table.token),
    index("sessions_token_expires_at_idx").on(table.token, table.expiresAt),
  ],
);

export const wallets = pgTable(
  "wallets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletType: walletTypeEnum("wallet_type").notNull().default("cashback"),
    balanceInPaise: integer("balance_in_paise").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("wallets_user_id_idx").on(table.userId),
    uniqueIndex("wallets_user_id_wallet_type_unique").on(table.userId, table.walletType),
    check("wallets_balance_non_negative", sql`${table.balanceInPaise} >= 0`),
  ],
);

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletType: walletTypeEnum("wallet_type").notNull().default("cashback"),
    type: walletTransactionTypeEnum("type").notNull(),
    amountInPaise: integer("amount_in_paise").notNull(),
    note: text("note"),
    adminUserId: integer("admin_user_id").references(() => users.id),
    sourceClickId: uuid("source_click_id").references(() => clicks.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("wallet_transactions_user_id_idx").on(table.userId),
    index("wallet_transactions_user_id_wallet_type_idx").on(table.userId, table.walletType),
    index("wallet_transactions_user_id_created_at_idx").on(table.userId, table.createdAt),
    index("wallet_transactions_admin_user_id_idx").on(table.adminUserId),
    uniqueIndex("wallet_transactions_source_click_id_unique")
      .on(table.sourceClickId)
      .where(sql`${table.sourceClickId} is not null`),
    index("wallet_transactions_source_click_id_idx").on(table.sourceClickId),
    index("wallet_transactions_created_at_idx").on(table.createdAt),
    check("wallet_transactions_amount_positive", sql`${table.amountInPaise} > 0`),
  ],
);

export const withdrawalRequests = pgTable(
  "withdrawal_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    upiId: varchar("upi_id", { length: 255 }).notNull(),
    amountInPaise: integer("amount_in_paise").notNull(),
    status: withdrawalStatusEnum("status").notNull().default("pending"),
    adminNote: text("admin_note"),
    processedByAdminId: integer("processed_by_admin_id").references(() => users.id),
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
    check("withdrawal_requests_amount_positive", sql`${table.amountInPaise} > 0`),
  ],
);

export const amazonGiftCardRequests = pgTable(
  "amazon_gift_card_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountInPaise: integer("amount_in_paise").notNull(),
    status: giftCardRequestStatusEnum("status").notNull().default("pending"),
    giftCardCode: text("gift_card_code"),
    adminNote: text("admin_note"),
    processedByAdminId: integer("processed_by_admin_id").references(() => users.id),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("amazon_gift_card_requests_user_id_idx").on(table.userId),
    uniqueIndex("amazon_gift_card_requests_user_pending_unique")
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
    index("amazon_gift_card_requests_user_status_created_at_idx").on(
      table.userId,
      table.status,
      table.createdAt,
    ),
    index("amazon_gift_card_requests_status_idx").on(table.status),
    index("amazon_gift_card_requests_created_at_idx").on(table.createdAt),
    check("amazon_gift_card_requests_amount_positive", sql`${table.amountInPaise} > 0`),
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
    index("notifications_user_created_at_idx").on(table.userId, table.createdAt),
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
    index("affiliate_links_merchant_link_number_idx").on(table.merchantId, table.linkNumber),
  ],
);
