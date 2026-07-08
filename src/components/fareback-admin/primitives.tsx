"use client";

import { ComponentType, ReactNode } from "react";
import {
  Users,
  ShieldCheck,
  Link2,
  History,
  Globe2,
  Bell,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AdminRole, type Kpi, formatNumber, formatRelative } from "./data";

// ---------- KPI card --------------------------------------------------------

const ICONS: Record<Kpi["icon"], LucideIcon> = {
  users: Users,
  shield: ShieldCheck,
  link: Link2,
  history: History,
  globe: Globe2,
  bell: Bell,
  session: Activity,
};

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = ICONS[kpi.icon];
  const positive = kpi.deltaPct > 0;
  const neutral = kpi.deltaPct === 0;
  const TrendIcon = neutral ? Minus : positive ? TrendingUp : TrendingDown;

  return (
    <Card className="border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <Icon className="h-5 w-5" />
        </div>
        <Badge
          variant="outline"
          className={cn(
            "gap-1 border-transparent px-1.5 py-0 text-[11px] font-medium",
            neutral && "bg-slate-50 text-slate-500",
            positive && "bg-emerald-50 text-emerald-700",
            !neutral && !positive && "bg-rose-50 text-rose-700",
          )}
        >
          <TrendIcon className="h-3 w-3" />
          {neutral ? "0%" : `${positive ? "+" : ""}${kpi.deltaPct}%`}
        </Badge>
      </div>
      <p className="mt-4 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {formatNumber(kpi.value)}
      </p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{kpi.label}</p>
      <Sparkline data={kpi.spark} positive={positive || neutral} />
    </Card>
  );
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const w = 100;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke = positive ? "#10b981" : "#f43f5e";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="mt-3 h-7 w-full"
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---------- Section card ----------------------------------------------------

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-slate-200 bg-white shadow-sm", className)}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

// ---------- Page header -----------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Empty state -----------------------------------------------------

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------- Activity feed item ---------------------------------------------

const ACTIVITY_ICON_BG: Record<string, string> = {
  role: "bg-violet-50 text-violet-600",
  link: "bg-emerald-50 text-emerald-600",
  cache: "bg-sky-50 text-sky-600",
  csv: "bg-amber-50 text-amber-600",
  bell: "bg-rose-50 text-rose-600",
  settings: "bg-slate-100 text-slate-600",
};

const ACTIVITY_ICON: Record<string, ComponentType<{ className?: string }>> = {
  role: ShieldCheck,
  link: Link2,
  cache: Activity,
  csv: History,
  bell: Bell,
  settings: Globe2,
};

export function ActivityRow({
  item,
}: {
  item: { id: string; actorName: string; verb: string; target: string; createdAt: string; icon: string };
}) {
  const Icon = ACTIVITY_ICON[item.icon] ?? Globe2;
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70">
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          ACTIVITY_ICON_BG[item.icon] ?? "bg-slate-100 text-slate-600",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 text-slate-700">
          <span className="font-semibold text-slate-900">{item.actorName}</span>{" "}
          {item.verb}{" "}
          <span className="font-medium text-slate-900">{item.target}</span>
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{formatRelative(item.createdAt)}</p>
      </div>
    </div>
  );
}
