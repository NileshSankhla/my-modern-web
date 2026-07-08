"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  Search,
  ShieldCheck,
  Crown,
  Wallet,
  User as UserIcon,
  MoreHorizontal,
  Trash2,
  KeyRound,
  CheckCircle2,
  ChevronDown,
  X,
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
import { ConfirmDialog } from "./confirm-dialog";
import {
  type AdminUser,
  type AdminRole,
  type AllPlatformUser,
  formatRelative,
  roleLabel,
} from "./data";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { setAdminAction, setFinanceManagerAction } from "@/app/actions/admin-config";

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

// Deterministic avatar colour from email string
function avatarColor(email: string): string {
  const palette = [
    "#7c3aed", "#0ea5e9", "#d97706", "#ef4444",
    "#14b8a6", "#8b5cf6", "#f59e0b", "#10b981",
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// ─── User Picker ─────────────────────────────────────────────────────────────
function UserPicker({
  allUsers,
  selected,
  onSelect,
}: {
  allUsers: AllPlatformUser[];
  selected: AllPlatformUser | null;
  onSelect: (u: AllPlatformUser | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return allUsers.slice(0, 30); // show first 30 when no query
    const lower = q.toLowerCase();
    return allUsers.filter(
      (u) => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower),
    ).slice(0, 30);
  }, [allUsers, q]);

  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2.5">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-[10px] font-semibold text-white" style={{ backgroundColor: avatarColor(selected.email) }}>
              {initials(selected.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{selected.name}</p>
            <p className="truncate text-[11px] text-slate-500">{selected.email}</p>
          </div>
          {(selected.isAdmin || selected.isFinanceManager) && (
            <Badge variant="outline" className={ROLE_BADGE[selected.isAdmin ? "admin" : "finance_manager"]}>
              {selected.isAdmin ? "Admin" : "Finance"}
            </Badge>
          )}
          <button onClick={() => onSelect(null)} className="ml-1 text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-500 transition-colors hover:border-violet-300 hover:bg-violet-50/40 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
        >
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <span>Search by name or email…</span>
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
        </button>
      )}

      {open && !selected && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type a name or email…"
              className="h-8 border-slate-200 text-xs focus-visible:ring-violet-500/40"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-center text-xs text-slate-400">No users found.</p>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.numericId}
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50"
                  onClick={() => { onSelect(u); setOpen(false); setQ(""); }}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px] font-semibold text-white" style={{ backgroundColor: avatarColor(u.email) }}>
                      {initials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900">{u.name}</p>
                    <p className="truncate text-[10px] text-slate-500">{u.email}</p>
                  </div>
                  {(u.isAdmin || u.isFinanceManager) && (
                    <Badge variant="outline" className={cn("shrink-0 text-[9px]", ROLE_BADGE[u.isAdmin ? "admin" : "finance_manager"])}>
                      {u.isAdmin ? "Admin" : "Finance"}
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">
            Showing {filtered.length} of {allUsers.length} users
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export function AccessControlTab({
  adminUsers: initialAdminUsers,
  allPlatformUsers,
}: {
  adminUsers: AdminUser[];
  allPlatformUsers: AllPlatformUser[];
}) {
  const { toast } = useToast();
  const [adminUsers, setAdminUsers] = useState(initialAdminUsers);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminRole | "all">("all");
  const [isPending, startTransition] = useTransition();

  // Role assignment form
  const [selectedUser, setSelectedUser] = useState<AllPlatformUser | null>(null);
  const [grantAdmin, setGrantAdmin] = useState(false);
  const [grantFinance, setGrantFinance] = useState(false);

  // Confirm dialog for revoke
  const [revokeTarget, setRevokeTarget] = useState<AdminUser | null>(null);

  // Pre-fill checkboxes when a user is selected
  const handleSelectUser = (u: AllPlatformUser | null) => {
    setSelectedUser(u);
    if (u) {
      setGrantAdmin(u.isAdmin);
      setGrantFinance(u.isFinanceManager);
    } else {
      setGrantAdmin(false);
      setGrantFinance(false);
    }
  };

  const filtered = useMemo(() => {
    return adminUsers.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [adminUsers, query, roleFilter]);

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      toast({ title: "Select a user first", variant: "destructive" });
      return;
    }
    if (!grantAdmin && !grantFinance) {
      toast({ title: "Select at least one role", description: "Choose Admin and/or Finance Manager.", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const results: string[] = [];
      const errors: string[] = [];

      // Run both role changes in parallel
      const [adminRes, financeRes] = await Promise.all([
        setAdminAction(selectedUser.email, grantAdmin),
        setFinanceManagerAction(selectedUser.email, grantFinance),
      ]);

      if (adminRes.error) errors.push(`Admin: ${adminRes.error}`);
      else results.push(grantAdmin ? "Admin ✓" : "Admin revoked");

      if (financeRes.error) errors.push(`Finance: ${financeRes.error}`);
      else results.push(grantFinance ? "Finance Manager ✓" : "Finance Manager revoked");

      if (errors.length > 0) {
        toast({ title: "Partial failure", description: errors.join("; "), variant: "destructive" });
      } else {
        toast({
          title: "Access updated",
          description: `${selectedUser.name} — ${results.join(" · ")}`,
        });

        // Update local state to reflect changes immediately
        const newRole: AdminRole = grantAdmin ? "admin" : grantFinance ? "finance_manager" : "user";
        setAdminUsers((prev) => {
          const existing = prev.find((u) => u.email === selectedUser.email);
          if (existing) {
            if (newRole === "user") {
              // Revoked all elevated access — remove from list
              return prev.filter((u) => u.email !== selectedUser.email);
            }
            return prev.map((u) =>
              u.email === selectedUser.email
                ? { ...u, role: newRole, isAdmin: grantAdmin, isFinanceManager: grantFinance }
                : u,
            );
          } else if (newRole !== "user") {
            // New elevated user — add to list
            return [
              ...prev,
              {
                id: `U-${selectedUser.numericId}`,
                numericId: selectedUser.numericId,
                name: selectedUser.name,
                email: selectedUser.email,
                role: newRole,
                isAdmin: grantAdmin,
                isFinanceManager: grantFinance,
                lastActive: new Date().toISOString(),
                joinedAt: selectedUser.createdAt,
                avatarColor: avatarColor(selectedUser.email),
              },
            ];
          }
          return prev;
        });

        // Reset form
        setSelectedUser(null);
        setGrantAdmin(false);
        setGrantFinance(false);
      }
    });
  };

  const confirmRevoke = useCallback(() => {
    if (!revokeTarget) return;
    startTransition(async () => {
      const [adminRes, financeRes] = await Promise.all([
        setAdminAction(revokeTarget.email, false),
        setFinanceManagerAction(revokeTarget.email, false),
      ]);

      if (adminRes.error || financeRes.error) {
        toast({
          title: "Revoke failed",
          description: adminRes.error ?? financeRes.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Access revoked",
          description: `${revokeTarget.name} is now a standard user.`,
        });
        setAdminUsers((prev) => prev.filter((u) => u.id !== revokeTarget.id));
      }
      setRevokeTarget(null);
    });
  }, [revokeTarget, toast]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access Control"
        description="Grant or revoke administrator and finance manager access. Changes are written to the audit log and take effect immediately."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
              {adminUsers.filter((u) => u.role === "admin").length} admin{adminUsers.filter((u) => u.role === "admin").length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {adminUsers.filter((u) => u.role === "finance_manager").length} finance
            </Badge>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* ── Role assignment form ─── */}
        <SectionCard
          title="Assign elevated access"
          description="Select any platform user and choose their roles"
          actions={
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              Sensitive
            </Badge>
          }
        >
          <form onSubmit={handleAssign} className="space-y-4">
            {/* Searchable user picker */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Select user ({allPlatformUsers.length} total platform users)
              </label>
              <UserPicker
                allUsers={allPlatformUsers}
                selected={selectedUser}
                onSelect={handleSelectUser}
              />
            </div>

            {/* Role checkboxes */}
            <div className="space-y-2">
              <RoleCheckbox
                checked={grantAdmin}
                onChange={setGrantAdmin}
                icon={Crown}
                title="Administrator"
                description="Full platform control — settings, user management, audit access, affiliate link configuration"
                tone="violet"
              />
              <RoleCheckbox
                checked={grantFinance}
                onChange={setGrantFinance}
                icon={Wallet}
                title="Finance Manager"
                description="Access to the Finance panel — approve cashback, manage wallet payouts and manual adjustments"
                tone="emerald"
              />
            </div>

            {/* Info strip */}
            {selectedUser && (grantAdmin !== selectedUser.isAdmin || grantFinance !== selectedUser.isFinanceManager) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                <strong>Change preview:</strong>{" "}
                {selectedUser.name}&apos;s access will be updated from{" "}
                <span className="font-semibold">
                  {selectedUser.isAdmin ? "Admin" : selectedUser.isFinanceManager ? "Finance Manager" : "Standard User"}
                </span>{" "}
                →{" "}
                <span className="font-semibold">
                  {grantAdmin && grantFinance ? "Admin + Finance Manager" : grantAdmin ? "Admin" : grantFinance ? "Finance Manager" : "Standard User"}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-slate-200"
                disabled={isPending}
                onClick={() => {
                  setSelectedUser(null);
                  setGrantAdmin(false);
                  setGrantFinance(false);
                }}
              >
                Reset
              </Button>
              <Button
                type="submit"
                disabled={isPending || !selectedUser}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                {isPending ? "Updating…" : "Update access"}
              </Button>
            </div>
          </form>
        </SectionCard>

        {/* ── Admin list ─── */}
        <SectionCard
          title="Users with elevated access"
          description="Filter by role or search to find a specific user. Use the menu to revoke access."
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email…"
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
                </SelectContent>
              </Select>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No elevated users found"
              description={
                adminUsers.length === 0
                  ? "No users have been granted elevated access yet."
                  : "No users match your filters."
              }
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
                        style={{ backgroundColor: u.avatarColor || avatarColor(u.email) }}
                      >
                        {initials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{u.name}</p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-[11px] text-slate-400">Joined</p>
                      <p className="text-xs text-slate-600">{formatRelative(u.joinedAt)}</p>
                    </div>
                    <Badge variant="outline" className={cn("gap-1 shrink-0", ROLE_BADGE[u.role])}>
                      <Icon className="h-3 w-3" />
                      {roleLabel(u.role)}
                    </Badge>
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
                      <DropdownMenuContent align="end" className="w-48 border-slate-200">
                        <DropdownMenuItem
                          className="text-xs text-slate-700"
                          onClick={() => {
                            const user = allPlatformUsers.find((p) => p.email === u.email);
                            if (user) handleSelectUser(user);
                          }}
                        >
                          <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-slate-400" />
                          Edit roles
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-xs text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                          onClick={() => setRevokeTarget(u)}
                          disabled={isPending}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Revoke all access
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
          title: "Revoke all elevated access?",
          description: (
            <span>
              <strong>{revokeTarget?.name}</strong> ({revokeTarget?.email}) will lose their{" "}
              <strong>{roleLabel(revokeTarget?.role ?? "user")}</strong> role and become a standard
              user. They will immediately lose access to this admin console and the Finance panel.
            </span>
          ),
          confirmLabel: isPending ? "Revoking…" : "Revoke access",
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
    violet: { border: "border-violet-300", bg: "bg-violet-50", text: "text-violet-600" },
    emerald: { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-600" },
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
