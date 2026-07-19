/**
 * Next.js Instrumentation Hook
 *
 * Runs ONCE when the server starts (both dev and prod).
 * Use this for:
 *  - Boot-time secret validation (crash fast if env is misconfigured)
 *  - DB schema checks
 *  - Registering background workers
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateSecrets } = await import("@/lib/security/secrets");

    const { valid, missing } = validateSecrets();

    if (!valid) {
      const msg = `[FAREBACK BOOT] Missing required secrets: ${missing.join(", ")}`;

      if (process.env.NODE_ENV === "production") {
        // Hard fail in production — do not start with missing secrets
        throw new Error(msg);
      } else {
        // Warn in dev — allow partial startup for faster iteration
        console.warn(`⚠️  ${msg}`);
        console.warn(
          "   Add the missing variables to .env.local before testing affected features.",
        );
      }
    } else {
      console.log(
        `✅ [FAREBACK BOOT] All ${missing.length === 0 ? "required" : ""} secrets validated.`,
      );
    }
  }
}
