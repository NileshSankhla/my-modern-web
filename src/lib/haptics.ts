// ============================================================================
// FAREBACK — Haptic feedback utility (mobile vibrations)
// ============================================================================
// Provides typed vibration patterns for mobile devices. On desktop/no-vibration
// devices, calls are silent no-ops. Safe to call anywhere — guards against
// environments without navigator.vibrate.
//
// Usage:
//   import { haptic } from "@/lib/haptics";
//   haptic.light();    // 8ms tap
//   haptic.medium();   // 16ms tap
//   haptic.heavy();    // 24ms tap
//   haptic.success();  // tap-pause-tap pattern
//   haptic.error();    // tap-tap-tap pattern
//   haptic.selection(); // 5ms tick (for picker changes)
// ============================================================================

type VibratePattern = number | number[];

const vibrate = (pattern: VibratePattern): void => {
  if (typeof window === "undefined") return;
  if (typeof navigator === "undefined") return;
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Silent fail — haptics are best-effort, never break UX.
  }
};

export const haptic = {
  /** Very subtle tap — for hover states, focus, minor interactions. */
  light: () => vibrate(8),

  /** Noticeable tap — for button presses, toggles, switches. */
  medium: () => vibrate(16),

  /** Strong tap — for primary action confirmations. */
  heavy: () => vibrate(24),

  /** Success pattern — two ascending taps. For form submissions, rewards earned. */
  success: () => vibrate([10, 40, 20]),

  /** Error pattern — three quick taps. For validation errors, failures. */
  error: () => vibrate([15, 30, 15, 30, 15]),

  /** Warning pattern — single longer buzz. */
  warning: () => vibrate([30]),

  /** Selection tick — very short, for picker/selector changes. */
  selection: () => vibrate(5),

  /** Pattern for navigation transitions. */
  navigation: () => vibrate(10),

  /** Pattern for reward earned (special celebratory feel). */
  reward: () => vibrate([8, 30, 8, 30, 8, 30, 20]),
};

// ── Legacy export for backward compatibility ────────────────────────────────
// The old API was: playHaptic("light" | "heavy")
// Keep this so any existing callers don't break during migration.
export const playHaptic = (type: "light" | "heavy" = "light") => {
  if (type === "light") haptic.light();
  else haptic.heavy();
};

// ── React hook (for use in client components) ──────────────────────────────
//
// Usage:
//   "use client";
//   import { useHaptics } from "@/lib/haptics";
//   const haptic = useHaptics();
//   <button onClick={() => haptic.medium()}>Click me</button>
//
// The hook checks for `navigator.vibrate` support at call time, so it's safe
// to use during SSR.

export function useHaptics() {
  return haptic;
}

// ── Browser support check ──────────────────────────────────────────────────

export const isHapticsSupported = (): boolean => {
  if (typeof window === "undefined") return false;
  if (typeof navigator === "undefined") return false;
  return "vibrate" in navigator;
};

// ── Higher-order event handler ─────────────────────────────────────────────
//
// Wraps an onClick (or similar) with automatic haptic feedback.
// Usage:
//   <button onClick={withHaptic(onClick, "medium")}>Click me</button>

export function withHaptic<T extends (...args: unknown[]) => unknown>(
  handler: T,
  pattern: keyof typeof haptic = "medium",
): T {
  return ((...args: unknown[]) => {
    haptic[pattern]();
    return handler(...args);
  }) as T;
}
