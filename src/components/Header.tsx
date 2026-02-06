"use client";

import Link from "next/link";
import { ViewModeToggle } from "./ViewModeToggle";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export default function Header() {
  const searchParams = useSearchParams();
  const isReelView = searchParams.get("view") === "reel";

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full transition-all duration-300",
      isReelView 
        ? "bg-transparent border-none text-white" 
        : "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    )}>
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          tarteel.tv
        </Link>
        <div className="flex items-center gap-4">
          <Suspense fallback={<div className="w-20 h-8 bg-muted animate-pulse rounded-md" />}>
            <ViewModeToggle />
          </Suspense>
        </div>
      </div>
    </header>
  );
}