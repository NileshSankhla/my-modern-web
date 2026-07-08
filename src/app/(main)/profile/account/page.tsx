import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  Mail,
  User,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import PageShell from "@/components/ui/page-shell";
import PageHeader from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Account Details | Fareback",
  description: "View your Fareback account information.",
};

export default async function AccountDetailsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect=/profile/account");
  }

  // Fetch full user record with createdAt
  const [fullUser] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  // Fetch most recent session
  const [lastSession] = await db
    .select({ createdAt: sessions.createdAt })
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.createdAt))
    .limit(1);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <PageShell>
      <PageHeader
        title="Account Details"
        subtitle="Your personal information"
        backHref="/profile"
      />

      {/* Avatar */}
      <div className="mb-6 flex flex-col items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-primary-foreground shadow-lg">
          <span className="text-2xl font-bold">{initials}</span>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-extrabold">{fullUser?.name ?? "Fareback User"}</h2>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-bold text-success">
            <BadgeCheck className="h-3 w-3" />
            Verified Account
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            Full Name
          </div>
          <p className="text-base font-bold text-foreground">
            {fullUser?.name ?? "Not set"}
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Email Address
          </div>
          <p className="break-all text-base font-bold text-foreground">
            {fullUser?.email}
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Member Since
          </div>
          <p className="text-base font-bold text-foreground">
            {fullUser?.createdAt
              ? fullUser.createdAt.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </p>
        </div>

        {lastSession && (
          <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Last Sign In
            </div>
            <p className="text-base font-bold text-foreground">
              {formatDate(lastSession.createdAt)}
            </p>
          </div>
        )}
      </div>

      {/* Security note */}
      <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Your data is secure
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Account name and email are set at sign-up. To update your details,
              please contact support.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
