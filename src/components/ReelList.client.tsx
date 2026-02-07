"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryState } from "nuqs";
import type { Clip } from "@/lib/types";
import ReelPlayer from "./ReelPlayer.client";
import { Filter } from "lucide-react";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import ClipFilters from "./ClipFilters.client";
import { searchParamsParsers } from "@/lib/searchparams";

interface ReelListProps {
  clips: Clip[];
  filterData: {
    reciters: { slug: string; name: string }[];
    riwayat: string[];
    translations: string[];
  };
}

export default function ReelList({ clips, filterData }: ReelListProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [view] = useQueryState("view", searchParamsParsers.view);
  const [clipId, setClipId] = useQueryState("clipId", searchParamsParsers.clipId);
  const scrollLocked = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (scrollLocked.current) {
        e.preventDefault();
        return;
      }

      // Don't interfere with scrollable elements in portals/modals
      const target = e.target as HTMLElement;
      if (!container.contains(target) || document.body.style.overflow === "hidden") {
        return;
      }

      // If we're scrolling inside something that's already scrollable, don't trigger reel scroll
      let current: HTMLElement | null = target;
      while (current && current !== container) {
        const style = window.getComputedStyle(current);
        const isScrollable = (style.overflowY === "auto" || style.overflowY === "scroll") && current.scrollHeight > current.clientHeight;
        if (isScrollable) return;
        current = current.parentElement;
      }

      // Only handle significant vertical scrolls
      if (Math.abs(e.deltaY) < 30) return;

      e.preventDefault();
      scrollLocked.current = true;

      const direction = e.deltaY > 0 ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(clips.length - 1, activeIndex + direction));

      if (nextIndex !== activeIndex) {
        const target = container.querySelector(`[data-index="${nextIndex}"]`) as HTMLElement;
        if (target) {
          target.scrollIntoView({ behavior: "smooth" });
        }
      }

      // Unlock after the smooth scroll is likely to have finished
      setTimeout(() => {
        scrollLocked.current = false;
      }, 600);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [activeIndex, clips]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observerOptions = {
      root: container,
      threshold: 0.6,
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = Number(entry.target.getAttribute("data-index"));
          setActiveIndex(index);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, observerOptions);

    const children = container.querySelectorAll("[data-reel-item]");
    children.forEach((child) => observer.observe(child));

    return () => {
      children.forEach((child) => observer.unobserve(child));
      observer.disconnect();
    };
  }, [clips]);

  useEffect(() => {
    if (view !== "reel") return;
    const activeId = clips[activeIndex]?.id;
    if (!activeId) return;
    if (activeId === clipId) return;
    setClipId(activeId, { history: "replace", shallow: true });
  }, [activeIndex, clipId, clips, setClipId, view]);

  useEffect(() => {
    setActiveIndex(0);
    containerRef.current?.scrollTo({ top: 0 });
  }, [clips]);

  return (
    <>
      <div 
        ref={containerRef}
        className="fixed inset-0 bg-black overflow-y-scroll snap-y snap-mandatory z-30 scrollbar-hide overscroll-contain"
      >
        {clips.map((clip, index) => {
          const isVisible = Math.abs(index - activeIndex) <= 1;
          
          return (
            <div 
              key={clip.id} 
              data-reel-item 
              data-index={index}
              className="h-full w-full snap-start snap-always"
            >
              {isVisible ? (
                <ReelPlayer 
                  clip={clip} 
                  isActive={index === activeIndex} 
                  isMuted={isMuted}
                  onMuteChange={setIsMuted}
                  filterButton={
                    <FilterSheet filterData={filterData} />
                  }
                />
              ) : (
                <div className="h-full w-full bg-black flex items-center justify-center">
                   <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function FilterSheet({ 
  filterData, 
  trigger 
}: { 
  filterData: ReelListProps["filterData"],
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button 
            variant="ghost"
            size="icon" 
            className="h-12 w-12 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <Filter className="h-6 w-6" />
            <span className="sr-only">Filters</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-[32px] border-none bg-background/80 backdrop-blur-2xl px-6">
        <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto mb-6" />
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-bold">Refine Clips</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto h-full pb-24">
          <ClipFilters 
            reciters={filterData.reciters} 
            riwayat={filterData.riwayat} 
            translations={filterData.translations} 
            onApply={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
