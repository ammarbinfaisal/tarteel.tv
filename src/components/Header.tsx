"use client";

import Link from "next/link";
import { ViewModeToggle } from "./ViewModeToggle";
import { Suspense } from "react";
import { useQueryStates } from "nuqs";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { searchParamsParsers, serialize } from "@/lib/searchparams";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const [query] = useQueryStates(searchParamsParsers);
  const isDownloadsReel = pathname === "/downloads/reel";
  const isReelView = query.view === "reel" || isDownloadsReel;
  const homeHref = serialize("/", { ...query, view: "grid", clipId: null });

  if (isDownloadsReel) return null;

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full transition-all duration-300",
      isReelView 
        ? "bg-transparent border-none text-white" 
        : "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    )}>
      <div className="container flex h-14 items-center justify-between">
        <Link href={homeHref as any} className="flex items-center gap-2 font-bold text-lg tracking-tight">
          tarteel.tv
        </Link>
        <div className="flex items-center gap-4">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full",
              isReelView ? "bg-white/10 text-white hover:bg-white/20" : "bg-muted/40"
            )}
          >
            <Link href="/downloads" aria-label="Downloads">
              <Download className="h-5 w-5" />
            </Link>
          </Button>
          <Suspense fallback={<div className="w-20 h-8 bg-muted animate-pulse rounded-md" />}>
            <ViewModeToggle />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
