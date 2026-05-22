"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Filter, RefreshCcw, Search, Trash2 } from "lucide-react";

import {
  adminApproveClickFormAction,
  adminDeleteUnreviewedClickFormAction,
  adminMarkClickTrackedFormAction,
  adminPermanentlyDeleteAllDeletedClicksFormAction,
  adminRestoreDeletedClickFormAction,
  adminUndoApprovedClickFormAction,
  adminUndoTrackedClickFormAction,
} from "@/app/actions/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatPaiseAsINR } from "@/lib/utils";

type ClickStatus = "unreviewed" | "tracked" | "approved" | "deleted";

interface AdminClickItem {
  id: string;
  createdAt: string;
  userEmail: string;
  merchantName: string;
  trackingStatus: ClickStatus;
  rewardAmountInPaise: number;
  affiliateLinkIndex: number | null;
}

interface WalletUserItem {
  email: string;
  name: string | null;
  cashbackBalanceInPaise: number;
  amazonRewardBalanceInPaise: number;
  updatedAt: Date;
}

interface AdminInteractiveSectionsProps {
  usersCount: number;
  clicksCount: number;
  unreviewedClicksCount: number;
  trackedClicksCount: number;
  clicks: AdminClickItem[];
}

const statusColors: Record<ClickStatus, string> = {
  unreviewed:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  tracked:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50",
  approved:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50",
  deleted:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50",
};

const clickStatusLabel: Record<ClickStatus, string> = {
  unreviewed: "Unreviewed",
  tracked: "Tracked",
  approved: "Approved",
  deleted: "Deleted",
};

