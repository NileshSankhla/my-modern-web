import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Sparkles, TrendingUp, Zap } from "lucide-react";
import SignInForm from "@/components/auth/sign-in-form";
import PageShell from "@/components/ui/page-shell";

export const metadata: Metadata = {
  title: "Sign In | Fareback",
  description:
    "Securely sign in with your Google account to start earning cashback and Amazon rewards.",
};

interface SignInPageProps {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}

const SignInPage = async ({ searchParams }: SignInPageProps) => {
  const params = await searchParams;
  const redirectTo = params.redirect?.trim() || "/";
  const googleError = params.error?.trim() || null;

  return (
    <PageShell className="relative flex flex-col items-center justify-center overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[100px]" />

      <div className="z-10 w-full max-w-sm">
        {/* Logo / brand area */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Welcome to Fareback
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to track cashback and earn rewards
          </p>
        </div>

        {/* Sign-in card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
          {/* Top accent line */}
          <div className="absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-primary via-primary/60 to-warning opacity-70" />

          <SignInForm redirectTo={redirectTo} googleError={googleError} />

          {/* Feature pills */}
          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/40 pt-5">
            {[
              { icon: Zap, label: "Instant" },
              { icon: Sparkles, label: "Guaranteed" },
              { icon: TrendingUp, label: "Real Cash" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Legal */}
        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          By continuing, you agree to Fareback&apos;s{" "}
          <Link
            href="/terms"
            className="font-semibold underline underline-offset-2 hover:text-foreground"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="font-semibold underline underline-offset-2 hover:text-foreground"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </PageShell>
  );
};

export default SignInPage;
