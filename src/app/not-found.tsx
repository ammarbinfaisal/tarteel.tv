import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <p className="text-muted-foreground max-w-xs">
        This clip id doesn&apos;t exist in your index or has been removed.
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link href="/">
          Return Home
        </Link>
      </Button>
    </div>
  );
}

