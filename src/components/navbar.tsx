import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import NotificationBellClient from "./notification-bell-client";
import NavbarWalletClient from "./navbar-wallet-client";
import ThemeSwitcher from "./theme-switcher";
import { Button } from "./ui/button";
import { DashboardToggleButton } from "./action-buttons";

const Navbar = async () => {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 elev-1 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container relative z-10 mx-auto flex h-14 items-center justify-between px-4 md:h-16">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center transition-transform hover:scale-105"
          aria-label="Fareback home"
        >
          <Image
            src="/brand-name-dark.svg"
            alt="Fareback"
            width={140}
            height={56}
            className="h-8 w-auto dark:hidden md:h-9"
            priority
          />
          <Image
            src="/brand-name-light.svg"
            alt="Fareback"
            width={140}
            height={56}
            className="hidden h-8 w-auto dark:block md:h-9"
            priority
          />
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {[
            { name: "Offers", href: "/#offers" },
            { name: "How It Works", href: "/#how-it-works" },
            { name: "FAQ", href: "/#faq" },
          ].map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="group relative py-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.name}
              <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2 md:gap-3">
          <ThemeSwitcher />
          {user ? (
            <div className="flex items-center gap-1.5 md:gap-2">
              {/* Wallet: desktop only (mobile has bottom nav) */}
              <NavbarWalletClient />
              {/* Notification bell */}
              <NotificationBellClient />
              {/* Dashboard toggle: desktop only */}
              <DashboardToggleButton />

              {user.isAdmin ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden border-primary/30 hover:bg-primary/10 sm:flex"
                    asChild
                  >
                    <Link href="/admin">Admin</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 sm:flex dark:text-emerald-400"
                    asChild
                  >
                    <Link href="/finance">Finance</Link>
                  </Button>
                </>
              ) : null}

              {/* Sign out: desktop only — mobile users sign out from Profile page */}
              <form action={signOutAction} className="hidden md:block">
                <Button
                  size="icon"
                  type="submit"
                  variant="ghost"
                  className="rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Sign Out</span>
                </Button>
              </form>
            </div>
          ) : (
            <Button
              size="sm"
              className="rounded-full px-5 shadow-[0_0_15px_hsl(var(--primary)/0.2)] transition-all hover:scale-105 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
              asChild
            >
              <Link href="/sign-in">Get Started</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
