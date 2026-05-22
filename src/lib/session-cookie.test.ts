import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { getSessionTokenFromRequest } from "@/lib/session-cookie";

describe("session cookie helpers", () => {
  it("reads the primary session cookie", () => {
    const request = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: "session_token=abc123",
      },
    });

    expect(getSessionTokenFromRequest(request)).toBe("abc123");
  });

  it("returns undefined when no session cookie is present", () => {
    const request = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: "",
      },
    });

    expect(getSessionTokenFromRequest(request)).toBeUndefined();
  });
});
