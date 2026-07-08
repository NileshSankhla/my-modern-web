"use client";

import Link from "next/link";
import { forwardRef } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

type HapticPattern = keyof typeof haptic;

// Derive ButtonProps from the Button component's props type safely
type ButtonComponentProps = React.ComponentPropsWithRef<typeof Button>;

interface HapticButtonProps extends ButtonComponentProps {
  /** Haptic pattern to fire on click. Default: "medium" */
  hapticPattern?: HapticPattern;
}

/**
 * Button wrapper that fires haptic feedback on click.
 * On desktop (no vibration support), the call is a silent no-op.
 *
 * Usage:
 *   <HapticButton hapticPattern="success">Save</HapticButton>
 *   <HapticButton hapticPattern="light" variant="ghost">Cancel</HapticButton>
 */
export const HapticButton = forwardRef<HTMLButtonElement, HapticButtonProps>(
  ({ hapticPattern = "medium", onClick, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          haptic[hapticPattern]();
          onClick?.(e);
        }}
        {...props}
      />
    );
  },
);
HapticButton.displayName = "HapticButton";

/**
 * Next.js Link wrapper with haptic feedback. Uses client-side navigation.
 * On desktop (no vibration support), the call is a silent no-op.
 *
 * Usage:
 *   <HapticLink href="/dashboard" hapticPattern="navigation">Dashboard</HapticLink>
 */
export function HapticLink({
  href,
  children,
  hapticPattern = "navigation",
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  hapticPattern?: HapticPattern;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        haptic[hapticPattern]();
        onClick?.();
      }}
    >
      {children}
    </Link>
  );
}
