"use client";

import { useState } from "react";
import { AdminSidebar, type AdminTab } from "./sidebar";
import { AdminTopbar } from "./topbar";
import { OverviewTab } from "./overview-tab";
import { AccessControlTab } from "./access-control-tab";
import { CommunicationsTab } from "./communications-tab";
import { AffiliateLinksTab } from "./affiliate-links-tab";
import { DataToolsTab } from "./data-tools-tab";
import { AuditLogTab } from "./audit-log-tab";
import { Kpi, AdminUser, AffiliateLink, NotificationRecord, AuditEntry, ActivityItem } from "./data";

export interface AdminPanelProps {
  kpis: Kpi[];
  adminUsers: AdminUser[];
  affiliateLinks: AffiliateLink[];
  notificationLog: NotificationRecord[];
  auditLog: AuditEntry[];
  activityFeed: ActivityItem[];
  currentAdmin: { name: string; email: string; role: string; avatarColor: string; };
}

export function AdminPanel({
  kpis, adminUsers, affiliateLinks, notificationLog, auditLog, activityFeed, currentAdmin
}: AdminPanelProps) {
  const [active, setActive] = useState<AdminTab>("overview");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminSidebar active={active} onChange={setActive} collapsed={collapsed} />

      <div className={collapsed ? "lg:pl-[68px]" : "lg:pl-[260px]"}>
        <AdminTopbar active={active} onToggleSidebar={() => setCollapsed((v) => !v)} currentAdmin={currentAdmin} />

        <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
          {active === "overview" && <OverviewTab onNavigate={setActive} kpis={kpis} activityFeed={activityFeed} adminUsers={adminUsers} />}
          {active === "access" && <AccessControlTab adminUsers={adminUsers} />}
          {active === "communications" && <CommunicationsTab notificationLog={notificationLog} />}
          {active === "links" && <AffiliateLinksTab affiliateLinks={affiliateLinks} />}
          {active === "data" && <DataToolsTab />}
          {active === "audit" && <AuditLogTab auditLog={auditLog} />}
        </main>
      </div>
    </div>
  );
}
