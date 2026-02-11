"use client";

import { useEffect, useMemo, useRef, useState, memo } from "react";
import type { Clip } from "@/lib/types";
import ReelPlayer from "./ReelPlayer.client";
import { Filter, WifiOff } from "lucide-react";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import ClipFilters from "./ClipFilters.client";
import type { HomeUiFilters } from "@/lib/home-ui-state";
import { useHomeUiState } from "./HomeUiState.client";

interface ReelListProps {
  clips: Clip[];
  filterData: {
    reciters: { slug: string; name: string }[];
    riwayat: string[];
    translations: string[];
  };
  filters: HomeUiFilters;
  onApplyFilters: (next: HomeUiFilters) => void;
  onResetFilters: () => void;
  isOffline?: boolean;
}

const ReelItem = memo(function ReelItem({
  clip,
  index,
  isActive,
  isVisible,
  isMuted,
  onMuteChange,
  autoScroll,
  onAutoScrollChange,
  onClipEnd,
  filterButton,
}: {
  clip: Clip;
  index: number;
  isActive: boolean;
  isVisible: boolean;
  isMuted: boolean;
  onMuteChange: (muted: boolean) => void;
  autoScroll: boolean;
  onAutoScrollChange: (v: boolean) => void;
  onClipEnd: () => void;
  filterButton: React.ReactNode;
}) {
  return (
    <div
      data-reel-item
      data-index={index}
      className="h-full w-full snap-start snap-always"
    >
      {isVisible ? (
        <ReelPlayer
          clip={clip}
          isActive={isActive}
          isMuted={isMuted}
          onMuteChange={onMuteChange}
          autoScroll={autoScroll}
          onAutoScrollChange={onAutoScrollChange}
          onClipEnd={onClipEnd}
          filterButton={filterButton}
        />
      ) : (
        <div className="h-full w-full bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
});

function ReelListInner({ clips, filterData, filters, onApplyFilters, onResetFilters, isOffline = false }: ReelListProps) {
  const { state, setClipId } = useHomeUiState();
  const initialIndex = (() => {
    if (!state.clipId) return 0;
    const idx = clips.findIndex((c) => c.id === state.clipId);
    return idx >= 0 ? idx : 0;
  })();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isMuted, setIsMuted] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollLocked = useRef(false);
  const initialScrollDone = useRef(false);
  const view = state.view;
  const clipId = state.clipId;
  const maxIndex = Math.max(0, clips.length - 1);
  const safeActiveIndex = Math.min(activeIndex, maxIndex);

  const scrollToNext = () => {
    const container = containerRef.current;
    if (!container) return;
    
    const nextIndex = safeActiveIndex + 1;
    if (nextIndex < clips.length) {
      const target = container.querySelector(`[data-index="${nextIndex}"]`) as HTMLElement;
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

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
      const nextIndex = Math.max(0, Math.min(clips.length - 1, safeActiveIndex + direction));

      if (nextIndex !== safeActiveIndex) {
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
  }, [clips.length, safeActiveIndex]);

  // Instantly scroll to the initial clip on mount (before IntersectionObserver fires)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || initialIndex === 0) {
      initialScrollDone.current = true;
      return;
    }
    const target = container.querySelector(`[data-index="${initialIndex}"]`) as HTMLElement;
    if (target) {
      container.scrollTop = target.offsetTop;
    }
    initialScrollDone.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observerOptions = {
      root: container,
      threshold: 0.6,
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      if (!initialScrollDone.current) return;
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
    const activeId = clips[safeActiveIndex]?.id;
    if (!activeId) return;
    if (activeId === clipId) return;
    setClipId(activeId);
  }, [clipId, clips, safeActiveIndex, setClipId, view]);

  const filterButton = useMemo(() => (
    <FilterSheet
      filterData={filterData}
      filters={filters}
      onApplyFilters={onApplyFilters}
      onResetFilters={onResetFilters}
    />
  ), [filterData, filters, onApplyFilters, onResetFilters]);

  return (
    <>
      {isOffline && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="px-4 py-2 rounded-full bg-black/60 text-white text-sm backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-lg">
            <WifiOff className="w-4 h-4" />
            <span>You&apos;re offline · Showing {clips.length} downloaded clip{clips.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="fixed inset-0 bg-black overflow-y-scroll snap-y snap-mandatory z-30 scrollbar-hide overscroll-contain"
      >
        {clips.map((clip, index) => (
          <ReelItem
            key={clip.id}
            clip={clip}
            index={index}
            isActive={index === safeActiveIndex}
            isVisible={Math.abs(index - safeActiveIndex) <= 1}
            isMuted={isMuted}
            onMuteChange={setIsMuted}
            autoScroll={autoScroll}
            onAutoScrollChange={setAutoScroll}
            onClipEnd={scrollToNext}
            filterButton={filterButton}
          />
        ))}
      </div>
    </>
  );
}

export default function ReelList(props: ReelListProps) {
  return <ReelListInner {...props} />;
}

export function FilterSheet({ 
  filterData, 
  filters,
  onApplyFilters,
  onResetFilters,
  trigger 
}: { 
  filterData: ReelListProps["filterData"],
  filters: HomeUiFilters,
  onApplyFilters: (next: HomeUiFilters) => void,
  onResetFilters: () => void,
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button 
            data-testid="filters-open"
            variant="ghost"
            size="icon" 
            className="h-12 w-12 rounded-full bg-muted/50 backdrop-blur-md text-foreground hover:bg-muted/70 border border-white/5"
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
            value={filters}
            onApplyFilters={onApplyFilters}
            onResetFilters={onResetFilters}
            onApply={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
