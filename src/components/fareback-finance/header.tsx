"use client";

import { Wallet, LogOut, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { signOutAction } from "@/app/actions/auth";

/**
 * Fareback Finance — top header bar.
 * Left: brand mark + wordmark.
 * Right: role chip + signed-in user + avatar.
 */
export function FinanceHeader({
  managerName = "Finance Manager",
  managerEmail = "",
}: {
  managerName?: string;
  managerEmail?: string;
}) {
  const initials = managerName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      {/* Top accent line — Fareback brand gradient */}
      <div className="absolute top-0 left-0 h-[2px] w-full bg-gradient-to-r from-emerald-400 via-violet-500 to-emerald-400" />

      <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-4 px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-200">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              Fareback{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-violet-600 bg-clip-text text-transparent">
                Finance
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Rewards ledger & treasury console</p>
          </div>
        </div>

        {/* Security badge */}
        <div className="ml-4 hidden items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 lg:flex">
          <Shield className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-[11px] font-semibold text-emerald-700">Secure Console</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-3 sm:flex">
            <Badge
              variant="outline"
              className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50 font-semibold"
            >
              Finance Manager
            </Badge>
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight text-slate-900">{managerName}</p>
              {managerEmail && (
                <p className="text-[11px] leading-tight text-slate-500">{managerEmail}</p>
              )}
            </div>
            <Avatar className="h-9 w-9 border-2 border-emerald-200 shadow-sm">
              <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>

            <form action={signOutAction} className="ml-1">
              <Button
                size="icon"
                type="submit"
                variant="ghost"
                className="rounded-full text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign Out</span>
              </Button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
