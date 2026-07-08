// ============================================================================
// Fareback Admin Console — Dummy data + TypeScript types
// ----------------------------------------------------------------------------
// Replace these mock datasets with real Drizzle queries / server actions when
// wiring the panel into your Fareback backend. Shapes are intentionally close
// to what your `lib/db/schema.ts` already exposes (users, auditLogs,
// affiliateLinks, merchants, notifications, sessions).
// ============================================================================

export type AdminRole = "admin" | "finance_manager" | "user";

// ---------- KPIs ------------------------------------------------------------

export interface Kpi {
  id: string;
  label: string;
  value: number;
  unit?: string;
  deltaPct: number; // +/- vs previous period
  spark: number[]; // 7-point trend
  icon: "users" | "shield" | "link" | "history" | "globe" | "bell" | "session";
}

export const kpis: Kpi[] = [
  {
    id: "users",
    label: "Registered users",
    value: 18420,
    deltaPct: 4.2,
    spark: [120, 135, 128, 142, 150, 168, 182],
    icon: "users",
  },
  {
    id: "admins",
    label: "Admin accounts",
    value: 7,
    deltaPct: 0,
    spark: [6, 6, 6, 7, 7, 7, 7],
    icon: "shield",
  },
  {
    id: "links",
    label: "Active affiliate links",
    value: 14,
    deltaPct: 16.7,
    spark: [8, 9, 10, 11, 12, 13, 14],
    icon: "link",
  },
  {
    id: "merchants",
    label: "Merchants tracked",
    value: 23,
    deltaPct: 9.5,
    spark: [18, 19, 20, 20, 21, 22, 23],
    icon: "globe",
  },
  {
    id: "notifications",
    label: "Notifications sent",
    value: 312,
    deltaPct: -3.1,
    spark: [52, 48, 45, 50, 42, 38, 37],
    icon: "bell",
  },
  {
    id: "sessions",
    label: "Active sessions",
    value: 1248,
    deltaPct: 2.8,
    spark: [1100, 1150, 1180, 1200, 1220, 1230, 1248],
    icon: "session",
  },
  {
    id: "audit",
    label: "Audit events (30d)",
    value: 942,
    deltaPct: 12.4,
    spark: [22, 28, 25, 32, 30, 35, 38],
    icon: "history",
  },
];

// ---------- Users / access control -----------------------------------------

/** All platform users — used for the searchable user picker in access control */
export interface AllPlatformUser {
  numericId: number;
  name: string;
  email: string;
  isAdmin: boolean;
  isFinanceManager: boolean;
  createdAt: string; // ISO
}

export interface AdminUser {
  /** String ID used in UI keys (e.g. "U-42") */
  id: string;
  /** Numeric DB id — used to target server actions */
  numericId: number;
  name: string;
  email: string;
  role: AdminRole;
  isAdmin: boolean;
  isFinanceManager: boolean;
  lastActive: string; // ISO
  joinedAt: string; // ISO
  avatarColor: string;
}

export const adminUsers: AdminUser[] = [
  { id: "U-1042", name: "Aarav Mehta", email: "aarav@fareback.io", role: "admin", lastActive: "2026-07-04T08:24:00Z", joinedAt: "2025-11-12T10:00:00Z", avatarColor: "#7c3aed" },
  { id: "U-1078", name: "Priya Nair", email: "priya@fareback.io", role: "finance_manager", lastActive: "2026-07-04T07:55:00Z", joinedAt: "2025-12-03T10:00:00Z", avatarColor: "#d97706" },
  { id: "U-1103", name: "Rohan Kapoor", email: "rohan@fareback.io", role: "admin", lastActive: "2026-07-03T22:18:00Z", joinedAt: "2026-01-08T10:00:00Z", avatarColor: "#0ea5e9" },
  { id: "U-1156", name: "Isha Verma", email: "isha@fareback.io", role: "user", lastActive: "2026-07-04T09:12:00Z", joinedAt: "2026-02-14T10:00:00Z", avatarColor: "#8b5cf6" },
  { id: "U-1190", name: "Karthik Rao", email: "karthik@fareback.io", role: "finance_manager", lastActive: "2026-07-04T06:40:00Z", joinedAt: "2026-03-22T10:00:00Z", avatarColor: "#ef4444" },
  { id: "U-1224", name: "Sneha Iyer", email: "sneha@fareback.io", role: "user", lastActive: "2026-07-02T19:30:00Z", joinedAt: "2026-04-09T10:00:00Z", avatarColor: "#14b8a6" },
  { id: "U-1258", name: "Dev Patel", email: "dev@fareback.io", role: "user", lastActive: "2026-07-04T05:15:00Z", joinedAt: "2026-05-17T10:00:00Z", avatarColor: "#f59e0b" },
];

