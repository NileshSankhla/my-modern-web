import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-bold">404 - Page Not Found</h2>
        <p className="mb-6 text-muted-foreground">
          The page you are looking for does not exist.
        </p>
        <Link href="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    </div>
  );
}
