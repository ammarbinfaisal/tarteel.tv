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
  const clipIds = useMemo(() => clips.map((clip) => clip.id), [clips]);
  const [isMuted, setIsMuted] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const view = state.view;
  const clipId = state.clipId;
  const { containerRef, activeIndex: safeActiveIndex, scrollToNext } = useSnapReelController({
    itemIds: clipIds,
    initialItemId: clipId,
    onActiveItemChange: (activeId) => {
      if (view !== "reel") return;
      if (activeId === clipId) return;
      setClipId(activeId);
    },
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
            filterButton={index === safeActiveIndex ? filterButton : undefined}
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
