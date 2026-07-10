"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { adminSendAlertSchema } from "@/lib/validations/auth";

interface NotificationActionState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

const getString = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value : "";

export const adminSendAlertAction = async (
  _prevState: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> => {
  try {
    const admin = await requireAdminUser();

    const payload = {
      recipientType: getString(formData.get("recipientType")),
      userEmail: getString(formData.get("userEmail")).trim().toLowerCase(),
      message: getString(formData.get("message")).trim(),
    };

    const validation = adminSendAlertSchema.safeParse(payload);
    if (!validation.success) {
      return {
        error: "Please correct the highlighted fields.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    if (validation.data.recipientType === "single") {
      const [targetUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, validation.data.userEmail ?? ""))
        .limit(1);

      if (!targetUser) {
        return { error: "User not found for this email." };
      }

      await db.insert(notifications).values({
        userId: targetUser.id,
        message: validation.data.message,
        adminUserId: admin.id,
      });

      revalidatePath("/admin");
      revalidatePath("/notifications");
      return { success: "Alert sent to user." };
    }

    const allUsers = await db.select({ id: users.id }).from(users);

    if (allUsers.length === 0) {
      return { error: "No users found to receive alert." };
    }

    await db.insert(notifications).values(
      allUsers.map((user) => ({
        userId: user.id,
        message: validation.data.message,
        adminUserId: admin.id,
      })),
    );

    revalidatePath("/admin");
    revalidatePath("/notifications");
    return { success: `Alert sent to ${allUsers.length} user(s).` };
  } catch (error) {
    console.error("Admin send alert error:", error);
    return { error: "Failed to send alert." };
  }
};

export const markNotificationsAsReadAction = async () => {
  try {
    const user = await requireUser();

    await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

    revalidatePath("/notifications");
    revalidatePath("/");
  } catch (error) {
    console.error("Mark notifications as read error:", error);
  }
};
