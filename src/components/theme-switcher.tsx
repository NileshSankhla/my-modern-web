"use client";

import { Moon, Sun } from "lucide-react";

import { useThemeSwitcher } from "@/hooks/use-theme";

const ThemeSwitcher = () => {
  const { resolvedTheme, toggleTheme, mounted } = useThemeSwitcher();

  if (!mounted) {
    return (
      <button
        className="h-10 w-10 rounded-full border border-border/50 bg-background/50 opacity-50"
        aria-label="Loading theme..."
        disabled
      />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="group flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-background/50 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:shadow-[0_0_15px_hsl(var(--primary)/0.15)]"
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5 text-muted-foreground transition-all duration-500 group-hover:rotate-90 group-hover:text-primary" />
      ) : (
        <Moon className="h-5 w-5 text-muted-foreground transition-all duration-500 group-hover:-rotate-12 group-hover:text-primary" />
      )}
    </button>
  );
};

export default ThemeSwitcher;
