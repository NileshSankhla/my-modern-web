import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
const GOOGLE_OAUTH_REDIRECT_COOKIE = "google_oauth_redirect";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const getSafeRedirectPath = (redirectTo: string) => {
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "/";
  }

  return redirectTo;
};

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = request.nextUrl.origin;
  const requestedRedirect = request.nextUrl.searchParams.get("redirect") ?? "/";
  const redirectTo = getSafeRedirectPath(requestedRedirect);

  if (!clientId) {
    return NextResponse.json(
      { error: "Google Sign-In is not configured." },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_TTL_MS / 1000,
  });
  cookieStore.set(GOOGLE_OAUTH_REDIRECT_COOKIE, redirectTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_TTL_MS / 1000,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
