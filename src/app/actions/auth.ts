"use server";

import { redirect } from "next/navigation";

import {
  clearSessionCookie,
  deleteSessionByToken,
  getSessionToken,
  getCurrentUser,
} from "@/lib/auth";
import { logSecurityEvent, SECURITY_EVENTS } from "@/lib/security/audit";

export const signOutAction = async () => {
  let userId: number | null = null;
  try {
    const user = await getCurrentUser();
    if (user) {
      userId = user.id;
    }
    const sessionToken = await getSessionToken();
    if (sessionToken) {
      await deleteSessionByToken(sessionToken);
    }
    if (userId) {
      await logSecurityEvent(SECURITY_EVENTS.SIGN_OUT, {
        actorId: userId,
        metadata: { method: "user_action" },
      });
    }
  } catch (error) {
    console.error("Sign out error:", error);
  } finally {
    await clearSessionCookie();
  }

  redirect("/");
};