const AdminInteractiveSections = ({
  unreviewedClicksCount,
  clicks,
}: AdminInteractiveSectionsProps) => {
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userSort, setUserSort] = useState<"latest" | "name-asc" | "name-desc" | "wallet-asc" | "wallet-desc">("wallet-desc");
  const [usersWithWallet, setUsersWithWallet] = useState<WalletUserItem[]>([]);
  const [usersTotalCount, setUsersTotalCount] = useState(0);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);
  const [collapsedUserGroups, setCollapsedUserGroups] = useState<Record<string, boolean>>({});

  const [showAllClicks, setShowAllClicks] = useState(false);
  const [clickFilter, setClickFilter] = useState<"all" | ClickStatus>("unreviewed");

  useEffect(() => {
    const normalized = userSearch.trim();
    const effectiveLimit = showAllUsers ? 50 : 10;
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setIsUsersLoading(true);
      setUsersLoadError(null);

      try {
        const params = new URLSearchParams({
          mode: "wallet",
          limit: String(effectiveLimit),
          sort: userSort,
        });

        if (normalized.length > 0) {
          params.set("q", normalized);
        }

        const response = await fetch(`/api/admin/users/search?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load users");
        }

        const data = (await response.json()) as {
          users: Array<{
            email: string;
            name: string | null;
            cashbackBalanceInPaise: number;
            amazonRewardBalanceInPaise: number;
            updatedAt: string;
          }>;
          totalCount?: number;
        };

        setUsersWithWallet(
          (data.users ?? []).map((user) => ({
            ...user,
            updatedAt: new Date(user.updatedAt),
          })),
        );
        setUsersTotalCount(data.totalCount ?? (data.users?.length ?? 0));
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setUsersLoadError("Failed to load users.");
      } finally {
        setIsUsersLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [showAllUsers, userSearch, userSort]);

  const visibleUsers = usersWithWallet;

  const filteredClicks = useMemo(() => {
    if (clickFilter === "all") {
      return clicks.filter((click) => click.trackingStatus !== "deleted");
    }

    return clicks.filter((click) => click.trackingStatus === clickFilter);
  }, [clickFilter, clicks]);

  const visibleClicks = showAllClicks ? filteredClicks : filteredClicks.slice(0, 15);

  const clicksGroupedByUser = useMemo(() => {
    const grouped = new Map<string, AdminClickItem[]>();

    for (const click of visibleClicks) {
      const existing = grouped.get(click.userEmail);
      if (existing) {
        existing.push(click);
      } else {
        grouped.set(click.userEmail, [click]);
      }
    }

    return Array.from(grouped.entries()).map(([userEmail, userClicks]) => ({
      userEmail,
      clicks: userClicks,
    }));
  }, [visibleClicks]);

  const toggleUserGroup = (userEmail: string) => {
    setCollapsedUserGroups((prev) => ({
      ...prev,
      [userEmail]: !(prev[userEmail] ?? true),
    }));
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card id="recent-click-tracking" className="flex max-h-[800px] flex-col border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Tracking Ledger</CardTitle>
              <CardDescription className="mt-1">
                <span className="font-medium text-foreground">{unreviewedClicksCount}</span> Require Review
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="flex flex-col gap-2 border-b border-border/40 bg-muted/10 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <select
              value={clickFilter}
              onChange={(event) => setClickFilter(event.target.value as typeof clickFilter)}
              className="h-9 w-full appearance-none rounded-md border border-input bg-background py-1 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Active Records</option>
              <option value="unreviewed">Unreviewed Queue</option>
              <option value="tracked">Tracked</option>
              <option value="approved">Approved</option>
              <option value="deleted">Deleted / Trash</option>
            </select>
          </div>

          {clickFilter === "deleted" ? (
            <form action={adminPermanentlyDeleteAllDeletedClicksFormAction}>
              <Button type="submit" size="sm" variant="destructive" className="h-9 w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" /> Empty Trash
              </Button>
            </form>
          ) : null}
        </div>

        <CardContent className="flex-1 overflow-y-auto p-0">
          <div className="divide-y divide-border/40">
            {visibleClicks.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No records match this filter.</div>
            ) : (
              clicksGroupedByUser.map((group) => {
                const isCollapsed = collapsedUserGroups[group.userEmail] ?? true;

                return (
                  <div key={group.userEmail} className="p-4">
                  <button
                    type="button"
                    onClick={() => toggleUserGroup(group.userEmail)}
                    className="mb-3 flex w-full items-center justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <p className="truncate text-sm font-semibold text-foreground">{group.userEmail}</p>
                    </div>
                    <span className="ml-3 whitespace-nowrap text-xs font-medium text-muted-foreground">
                      {group.clicks.length} click{group.clicks.length === 1 ? "" : "s"}
                    </span>
                  </button>

                  {!isCollapsed ? (
                    <div className="space-y-2">
                      {group.clicks.map((click) => (
                        <div key={click.id} className="rounded-md border border-border/50 p-3 transition-colors hover:bg-muted/10">
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{click.merchantName}</span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusColors[click.trackingStatus]}`}
                              >
                                {clickStatusLabel[click.trackingStatus]}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{formatDate(new Date(click.createdAt))}</p>
                            {click.affiliateLinkIndex !== null ? (
                              <p className="mt-0.5 font-mono text-[10px] text-blue-500">
                                Link #{click.affiliateLinkIndex + 1}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {click.trackingStatus === "unreviewed" ? (
                            <>
                              <form action={adminMarkClickTrackedFormAction} className="inline">
                                <input type="hidden" name="clickId" value={click.id} />
                                <Button type="submit" variant="secondary" size="sm" className="h-7 text-xs">
                                  <Check className="mr-1 h-3 w-3" /> Mark Tracked
                                </Button>
                              </form>
                              <form action={adminDeleteUnreviewedClickFormAction} className="inline">
                                <input type="hidden" name="clickId" value={click.id} />
                                <Button
                                  type="submit"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                >
                                  Delete
                                </Button>
                              </form>
                            </>
                          ) : null}

                          {click.trackingStatus === "unreviewed" || click.trackingStatus === "tracked" ? (
                            <form action={adminApproveClickFormAction} className="ml-auto flex items-center gap-1">
                              <input type="hidden" name="clickId" value={click.id} />
                              <select
                                name="walletType"
                                className="h-7 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                                defaultValue="cashback"
                              >
                                <option value="cashback">Cashback</option>
                                <option value="amazon_rewards">Amazon</option>
                              </select>
                              <div className="relative">
                                <span className="absolute left-2 top-1.5 text-xs text-muted-foreground">INR</span>
                                <Input
                                  name="amount"
                                  placeholder="0.00"
                                  inputMode="decimal"
                                  required
                                  className="h-7 w-24 pl-10 text-xs focus-visible:ring-1"
                                />
                              </div>
                              <Button type="submit" size="sm" className="h-7 bg-emerald-600 text-xs hover:bg-emerald-700">
                                Approve
                              </Button>
                            </form>
                          ) : null}

                          {click.trackingStatus === "tracked" ? (
                            <form action={adminUndoTrackedClickFormAction} className="inline">
                              <input type="hidden" name="clickId" value={click.id} />
                              <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                                <RefreshCcw className="mr-1 h-3 w-3" /> Undo Track
                              </Button>
                            </form>
                          ) : null}

                          {click.trackingStatus === "approved" ? (
                            <div className="flex w-full items-center justify-between">
                              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                +{formatPaiseAsINR(click.rewardAmountInPaise)}
                              </span>
                              <form action={adminUndoApprovedClickFormAction} className="inline">
                                <input type="hidden" name="clickId" value={click.id} />
                                <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                                  <RefreshCcw className="mr-1 h-3 w-3" /> Undo Revoke
                                </Button>
                              </form>
                            </div>
                          ) : null}

                          {click.trackingStatus === "deleted" ? (
                            <form action={adminRestoreDeletedClickFormAction} className="inline">
                              <input type="hidden" name="clickId" value={click.id} />
                              <Button type="submit" variant="outline" size="sm" className="h-7 text-xs">
                                <RefreshCcw className="mr-1 h-3 w-3" /> Restore
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                      ))}
                    </div>
                  ) : null}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>

        {filteredClicks.length > 15 ? (
          <div className="border-t border-border/40 bg-muted/10 p-3">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAllClicks((prev) => !prev)}>
              {showAllClicks ? "Show Less" : `Load Remaining (${filteredClicks.length - 15})`}
            </Button>
          </div>
        ) : null}
      </Card>

      <Card className="flex max-h-[800px] flex-col border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
          <CardTitle className="text-lg">User Directory</CardTitle>
          <CardDescription>All registered accounts and current wallet liabilities.</CardDescription>
        </CardHeader>

        <div className="flex flex-col gap-2 border-b border-border/40 bg-muted/10 p-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search by email or name..."
              className="h-9 w-full pl-9 text-sm focus-visible:ring-1"
            />
          </div>
          <select
            value={userSort}
            onChange={(event) => setUserSort(event.target.value as typeof userSort)}
            className="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-1"
          >
            <option value="wallet-desc">Highest Balance First</option>
            <option value="wallet-asc">Lowest Balance First</option>
            <option value="latest">Latest Updated</option>
            <option value="name-asc">Alphabetical (A-Z)</option>
            <option value="name-desc">Alphabetical (Z-A)</option>
          </select>
        </div>

        <CardContent className="flex-1 overflow-y-auto p-0">
          <div className="divide-y divide-border/40">
            {isUsersLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading users...</div>
            ) : null}

            {usersLoadError ? (
              <div className="p-8 text-center text-sm text-destructive">{usersLoadError}</div>
            ) : null}

            {!isUsersLoading && !usersLoadError && visibleUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No users found.</div>
            ) : (
              visibleUsers.map((wallet) => (
                <div key={wallet.email} className="flex items-center justify-between p-4 transition-colors hover:bg-muted/5">
                  <div className="truncate pr-4">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {wallet.name ?? "Anonymous User"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{wallet.email}</span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`block whitespace-nowrap text-sm font-bold ${
                        wallet.cashbackBalanceInPaise + wallet.amazonRewardBalanceInPaise > 0 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {formatPaiseAsINR(wallet.cashbackBalanceInPaise + wallet.amazonRewardBalanceInPaise)}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Cashback {formatPaiseAsINR(wallet.cashbackBalanceInPaise)} • Amazon {formatPaiseAsINR(wallet.amazonRewardBalanceInPaise)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>

        {usersTotalCount > visibleUsers.length ? (
          <div className="border-t border-border/40 bg-muted/10 p-3">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAllUsers((prev) => !prev)}>
              {showAllUsers ? "Show Less" : `Load More (${usersTotalCount - visibleUsers.length})`}
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export default AdminInteractiveSections;
