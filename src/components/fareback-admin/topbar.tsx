"use client";

import { useState } from "react";
import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { Bell, Search, Menu, ChevronDown, LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { AdminRole } from "./data";
import type { AdminTab } from "./sidebar";

const TAB_LABELS: Record<AdminTab, string> = {
  overview: "Overview",
  access: "Access control",
  communications: "Communications",
  links: "Affiliate links",
  data: "Data & cache",
  audit: "Audit log",
};

export function AdminTopbar({
  active,
  onToggleSidebar,
  currentAdmin,
}: {
  active: AdminTab;
  onToggleSidebar: () => void;
  currentAdmin: { name: string; email: string; role: string; avatarColor: string; };
}) {
  const { toast } = useToast();
  const initials = currentAdmin.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md lg:px-6">
      {/* Sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-4.5 w-4.5 h-5 w-5" />
      </Button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Admin</span>
        <span className="text-slate-300">/</span>
        <span className="font-semibold text-slate-900">{TAB_LABELS[active]}</span>
      </div>

      {/* Global search */}
      <div className="ml-6 hidden max-w-md flex-1 md:block">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search users, links, audit events…"
            className="h-9 border-slate-200 bg-slate-50 pl-9 text-sm placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-violet-500/40"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Notifications"
            >
              <Bell className="h-4.5 w-4.5 h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 border-slate-200 p-0" align="end">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-600">
                3 new
              </Badge>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { t: "New withdrawal request", d: "FB-1042 requested ₹4,200", time: "2m ago" },
                { t: "Cache flushed", d: "Rohan flushed Redis cache", time: "3h ago" },
                { t: "New affiliate link", d: "fareback-26 added to rotation", time: "5h ago" },
              ].map((n) => (
                <div key={n.t} className="px-4 py-3 hover:bg-slate-50">
                  <p className="text-sm font-medium text-slate-900">{n.t}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{n.d}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{n.time}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 p-2">
              <Button variant="ghost" size="sm" className="w-full text-xs text-slate-600">
                View all
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100">
              <Avatar className="h-8 w-8 border border-slate-200">
                <AvatarFallback
                  className="text-[11px] font-semibold text-white"
                  style={{ backgroundColor: currentAdmin.avatarColor }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold leading-tight text-slate-900">
                  {currentAdmin.name}
                </p>
                <p className="text-[10px] leading-tight text-slate-500">{currentAdmin.role}</p>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-slate-200">
            <DropdownMenuLabel className="text-xs font-normal text-slate-500">
              Signed in as
              <p className="text-sm font-semibold text-slate-900">{currentAdmin.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer text-sm text-slate-700">
              <Link href="/profile">
                <User className="mr-2 h-4 w-4 text-slate-400" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer text-sm text-slate-700">
              <Link href="/profile/account">
                <Settings className="mr-2 h-4 w-4 text-slate-400" /> Account settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer text-sm text-rose-600 focus:bg-rose-50 focus:text-rose-700">
              <form action={signOutAction} className="w-full">
                <button type="submit" className="flex w-full items-center">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