// ---------- Affiliate links -------------------------------------------------

export interface AffiliateLink {
  id: number;
  linkNumber: number;
  url: string;
  tag: string;
  isActive: boolean;
  clicks: number;
  addedAt: string;
}

export const affiliateLinks: AffiliateLink[] = [
  { id: 1, linkNumber: 1, url: "https://www.amazon.in/?tag=fareback-21", tag: "fareback-21", isActive: true, clicks: 18420, addedAt: "2026-01-12" },
  { id: 2, linkNumber: 2, url: "https://www.amazon.in/s?tag=fareback-22", tag: "fareback-22", isActive: true, clicks: 9210, addedAt: "2026-02-08" },
  { id: 3, linkNumber: 3, url: "https://www.amazon.in/gp/goldbox?tag=fareback-23", tag: "fareback-23", isActive: true, clicks: 5340, addedAt: "2026-03-15" },
  { id: 4, linkNumber: 4, url: "https://www.amazon.in/deals?tag=fareback-24", tag: "fareback-24", isActive: false, clicks: 2180, addedAt: "2026-04-22" },
  { id: 5, linkNumber: 5, url: "https://www.amazon.in/b?tag=fareback-25", tag: "fareback-25", isActive: true, clicks: 1240, addedAt: "2026-05-30" },
  { id: 6, linkNumber: 6, url: "https://www.amazon.in/gp/browse?tag=fareback-26", tag: "fareback-26", isActive: false, clicks: 410, addedAt: "2026-06-18" },
];

// ---------- Notifications ---------------------------------------------------

export interface NotificationRecord {
  id: string;
  recipientType: "all" | "single";
  recipient?: string;
  message: string;
  sentBy: string;
  sentAt: string;
}

export const notificationLog: NotificationRecord[] = [
  { id: "N-5012", recipientType: "all", message: "Cashback rates for Amazon increased to 8% this weekend.", sentBy: "Aarav Mehta", sentAt: "2026-07-03T18:20:00Z" },
  { id: "N-5011", recipientType: "single", recipient: "isha@fareback.io", message: "Your withdrawal of ₹4,200 has been approved.", sentBy: "Priya Nair", sentAt: "2026-07-03T14:08:00Z" },
  { id: "N-5010", recipientType: "all", message: "Scheduled maintenance tonight 2 AM - 2:30 AM IST.", sentBy: "Rohan Kapoor", sentAt: "2026-07-02T20:45:00Z" },
  { id: "N-5009", recipientType: "all", message: "New merchant added: Myntra with 6% cashback.", sentBy: "Aarav Mehta", sentAt: "2026-07-01T11:30:00Z" },
  { id: "N-5008", recipientType: "single", recipient: "karthik@fareback.io", message: "Your bill upload for ₹1,240 was rejected. Please re-upload.", sentBy: "Priya Nair", sentAt: "2026-06-30T16:12:00Z" },
];

// ---------- Audit log -------------------------------------------------------

export type AuditAction =
  | "role_granted"
  | "role_revoked"
  | "link_added"
  | "link_removed"
  | "link_toggled"
  | "cache_flushed"
  | "cache_reloaded"
  | "csv_imported"
  | "notification_sent"
  | "settings_updated";

export interface AuditEntry {
  id: string;
  action: AuditAction;
  actorName: string;
  actorEmail: string;
  target?: string;
  createdAt: string;
  ip: string;
}

