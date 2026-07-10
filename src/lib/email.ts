import "server-only";

import { Resend } from "resend";

import WelcomeEmail from "@/components/emails/welcome-email";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL ?? "Fareback <support@fareback.in>";
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

const getFirstName = (name: string) => {
  const first = name.trim().split(/\s+/)[0];
  return first || "there";
};

export const sendWelcomeEmail = async (userEmail: string, userName: string) => {
  if (!resendClient) {
    console.warn("RESEND_API_KEY is missing; skipping welcome email send.");
    return { success: false, skipped: true as const, error: "missing_api_key" };
  }

  try {
    const { data, error } = await resendClient.emails.send({
      from: resendFrom,
      to: [userEmail],
      subject: "Welcome to Fareback! 🚀",
      react: WelcomeEmail({ firstName: getFirstName(userName) }) as React.ReactElement,
    });

    if (error) {
      console.error("Failed to send welcome email:", error);
      return { success: false as const, skipped: false as const, error };
    }

    return { success: true as const, skipped: false as const, data };
  } catch (error) {
    console.error("Unexpected welcome email error:", error);
    return { success: false as const, skipped: false as const, error };
  }
};
