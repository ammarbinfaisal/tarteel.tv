"use client";

import { useMemo, useState, memo } from "react";
import type { Clip } from "@/lib/types";
import ReelPlayer from "./ReelPlayer.client";
import { Filter, WifiOff } from "lucide-react";
import { Button } from "./ui/button";
import dynamic from "next/dynamic";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { HomeUiFilters } from "@/lib/home-ui-state";
import { useHomeUiState } from "./HomeUiState.client";
import { useSnapReelController } from "@/lib/client/useSnapReelController";

const LazyClipFilters = dynamic(() => import("./ClipFilters.client"), {
  ssr: false,
  loading: () => (
    <div className="h-28 rounded-2xl border border-white/10 bg-white/[0.03] animate-pulse" />
  ),
});

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
  filterButton?: React.ReactNode;
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
          isVisible={isVisible}
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

// Number of clips cloned at each end of the rendered list to give scroll-end
// rebind something to land on. The rebind is silent — see useSnapReelController.
const CIRCULAR_PAD = 3;

type RenderedClip = { clip: Clip; key: string; canonicalIndex: number; isClone: boolean };

function ReelListInner({ clips, filterData, filters, onApplyFilters, onResetFilters, isOffline = false }: ReelListProps) {
  const { state, setClipId } = useHomeUiState();
  const [isMuted, setIsMuted] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const view = state.view;
  const clipId = state.clipId;
  const N = clips.length;
  // Need at least 2*PAD+1 distinct clips for the ring buffer to make sense; below that, fall back to a flat list.
  const headPad = N >= CIRCULAR_PAD * 2 + 1 ? CIRCULAR_PAD : 0;

  const renderedClips = useMemo<RenderedClip[]>(() => {
    if (headPad === 0) {
      return clips.map((clip, i) => ({ clip, key: clip.id, canonicalIndex: i, isClone: false }));
    }
    const tailClones: RenderedClip[] = clips.slice(N - headPad).map((clip, i) => ({
      clip, key: `${clip.id}#prepend-${i}`, canonicalIndex: N - headPad + i, isClone: true,
    }));
    const body: RenderedClip[] = clips.map((clip, i) => ({
      clip, key: clip.id, canonicalIndex: i, isClone: false,
    }));
    const headClones: RenderedClip[] = clips.slice(0, headPad).map((clip, i) => ({
      clip, key: `${clip.id}#append-${i}`, canonicalIndex: i, isClone: true,
    }));
    return [...tailClones, ...body, ...headClones];
  }, [clips, headPad, N]);

  const itemIds = useMemo(() => renderedClips.map((r) => r.key), [renderedClips]);

  // Initial scroll target: the canonical-body copy of the URL clipId, never a clone.
  const initialItemId = useMemo(() => {
    if (!clipId) return null;
    const found = renderedClips.find((r) => r.clip.id === clipId && !r.isClone);
    return found?.key ?? null;
  }, [clipId, renderedClips]);

  const { containerRef, activeIndex: activeRenderedIndex, scrollToNext } = useSnapReelController({
    itemIds,
    initialItemId,
    onActiveItemChange: (_activeKey, renderedIndex) => {
      if (view !== "reel") return;
      const item = renderedClips[renderedIndex];
      if (!item) return;
      if (item.clip.id === clipId) return;
      setClipId(item.clip.id);
    },
    circular: headPad > 0 ? { headPad, canonicalLength: N } : null,
  });

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
        {renderedClips.map((rendered, renderedIndex) => (
          <ReelItem
            key={rendered.key}
            clip={rendered.clip}
            index={renderedIndex}
            isActive={renderedIndex === activeRenderedIndex}
            isVisible={Math.abs(renderedIndex - activeRenderedIndex) <= 1}
            isMuted={isMuted}
            onMuteChange={setIsMuted}
            autoScroll={autoScroll}
            onAutoScrollChange={setAutoScroll}
            onClipEnd={scrollToNext}
            filterButton={renderedIndex === activeRenderedIndex ? filterButton : undefined}
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
          {open ? (
            <LazyClipFilters
              reciters={filterData.reciters}
              riwayat={filterData.riwayat}
              translations={filterData.translations}
              value={filters}
              onApplyFilters={onApplyFilters}
              onResetFilters={onResetFilters}
              onApply={() => setOpen(false)}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
