"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Megaphone,
  Link2,
  DatabaseZap,
  ArrowRight,
  Plus,
  Upload,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard, SectionCard, PageHeader, ActivityRow } from "./primitives";
import { type Kpi, type ActivityItem, type AdminRole, type AdminUser } from "./data";
import type { AdminTab } from "./sidebar";

export function OverviewTab({ 
  onNavigate, 
  kpis, 
  activityFeed,
  adminUsers = [],
}: { 
  onNavigate: (tab: AdminTab) => void;
  kpis: Kpi[];
  activityFeed: ActivityItem[];
  adminUsers?: AdminUser[];
}) {
  const totalUsersKpi = kpis.find((k) => k.id === "users")?.value || 0;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Platform health, recent activity, and quick actions across Fareback."
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
        {kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Activity feed */}
        <SectionCard
          title="Recent activity"
          description="Latest privileged actions across the platform"
          actions={
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-slate-600 hover:bg-slate-100 hover:text-violet-700"
              onClick={() => onNavigate("audit")}
            >
              View full audit log <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          }
        >
          <div className="-mx-5 -mb-5 divide-y divide-slate-100">
            {activityFeed.slice(0, 7).map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        </SectionCard>

        {/* Quick actions + access summary */}
        <div className="space-y-6">
          <SectionCard
            title="Quick actions"
            description="Jump straight into the most common admin tasks"
          >
            <div className="grid grid-cols-2 gap-2.5">
              <QuickAction
                icon={ShieldCheck}
                label="Manage access"
                description="Grant or revoke roles"
                onClick={() => onNavigate("access")}
                tone="violet"
              />
              <QuickAction
                icon={Megaphone}
                label="Broadcast"
                description="Send a notification"
                onClick={() => onNavigate("communications")}
                tone="rose"
              />
              <QuickAction
                icon={Link2}
                label="Add affiliate link"
                description="Rotate Amazon URLs"
                onClick={() => onNavigate("links")}
                tone="emerald"
              />
              <QuickAction
                icon={Upload}
                label="Import CSV"
                description="Bulk review data"
                onClick={() => onNavigate("data")}
                tone="amber"
              />
            </div>
          </SectionCard>

          <AccessSummary onNavigate={onNavigate} adminUsers={adminUsers} totalUsers={totalUsersKpi} />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  description: string;
  onClick: () => void;
  tone: "violet" | "rose" | "emerald" | "amber";
}) {
  const tones: Record<typeof tone, string> = {
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-md ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{description}</p>
      </div>
    </button>
  );
}

function AccessSummary({
  onNavigate,
  adminUsers = [],
  totalUsers = 0,
}: {
  onNavigate: (tab: AdminTab) => void;
  adminUsers?: AdminUser[];
  totalUsers?: number;
}) {
  const adminCount = adminUsers.filter((u) => u.role === "admin").length;
  const financeCount = adminUsers.filter((u) => u.role === "finance_manager").length;
  const standardCount = Math.max(0, totalUsers - adminCount - financeCount);
  const total = Math.max(1, totalUsers);

  return (
    <SectionCard
      title="Access summary"
      description="Current elevated-access distribution"
      actions={
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-slate-600 hover:bg-slate-100 hover:text-violet-700"
          onClick={() => onNavigate("access")}
        >
          Manage <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      }
    >
      <div className="space-y-3">
        <RoleBar label="Administrators" count={adminCount} total={total} color="bg-violet-500" />
        <RoleBar label="Finance managers" count={financeCount} total={total} color="bg-emerald-500" />
        <RoleBar label="Standard users" count={standardCount} total={total} color="bg-slate-300" />
      </div>
    </SectionCard>
  );
}

function RoleBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = (count / total) * 100;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">{count}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
