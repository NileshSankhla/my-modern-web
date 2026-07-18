import { requireAdminUser } from "@/lib/admin";
import { AdminPanel } from "@/components/fareback-admin/admin-panel";
import { db } from "@/lib/db";
import { users, affiliateLinks as affiliateLinksTable, auditLogs, merchants, sessions, notifications, clicks } from "@/lib/db/schema";
import { sql, desc, eq, and, count, gt, gte } from "drizzle-orm";

import { AdminRole, Kpi, AdminUser, AffiliateLink, AllPlatformUser, NotificationRecord, AuditEntry, ActivityItem } from "@/components/fareback-admin/data";

export default async function AdminDashboardPage() {
  const currentUser = await requireAdminUser();

  // 1. Fetch KPIs
  const totalUsers = await db.select({ count: count() }).from(users);
  const adminCount = await db.select({ count: count() }).from(users).where(eq(users.isAdmin, true));
  const activeLinks = await db.select({ count: count() }).from(affiliateLinksTable).where(eq(affiliateLinksTable.isActive, true));
  const activeMerchants = await db.select({ count: count() }).from(merchants);
  const recentNotifications = await db.select({ count: count() }).from(notifications).where(gte(notifications.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const activeSessions = await db.select({ count: count() }).from(sessions).where(gt(sessions.expiresAt, new Date()));
  const recentAudits = await db.select({ count: count() }).from(auditLogs).where(gte(auditLogs.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));

  const kpis: Kpi[] = [
    { id: "users", label: "Registered users", value: totalUsers[0]?.count || 0, deltaPct: 0, spark: [0, 0, 0, 0, 0, 0, 0], icon: "users" },
    { id: "admins", label: "Admin accounts", value: adminCount[0]?.count || 0, deltaPct: 0, spark: [0, 0, 0, 0, 0, 0, 0], icon: "shield" },
    { id: "links", label: "Active affiliate links", value: activeLinks[0]?.count || 0, deltaPct: 0, spark: [0, 0, 0, 0, 0, 0, 0], icon: "link" },
    { id: "merchants", label: "Merchants tracked", value: activeMerchants[0]?.count || 0, deltaPct: 0, spark: [0, 0, 0, 0, 0, 0, 0], icon: "globe" },
    { id: "notifications", label: "Notifications sent", value: recentNotifications[0]?.count || 0, deltaPct: 0, spark: [0, 0, 0, 0, 0, 0, 0], icon: "bell" },
    { id: "sessions", label: "Active sessions", value: activeSessions[0]?.count || 0, deltaPct: 0, spark: [0, 0, 0, 0, 0, 0, 0], icon: "session" },
    { id: "audit", label: "Audit events (30d)", value: recentAudits[0]?.count || 0, deltaPct: 0, spark: [0, 0, 0, 0, 0, 0, 0], icon: "history" },
  ];

  // 2. Fetch Admin Users (elevated roles only — shown in the right-panel list)
  const adminsFromDb = await db.select().from(users).where(sql`${users.isAdmin} = true OR ${users.isFinanceManager} = true`).orderBy(users.name);
  const adminUsers: AdminUser[] = adminsFromDb.map(u => ({
    id: `U-${u.id}`,
    numericId: u.id,
    name: u.name || u.email.split("@")[0],
    email: u.email,
    role: (u.isAdmin ? "admin" : "finance_manager") as AdminRole,
    isAdmin: u.isAdmin ?? false,
    isFinanceManager: u.isFinanceManager ?? false,
    lastActive: u.updatedAt.toISOString(),
    joinedAt: u.createdAt.toISOString(),
    avatarColor: "#0ea5e9",
  }));

  // 2b. Fetch ALL platform users for the searchable user picker in access control
  const allUsersFromDb = await db
    .select({ id: users.id, name: users.name, email: users.email, isAdmin: users.isAdmin, isFinanceManager: users.isFinanceManager, createdAt: users.createdAt })
    .from(users)
    .orderBy(users.email)
    .limit(500);
  const allPlatformUsers: AllPlatformUser[] = allUsersFromDb.map(u => ({
    numericId: u.id,
    name: u.name || u.email.split("@")[0],
    email: u.email,
    isAdmin: u.isAdmin ?? false,
    isFinanceManager: u.isFinanceManager ?? false,
    createdAt: u.createdAt.toISOString(),
  }));

  // 3. Fetch Affiliate Links with REAL per-link click counts
  const [linksFromDb, amazonMerchant] = await Promise.all([
    db.select().from(affiliateLinksTable).orderBy(affiliateLinksTable.linkNumber),
    db.select({ id: merchants.id }).from(merchants).where(sql`lower(${merchants.name}) = 'amazon'`).limit(1).then(rows => rows[0] ?? null),
  ]);

  // Get click counts grouped by affiliateLinkIndex (index = linkNumber - 1)
  const clickCountsByIndex: Record<number, number> = {};
  if (amazonMerchant) {
    const clickGroups = await db
      .select({ affiliateLinkIndex: clicks.affiliateLinkIndex, cnt: count() })
      .from(clicks)
      .where(and(eq(clicks.merchantId, amazonMerchant.id), sql`${clicks.affiliateLinkIndex} is not null`))
      .groupBy(clicks.affiliateLinkIndex);
    for (const row of clickGroups) {
      if (row.affiliateLinkIndex !== null) {
        clickCountsByIndex[row.affiliateLinkIndex] = Number(row.cnt);
      }
    }
  }

  const affiliateLinks: AffiliateLink[] = linksFromDb.map(l => ({
    id: l.id,
    linkNumber: l.linkNumber,
    url: l.url,
    tag: l.url.includes("tag=") ? l.url.split("tag=")[1].split("&")[0] : "unknown",
    isActive: l.isActive,
    clicks: clickCountsByIndex[l.linkNumber - 1] ?? 0, // index = linkNumber - 1
    addedAt: l.createdAt.toISOString(),
  }));

  // 4. Fetch Notifications Log (We only have notifications table which is per user, so we'll mock or leave empty if no broadcast table)
  const notificationLog: NotificationRecord[] = [];

  // 5. Fetch Audit Log
  const auditsFromDb = await db.select({
    id: auditLogs.id,
    actionType: auditLogs.actionType,
    createdAt: auditLogs.createdAt,
    actorName: users.name,
    actorEmail: users.email,
    ipAddress: auditLogs.ipAddress,
  }).from(auditLogs).leftJoin(users, eq(auditLogs.actorId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(50);
  
  const auditLog: AuditEntry[] = auditsFromDb.map(a => ({
    id: a.id,
    action: "settings_updated", // fallback
    actorName: a.actorName || "System",
    actorEmail: a.actorEmail || "system@fareback.io",
    target: a.actionType,
    createdAt: a.createdAt.toISOString(),
    ip: a.ipAddress || "Unknown",
  }));

  const activityFeed: ActivityItem[] = auditsFromDb.slice(0, 10).map(a => ({
    id: a.id,
    actorName: a.actorName || "System",
    actorEmail: a.actorEmail || "system@fareback.io",
    verb: "performed",
    target: a.actionType,
    createdAt: a.createdAt.toISOString(),
    icon: "settings",
  }));

  const currentAdminData = {
    name: currentUser.name || "Admin",
    email: currentUser.email,
    role: "Super Admin" as const,
    avatarColor: "#7c3aed",
  };

  return (
    <AdminPanel 
      kpis={kpis}
      adminUsers={adminUsers}
      allPlatformUsers={allPlatformUsers}
      affiliateLinks={affiliateLinks}
      notificationLog={notificationLog}
      auditLog={auditLog}
      activityFeed={activityFeed}
      currentAdmin={currentAdminData}
    />
  );
}
