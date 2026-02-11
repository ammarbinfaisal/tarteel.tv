"use client";

import { useMemo } from "react";
import { useOnlineStatus, useDownloadsList } from "@/lib/client/downloads-hooks";
import type { Clip } from "@/lib/types";
import ClipList from "./ClipList";
import { WifiOff } from "lucide-react";
import { useHomeUiState } from "./HomeUiState.client";
import { filterClips, type HomeUiFilters } from "@/lib/home-ui-state";
import { FloatingFilters } from "./FloatingFilters";

interface HomePageProps {
  clips: Clip[];
  filterData: {
    reciters: { slug: string; name: string }[];
    riwayat: string[];
    translations: string[];
  };
}

export default function HomePage({ clips, filterData }: HomePageProps) {
  const { state, setFilters, resetFilters } = useHomeUiState();
  const online = useOnlineStatus();
  const { records } = useDownloadsList();
  const view = state.view;
  const showOfflineMessage = !online && records.length > 0;

  const offlineClips: Clip[] = useMemo(() => {
    if (online || records.length === 0) return [];

    return records.map(record => ({
      id: record.clipId,
      surah: record.surah,
      ayahStart: record.ayahStart,
      ayahEnd: record.ayahEnd,
      reciterName: record.reciterName,
      reciterSlug: record.reciterSlug,
      riwayah: record.riwayah,
      translation: record.translation,
      variants: [
        {
          quality: "offline" as any,
          r2Key: record.r2Key,
          url: record.offlineUrl,
        }
      ]
    }));
  }, [online, records]);

  const filters: HomeUiFilters = useMemo(
    () => ({
      surah: state.surah,
      start: state.start,
      end: state.end,
      reciter: state.reciter,
      riwayah: state.riwayah,
      translation: state.translation,
    }),
    [state.end, state.reciter, state.riwayah, state.start, state.surah, state.translation],
  );

  const filteredOnlineClips = useMemo(() => filterClips(clips, filters), [clips, filters]);

  const displayClips = !online && offlineClips.length > 0 ? offlineClips : filteredOnlineClips;
  const displayCount = displayClips.length;

  return (
    <div className={view === "reel" ? "p-0" : "flex flex-col"}>
      {showOfflineMessage && view !== "reel" && (
        <div className="pt-5 pb-3 px-4 md:px-0 md:max-w-2xl md:mx-auto w-full">
          <div className="rounded-2xl border bg-muted/40 p-4 flex items-start gap-3">
            <WifiOff className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-sm">You&apos;re offline</p>
              <p className="text-sm text-muted-foreground">
                Showing your {offlineClips.length} downloaded clip{offlineClips.length === 1 ? "" : "s"} for offline viewing.
              </p>
            </div>
          </div>
        </div>
      )}

      {view !== "reel" && !showOfflineMessage && (
        <div className="pt-5 pb-3 md:max-w-2xl md:mx-auto w-full px-4 md:px-0">
          <p className="text-muted-foreground text-[10px] uppercase tracking-[0.3em] font-semibold opacity-60">
            {displayCount} recitation{displayCount === 1 ? "" : "s"}
          </p>
        </div>
      )}

      <ClipList
        clips={displayClips}
        view={view}
        filterData={filterData}
        filters={filters}
        onApplyFilters={setFilters}
        onResetFilters={resetFilters}
        isOffline={!online && offlineClips.length > 0}
      />

      {view !== "reel" && (
        <FloatingFilters
          reciters={filterData.reciters}
          riwayat={filterData.riwayat}
          translations={filterData.translations}
          filters={filters}
          onApplyFilters={setFilters}
          onResetFilters={resetFilters}
        />
      )}
    </div>
  );
}
