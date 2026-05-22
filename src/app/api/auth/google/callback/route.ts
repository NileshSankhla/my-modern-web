import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { createSession, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isConfiguredAdminEmail } from "@/lib/admin";
import { sendWelcomeEmail } from "@/lib/email";
import { ensureWalletsForUser } from "@/lib/wallet";

const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
const GOOGLE_OAUTH_REDIRECT_COOKIE = "google_oauth_redirect";

const getSafeRedirectPath = (redirectTo: string) => {
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "/";
  }

  return redirectTo;
};

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  id_token?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=google_denied`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=google_invalid`, request.url),
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const storedRedirect = cookieStore.get(GOOGLE_OAUTH_REDIRECT_COOKIE)?.value;
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);
  cookieStore.delete(GOOGLE_OAUTH_REDIRECT_COOKIE);
  const redirectPath = getSafeRedirectPath(storedRedirect ?? "/");

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=google_invalid`, request.url),
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = request.nextUrl.origin;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=google_config`, request.url),
    );
  }

  try {
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Google token exchange failed:", await tokenResponse.text());
      return NextResponse.redirect(
        new URL(`/sign-in?error=google_token`, request.url),
      );
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Fetch user info from Google
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );

    if (!userInfoResponse.ok) {
      console.error("Google user info fetch failed:", await userInfoResponse.text());
      return NextResponse.redirect(
        new URL(`/sign-in?error=google_userinfo`, request.url),
      );
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json();

    if (!googleUser.email_verified) {
      return NextResponse.redirect(
        new URL(`/sign-in?error=google_unverified`, request.url),
      );
    }

    const email = googleUser.email.toLowerCase();

    // Find or create user
    let [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existingUser) {
      // Create a new user — no password since they sign in via Google
      const randomPassword = hashPassword(randomBytes(32).toString("hex"));
      const [createdUser] = await db
        .insert(users)
        .values({
          name: googleUser.name,
          email,
          passwordHash: randomPassword,
          isAdmin: isConfiguredAdminEmail(email),
        })
        .returning({ id: users.id });

      await ensureWalletsForUser(createdUser.id);
      existingUser = createdUser;

      const welcomeEmailResult = await sendWelcomeEmail(email, googleUser.name);
      if (!welcomeEmailResult.success && !welcomeEmailResult.skipped) {
        console.error("Failed to send welcome email for new Google signup:", {
          email,
          error: welcomeEmailResult.error,
        });
      }
    }

    await createSession(existingUser.id);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(`/sign-in?error=google_error`, request.url),
    );
  }

  redirect(redirectPath);
}
