// ============================================================================
// FAREBACK — Auth Bridge (Wraps Security Module for Backward Compatibility)
// ============================================================================

import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, destroySession } from "./security/session";

export * from "./security/session";
export { hashPassword, verifyPassword } from "./security/password";

export const deleteSessionByToken = destroySession;

export const requireUser = async () => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return user;
};
