import { revalidatePath } from "next/cache";

/**
 * Common paths that need revalidation after data mutations
 */
export const COMMON_REVALIDATE_PATHS = {
  ADMIN: "/admin",
  DASHBOARD: "/dashboard",
  HOME: "/",
  NOTIFICATIONS: "/notifications",
} as const;

/**
 * Revalidate multiple paths at once
 * @param paths - Array of paths to revalidate
 */
export function revalidateMultiplePaths(
  paths: (keyof typeof COMMON_REVALIDATE_PATHS | string)[]
): void {
  const pathsToRevalidate = paths.map((path) => {
    if (path in COMMON_REVALIDATE_PATHS) {
      return COMMON_REVALIDATE_PATHS[
        path as keyof typeof COMMON_REVALIDATE_PATHS
      ];
    }
    return path;
  });

  pathsToRevalidate.forEach((path) => revalidatePath(path));
}

/**
 * Revalidate admin-related paths
 */
export function revalidateAdminPaths(): void {
  revalidatePath(COMMON_REVALIDATE_PATHS.ADMIN);
}

/**
 * Revalidate user-facing paths
 */
export function revalidateUserPaths(): void {
  revalidatePath(COMMON_REVALIDATE_PATHS.DASHBOARD);
  revalidatePath(COMMON_REVALIDATE_PATHS.HOME);
}

/**
 * Revalidate all common paths
 */
export function revalidateAllCommonPaths(): void {
  Object.values(COMMON_REVALIDATE_PATHS).forEach((path) => revalidatePath(path));
}