export const auditLog: AuditEntry[] = [
  { id: "A-9001", action: "role_granted", actorName: "Aarav Mehta", actorEmail: "aarav@fareback.io", target: "priya@fareback.io → Finance Manager", createdAt: "2026-07-04T08:24:00Z", ip: "103.21.58.12" },
  { id: "A-9000", action: "link_added", actorName: "Rohan Kapoor", actorEmail: "rohan@fareback.io", target: "fareback-26", createdAt: "2026-07-04T07:55:00Z", ip: "103.21.58.44" },
  { id: "A-8999", action: "notification_sent", actorName: "Priya Nair", actorEmail: "priya@fareback.io", target: "All users", createdAt: "2026-07-03T18:20:00Z", ip: "49.205.12.10" },
  { id: "A-8998", action: "cache_reloaded", actorName: "System", actorEmail: "system@fareback.io", createdAt: "2026-07-03T14:08:00Z", ip: "127.0.0.1" },
  { id: "A-8997", action: "csv_imported", actorName: "Priya Nair", actorEmail: "priya@fareback.io", target: "248 rows processed", createdAt: "2026-07-03T11:42:00Z", ip: "49.205.12.10" },
  { id: "A-8996", action: "link_toggled", actorName: "Rohan Kapoor", actorEmail: "rohan@fareback.io", target: "fareback-24 → inactive", createdAt: "2026-07-02T22:18:00Z", ip: "103.21.58.44" },
  { id: "A-8995", action: "role_revoked", actorName: "Aarav Mehta", actorEmail: "aarav@fareback.io", target: "oldadmin@fareback.io → Admin", createdAt: "2026-07-02T15:30:00Z", ip: "103.21.58.12" },
  { id: "A-8994", action: "cache_flushed", actorName: "Rohan Kapoor", actorEmail: "rohan@fareback.io", createdAt: "2026-07-01T09:12:00Z", ip: "103.21.58.44" },
  { id: "A-8993", action: "settings_updated", actorName: "Aarav Mehta", actorEmail: "aarav@fareback.io", target: "Default cashback 5% → 6%", createdAt: "2026-06-30T16:48:00Z", ip: "103.21.58.12" },
  { id: "A-8992", action: "link_removed", actorName: "Rohan Kapoor", actorEmail: "rohan@fareback.io", target: "fareback-19", createdAt: "2026-06-30T11:05:00Z", ip: "103.21.58.44" },
];

// ---------- Activity feed (overview) ---------------------------------------

export interface ActivityItem {
  id: string;
  actorName: string;
  actorEmail: string;
  verb: string;
  target: string;
  createdAt: string;
  icon: "role" | "link" | "cache" | "csv" | "bell" | "settings";
}

export const activityFeed: ActivityItem[] = [
  { id: "AC-1", actorName: "Aarav Mehta", actorEmail: "aarav@fareback.io", verb: "granted Finance Manager role to", target: "Priya Nair", createdAt: "2026-07-04T08:24:00Z", icon: "role" },
  { id: "AC-2", actorName: "Rohan Kapoor", actorEmail: "rohan@fareback.io", verb: "added affiliate link", target: "fareback-26", createdAt: "2026-07-04T07:55:00Z", icon: "link" },
  { id: "AC-3", actorName: "Priya Nair", actorEmail: "priya@fareback.io", verb: "broadcast notification to", target: "All users", createdAt: "2026-07-03T18:20:00Z", icon: "bell" },
  { id: "AC-4", actorName: "System", actorEmail: "system@fareback.io", verb: "reloaded cache from", target: "database", createdAt: "2026-07-03T14:08:00Z", icon: "cache" },
  { id: "AC-5", actorName: "Priya Nair", actorEmail: "priya@fareback.io", verb: "imported", target: "248 CSV rows", createdAt: "2026-07-03T11:42:00Z", icon: "csv" },
  { id: "AC-6", actorName: "Rohan Kapoor", actorEmail: "rohan@fareback.io", verb: "disabled affiliate link", target: "fareback-24", createdAt: "2026-07-02T22:18:00Z", icon: "link" },
  { id: "AC-7", actorName: "Aarav Mehta", actorEmail: "aarav@fareback.io", verb: "revoked admin access for", target: "oldadmin@fareback.io", createdAt: "2026-07-02T15:30:00Z", icon: "role" },
  { id: "AC-8", actorName: "Rohan Kapoor", actorEmail: "rohan@fareback.io", verb: "flushed", target: "entire Redis cache", createdAt: "2026-07-01T09:12:00Z", icon: "cache" },
];

// ---------- Current admin (top bar) ----------------------------------------

export const currentAdmin = {
  name: "Aarav Mehta",
  email: "aarav@fareback.io",
  role: "Super Admin" as const,
  avatarColor: "#7c3aed",
};

// ---------- Formatting helpers ---------------------------------------------

export const formatNumber = (n: number) =>
  new Intl.NumberFormat("en-IN").format(n);

export const formatRelative = (iso: string) => {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const roleLabel = (r: AdminRole) =>
  r === "admin" ? "Administrator" : r === "finance_manager" ? "Finance Manager" : "User";
