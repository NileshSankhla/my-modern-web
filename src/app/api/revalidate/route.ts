import { type NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { revalidateAllCommonPaths } from "@/lib/revalidate";

const secureEqual = (a: string, b: string) => {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
};

export async function GET() {
  return NextResponse.json({ message: "Method not allowed" }, { status: 405 });
}

const getRequestSecret = (request: NextRequest) => {
  const headerSecret = request.headers.get("x-revalidate-secret");
  if (headerSecret) {
    return headerSecret;
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  return null;
};

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  const secret = getRequestSecret(request);

  if (!configuredSecret || !secret || !secureEqual(secret, configuredSecret)) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  revalidateAllCommonPaths();

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
