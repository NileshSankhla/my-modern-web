import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import SignInForm from "@/components/auth/sign-in-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Secure Sign In | Fareback",
  description:
    "Securely sign in or sign up using your Google account to start earning cashback and Amazon rewards.",
};

interface SignInPageProps {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}

const SignInPage = async ({ searchParams }: SignInPageProps) => {
  const params = await searchParams;
  const redirectTo = params.redirect?.trim() || "/";
  const googleError = params.error?.trim() || null;

  return (
    <div className="relative flex min-h-[calc(100dvh-5rem)] items-center justify-center overflow-hidden bg-muted/5 px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px] animate-pulse" />

      <div className="z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.1)]">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Welcome to Fareback
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Sign in securely to track your cashback, Amazon rewards, and withdrawals.
          </p>
        </div>

        <Card className="relative overflow-hidden border-border/50 bg-background/60 shadow-2xl backdrop-blur-xl">
          <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-amber-500 opacity-70" />

          <CardHeader className="pb-6 pt-8 text-center">
            <CardTitle className="text-xl font-bold">Continue with Google</CardTitle>
            <CardDescription className="mt-2 text-base">
              Fast, secure, one-click authentication. No passwords to remember.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-8">
            <SignInForm redirectTo={redirectTo} googleError={googleError} />

            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border/40 pt-6">
              <div className="group flex flex-col items-center text-center">
                <div className="mb-2 rounded-full bg-secondary p-2 transition-colors group-hover:bg-primary/10">
                  <Sparkles className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  Guaranteed Rates
                </span>
              </div>
              <div className="group flex flex-col items-center text-center">
                <div className="mb-2 rounded-full bg-secondary p-2 transition-colors group-hover:bg-primary/10">
                  <TrendingUp className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  Seamless Tracking
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
          By continuing, you agree to Fareback&apos;s {" "}
          <Link
            href="/terms"
            className="font-medium underline underline-offset-4 transition-colors hover:text-primary"
          >
            Terms and Conditions
          </Link>{" "}
          and {" "}
          <Link
            href="/privacy"
            className="font-medium underline underline-offset-4 transition-colors hover:text-primary"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default SignInPage;
