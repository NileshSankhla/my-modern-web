"use server";

import { requireAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { logSecurityEvent, SECURITY_EVENTS } from "@/lib/security/audit";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function setFinanceManagerAction(
  email: string,
  isFinanceManager: boolean,
) {
  const admin = await requireAdminUser();

  if (!email || !email.includes("@")) {
    return { error: "Invalid email" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) {
    return { error: "User not found" };
  }

  await db.update(users).set({ isFinanceManager }).where(eq(users.id, user.id));

  await logSecurityEvent(
    isFinanceManager ? SECURITY_EVENTS.ROLE_GRANTED : SECURITY_EVENTS.ROLE_REVOKED,
    {
      actorId: admin.id,
      entityType: "user",
      entityId: String(user.id),
      metadata: { role: "finance_manager", email },
    },
  );

  revalidatePath("/admin");
  return { success: `Successfully updated specialist access for ${email}` };
}

export async function setAdminAction(email: string, isAdmin: boolean) {
  const admin = await requireAdminUser();

  if (!email || !email.includes("@")) {
    return { error: "Invalid email" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) {
    return { error: "User not found" };
  }

  await db.update(users).set({ isAdmin }).where(eq(users.id, user.id));

  await logSecurityEvent(
    isAdmin ? SECURITY_EVENTS.ROLE_GRANTED : SECURITY_EVENTS.ROLE_REVOKED,
    {
      actorId: admin.id,
      entityType: "user",
      entityId: String(user.id),
      metadata: { role: "admin", email },
    },
  );

  revalidatePath("/admin");
  return { success: `Successfully updated admin status for ${email}` };
}

export async function bulkApproveCSVAction(csvText: string) {
  const admin = await requireAdminUser();
  if (!csvText) return { error: "Empty CSV" };

  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let successCount = 0;
  let errorCount = 0;

  // Expected format: clickId,amountInRupees
  // Skip header if first line doesn't look like UUID
  const dataLines =
    lines[0]?.includes(",") && !lines[0].match(/^[0-9a-fA-F-]{36}/)
      ? lines.slice(1)
      : lines;

  for (const line of dataLines) {
    const [clickId, amount] = line.split(",").map((s) => s.trim());
    if (!clickId || !amount) {
      errorCount++;
      continue;
    }

    try {
      const formData = new FormData();
      formData.append("clickId", clickId);
      formData.append("amount", amount);

      // We dynamically import to avoid circular dependencies if any
      const { adminApproveClickFormAction } =
        await import("@/app/actions/wallet");
      await adminApproveClickFormAction(formData);
      successCount++;
    } catch (e) {
      console.error("Bulk approve error on row:", line, e);
      errorCount++;
    }
  }

  await logSecurityEvent(SECURITY_EVENTS.CSV_IMPORTED, {
    actorId: admin.id,
    entityType: "clicks",
    metadata: { successCount, errorCount, totalLines: dataLines.length },
  });

  return {
    success: `Processed CSV: ${successCount} successful, ${errorCount} failed.`,
  };
}
