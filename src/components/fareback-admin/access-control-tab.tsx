"use client";

import { useMemo, useState } from "react";
import {
  Search,
  ShieldCheck,
  Plus,
  Crown,
  Wallet,
  User as UserIcon,
  MoreHorizontal,
  Trash2,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SectionCard, PageHeader, EmptyState } from "./primitives";
import { type AdminUser, type AdminRole, formatRelative, roleLabel } from "./data";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ROLE_ICON: Record<AdminRole, typeof Crown> = {
  admin: Crown,
  finance_manager: Wallet,
  user: UserIcon,
};

const ROLE_BADGE: Record<AdminRole, string> = {
  admin: "border-violet-200 bg-violet-50 text-violet-700",
  finance_manager: "border-emerald-200 bg-emerald-50 text-emerald-700",
  user: "border-slate-200 bg-slate-50 text-slate-600",
};

export function AccessControlTab({ adminUsers }: { adminUsers: AdminUser[] }) {
  const { toast } = useToast();
  const [users, setUsers] = useState(adminUsers);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminRole | "all">("all");

  // Role assignment form
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFinance, setIsFinance] = useState(false);
  const [saving, setSaving] = useState(false);

  // Confirm dialog for revoke
  const [revokeTarget, setRevokeTarget] = useState<(typeof users)[number] | null>(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [users, query, roleFilter]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }
    setSaving(true);
    // Simulate server action
    await new Promise((r) => setTimeout(r, 700));
    setSaving(false);
    toast({
      title: "Access updated",
      description: `${email} → ${isAdmin ? "Admin" : "—"} · ${isFinance ? "Finance Manager" : "—"}`,
    });
    setEmail("");
    setIsAdmin(false);
    setIsFinance(false);
  };

  const confirmRevoke = () => {
    if (!revokeTarget) return;
    setUsers((prev) =>
      prev.map((u) => (u.id === revokeTarget.id ? { ...u, role: "user" } : u)),
    );
    toast({
      title: "Elevated access revoked",
      description: `${revokeTarget.name} is now a standard user.`,
    });
    setRevokeTarget(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access control"
        description="Grant or revoke administrator and finance manager access. All changes are written to the audit log."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Role assignment form */}
        <SectionCard
          title="Assign elevated access"
          description="Promote a user to admin or finance manager by email"
          actions={
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              Sensitive
            </Badge>
          }
        >
          <form onSubmit={handleAssign} className="space-y-4">
            <div>
              <label htmlFor="ac-email" className="mb-1.5 block text-xs font-medium text-slate-700">
                User email
              </label>
              <Input
                id="ac-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="border-slate-200 focus-visible:ring-violet-500/40"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                The user must already have a Fareback account.
              </p>
            </div>

            <div className="space-y-2">
              <RoleCheckbox
                checked={isAdmin}
                onChange={setIsAdmin}
                icon={Crown}
                title="Administrator"
                description="Full platform control, settings, and audit access"
                tone="violet"
              />
              <RoleCheckbox
                checked={isFinance}
                onChange={setIsFinance}
                icon={Wallet}
                title="Finance Manager"
                description="Access to the Finance panel for payouts and wallet adjustments"
                tone="emerald"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-slate-200"
                onClick={() => {
                  setEmail("");
                  setIsAdmin(false);
                  setIsFinance(false);
                }}
              >
                Reset
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                {saving ? "Updating…" : "Update access"}
              </Button>
            </div>
          </form>
        </SectionCard>

        {/* Admin list */}
        <SectionCard
          title="Users with elevated access"
          description="Filter by role or search to find a specific user"
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email, id"
                  className="h-8 w-48 border-slate-200 pl-8 text-xs focus-visible:ring-violet-500/40"
                />
              </div>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AdminRole | "all")}>
                <SelectTrigger className="h-8 w-32 border-slate-200 text-xs focus:ring-violet-500/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                  <SelectItem value="finance_manager">Finance</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No users match your filters"
              description="Try clearing the search box or changing the role filter."
            />
          ) : (
            <div className="-mx-5 -mb-5 divide-y divide-slate-100">
              {filtered.map((u) => {
                const Icon = ROLE_ICON[u.role];
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/70"
                  >
                    <Avatar className="h-9 w-9 border border-slate-200">
                      <AvatarFallback
                        className="text-[11px] font-semibold text-white"
                        style={{ backgroundColor: u.avatarColor }}
                      >
                        {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{u.name}</p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-[11px] text-slate-400">Last active</p>
                      <p className="text-xs text-slate-600">{formatRelative(u.lastActive)}</p>
                    </div>
                    <Badge variant="outline" className={cn("gap-1", ROLE_BADGE[u.role])}>
                      <Icon className="h-3 w-3" />
                      {roleLabel(u.role)}
                    </Badge>
                    {u.role !== "user" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 border-slate-200">
                          <DropdownMenuItem className="text-xs text-slate-700">
                            <KeyRound className="mr-2 h-3.5 w-3.5 text-slate-400" /> Reset password
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-xs text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                            onClick={() => setRevokeTarget(u)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Revoke access
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <ConfirmDialog
        config={{
          open: !!revokeTarget,
          title: "Revoke elevated access?",
          description: (
            <span>
              <strong>{revokeTarget?.name}</strong> will lose their{" "}
              <strong>{roleLabel(revokeTarget?.role ?? "user")}</strong> role and become a standard
              user. They will lose access to this admin console.
            </span>
          ),
          confirmLabel: "Revoke access",
          tone: "danger",
          onConfirm: confirmRevoke,
          onCancel: () => setRevokeTarget(null),
        }}
      />
    </div>
  );
}

function RoleCheckbox({
  checked,
  onChange,
  icon: Icon,
  title,
  description,
  tone,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: typeof Crown;
  title: string;
  description: string;
  tone: "violet" | "emerald";
}) {
  const toneClasses = {
    violet: { border: "border-violet-300", bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-500" },
    emerald: { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-500" },
  }[tone];
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        checked ? `${toneClasses.border} ${toneClasses.bg}` : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
        className={cn("mt-0.5", checked && cn(toneClasses.border, toneClasses.text))}
      />
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5", toneClasses.text)} />
          <span className="text-sm font-semibold text-slate-900">{title}</span>
        </div>
        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{description}</p>
      </div>
    </label>
  );
}
