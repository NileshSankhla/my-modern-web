/**
 * Haptic feedback utility to provide physical feedback to the user on touch devices.
 */
export const playHaptic = (type: "light" | "heavy" = "light") => {
  // First, check if the browser actually supports vibration
  if (typeof window !== "undefined" && navigator.vibrate) {
    if (type === "light") {
      navigator.vibrate(10); // A tiny 10-millisecond tick (good for buttons)
    } else if (type === "heavy") {
      navigator.vibrate([30, 50, 30]); // Vibrate 30ms, pause 50ms, vibrate 30ms (good for errors/success)
    }
  }
};
