"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "fareback:theme";
const THEME_COOKIE_KEY = "fareback_theme";

const applyTheme = (nextTheme: ThemeMode) => {
  document.documentElement.classList.toggle("dark", nextTheme === "dark");
  document.documentElement.style.colorScheme = nextTheme;
};

const persistTheme = (nextTheme: ThemeMode) => {
  window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  document.cookie = `${THEME_COOKIE_KEY}=${nextTheme}; path=/; max-age=31536000; samesite=lax`;
};

const readStoredTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const cookieTheme = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${THEME_COOKIE_KEY}=`))
    ?.split("=")[1];

  return storedTheme === "light" || cookieTheme === "light" ? "light" : "dark";
};

const subscribeToHydration = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export const useThemeSwitcher = () => {
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    persistTheme(theme);
    applyTheme(theme);
  }, [mounted, theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  return { theme, resolvedTheme: theme, setTheme, toggleTheme, mounted };
};
