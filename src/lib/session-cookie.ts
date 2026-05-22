import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "session_token";

export const getSessionTokenFromRequest = (request: NextRequest) =>
  request.cookies.get(SESSION_COOKIE_NAME)?.value;
