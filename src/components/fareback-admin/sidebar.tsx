"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  ShieldCheck,
  Megaphone,
  Link2,
  DatabaseZap,
  History,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export type AdminTab =
  | "overview"
  | "access"
  | "communications"
  | "links"
  | "data"
  | "audit";

interface NavItem {
  id: AdminTab;
  label: string;
  icon: typeof LayoutDashboard;
  description: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "Monitor",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard, description: "Platform health & activity" },
      { id: "audit", label: "Audit log", icon: History, description: "Every privileged action" },
    ],
  },
  {
    label: "Governance",
    items: [
      { id: "access", label: "Access control", icon: ShieldCheck, description: "Roles & elevated access" },
      { id: "communications", label: "Communications", icon: Megaphone, description: "Broadcasts & alerts" },
    ],
  },
  {
    label: "Platform tools",
    items: [
      { id: "links", label: "Affiliate links", icon: Link2, description: "Amazon URL rotation" },
      { id: "data", label: "Data & cache", icon: DatabaseZap, description: "CSV import & Redis" },
    ],
  },
];

export function AdminSidebar({
  active,
  onChange,
  collapsed,
}: {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
  collapsed: boolean;
}) {
  const { toast } = useToast();
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 hidden h-screen border-r border-slate-800 bg-slate-900 pt-0 transition-[width] duration-200 lg:block",
        collapsed ? "w-[68px]" : "w-[260px]",
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm shadow-violet-500/30">
          <Wallet className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight text-white">
              Fareback
            </p>
            <p className="truncate text-[11px] text-slate-400">Admin Console</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex h-[calc(100vh-4rem-4.5rem)] flex-col gap-5 overflow-y-auto px-3 py-5">
        {NAV.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                    isActive
                      ? "bg-violet-600/15 text-violet-300"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-violet-400" />
                  )}
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isActive ? "text-violet-400" : "text-slate-500 group-hover:text-slate-300",
                    )}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate text-sm font-medium">{item.label}</span>
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 text-slate-600 transition-transform",
                          isActive && "text-violet-400",
                        )}
                      />
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer: shortcut to finance panel */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 p-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start border border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200",
            collapsed && "justify-center px-0",
          )}
        >
          <Link href="/finance">
            <Wallet className="h-4 w-4" />
            {!collapsed && <span className="ml-2 text-xs">Finance panel</span>}
          </Link>
        </Button>
      </div>
    </aside>
  );
}
