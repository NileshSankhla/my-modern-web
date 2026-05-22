"use server";

import { redirect } from "next/navigation";

import {
  clearSessionCookie,
  deleteSessionByToken,
  getSessionToken,
} from "@/lib/auth";

export const signOutAction = async () => {
  try {
    const sessionToken = await getSessionToken();
    if (sessionToken) {
      await deleteSessionByToken(sessionToken);
    }

    await clearSessionCookie();
  } catch (error) {
    console.error("Sign out error:", error);
  }

  redirect("/");
};
