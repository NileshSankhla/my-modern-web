"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import PageShell from "@/components/ui/page-shell";

export default function NotFound() {
  return (
    <PageShell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center animate-in fade-in slide-in-from-bottom-4">
          <h2 className="mb-4 text-3xl font-extrabold">404 — Page Not Found</h2>
          <p className="mb-6 text-muted-foreground">
            We couldn’t find the page you’re looking for.
          </p>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
