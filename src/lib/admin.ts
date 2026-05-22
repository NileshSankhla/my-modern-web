import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const parseAdminEmails = () => {
  const raw = process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

export const isConfiguredAdminEmail = (email: string) => {
  const admins = parseAdminEmails();
  return admins.includes(email.toLowerCase());
};

export const requireAdminUser = async () => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect=/admin");
  }

  if (user.isAdmin || isConfiguredAdminEmail(user.email)) {
    if (!user.isAdmin && isConfiguredAdminEmail(user.email)) {
      await db
        .update(users)
        .set({ isAdmin: true, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    return { ...user, isAdmin: true };
  }

  redirect("/dashboard");
};
