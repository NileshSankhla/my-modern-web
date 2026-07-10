"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import PageShell from "@/components/ui/page-shell";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center animate-in fade-in slide-in-from-bottom-4">
          <h2 className="mb-4 text-3xl font-extrabold">Something went wrong</h2>
          <p className="mb-6 text-muted-foreground">
            An unexpected error occurred. Try refreshing or come back later.
          </p>
          <div className="flex justify-center">
            <Button onClick={() => reset()}>Try again</Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
