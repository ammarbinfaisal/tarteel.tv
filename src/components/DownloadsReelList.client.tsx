"use client";

import { useMemo, useState } from "react";
import type { Clip } from "@/lib/types";
import ReelPlayer from "@/components/ReelPlayer.client";
import { useSnapReelController } from "@/lib/client/useSnapReelController";

function readClipIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("clipId");
}

function replaceClipIdInUrl(clipId: string) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  params.set("clipId", clipId);
  const query = params.toString();
  window.history.replaceState(window.history.state, "", query ? `?${query}` : window.location.pathname);
}

export default function DownloadsReelList({
  clips,
}: {
  clips: Clip[];
}) {
  const clipIds = useMemo(() => clips.map((clip) => clip.id), [clips]);
  const initialClipId = useMemo(() => readClipIdFromUrl(), []);
  const [isMuted, setIsMuted] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const { containerRef, activeIndex, scrollToNext } = useSnapReelController({
    itemIds: clipIds,
    initialItemId: initialClipId,
    onActiveItemChange: (clipId) => {
      replaceClipIdInUrl(clipId);
    },
  });

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black overflow-y-scroll snap-y snap-mandatory z-30 scrollbar-hide overscroll-contain"
    >
      {clips.map((clip, index) => {
        const isVisible = Math.abs(index - activeIndex) <= 1;
        return (
          <div key={clip.id} data-reel-item data-index={index} className="h-full w-full snap-start snap-always">
            {isVisible ? (
              <ReelPlayer
                clip={clip}
                isActive={index === activeIndex}
                isMuted={isMuted}
                onMuteChange={setIsMuted}
                autoScroll={autoScroll}
                onAutoScrollChange={setAutoScroll}
                onClipEnd={scrollToNext}
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
  );
}
