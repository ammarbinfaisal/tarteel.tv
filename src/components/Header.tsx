"use client";

import Link from "next/link";
import { ViewModeToggle } from "./ViewModeToggle";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PwaInstallButton } from "./PwaInstallButton";
import { useHomeUiState } from "./HomeUiState.client";

export default function Header() {
  const pathname = usePathname();
  const { state, setClipId, setView, resetFilters } = useHomeUiState();
  const isDownloadsReel = pathname === "/downloads/reel";
  const isReelView = (pathname === "/" && state.view === "reel") || isDownloadsReel;
  const homeHref = "/";

  if (isDownloadsReel) return null;

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full transition-all duration-300",
      isReelView 
        ? "border-none text-white bg-gradient-to-b from-black/40 to-transparent backdrop-blur-sm"
        : "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    )}>
      <div className="w-full md:max-w-2xl md:mx-auto px-4 md:px-0 flex h-14 items-center justify-between">
        <Link
          href={homeHref as any}
          className="flex items-center gap-2 font-bold text-lg tracking-tight"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            setView("grid");
            setClipId(null);
            resetFilters();
          }}
        >
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
          <PwaInstallButton
            className={cn(
              isReelView ? "bg-white/10 text-white hover:bg-white/20" : "bg-muted/40"
            )}
          />
          <Suspense fallback={<div className="w-20 h-8 bg-muted animate-pulse rounded-md" />}>
            <ViewModeToggle />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
