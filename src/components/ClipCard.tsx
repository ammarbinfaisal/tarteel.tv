"use client";

import { Play, Layers } from "lucide-react";
import type { Clip } from "@/lib/types";
import { getSurahName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useHomeUiState } from "@/components/HomeUiState.client";
import { buildHomeUrl } from "@/lib/home-ui-state";
import Link from "next/link";

export default function ClipCard({ clip }: { clip: Clip }) {
  const { state, openReel } = useHomeUiState();

  const getReelUrl = () => {
    return buildHomeUrl({
      ...state,
      view: "reel",
      clipId: clip.id,
    });
  };

  // Prefer the smallest variant for a fast first-frame decode
  const videoUrl =
    clip.variants.find((v) => v.quality === "low")?.url ??
    clip.variants.find((v) => v.quality === "high")?.url ??
    clip.variants[0]?.url;

  return (
    <Link
      href={getReelUrl() as any}
      className="relative block aspect-[4/5] bg-muted group overflow-hidden"
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 120px" }}
      onClick={(e) => {
        e.preventDefault();
        openReel(clip.id);
      }}
    >
      {videoUrl ? (
        // Single video with the blur data-URI as poster.
        // Browser shows poster immediately; once it fetches the first frame
        // (preload="metadata") the poster is replaced by the sharp frame.
        // No JS state needed — the browser handles the transition natively.
        <video
          src={videoUrl}
          poster={clip.thumbnailBlur}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : clip.thumbnailBlur ? (
        <img
          src={clip.thumbnailBlur}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-2 text-center">
          <span className="text-[10px] font-medium leading-tight">
            {getSurahName(clip.surah)}<br/>{clip.ayahStart}-{clip.ayahEnd}
          </span>
          {clip.isPartial && (
            <div className="mt-1 flex items-center justify-center gap-1 text-[8px] uppercase tracking-tighter opacity-70">
              <Layers className="w-2 h-2" />
              <span>Partial</span>
            </div>
          )}
        </div>
      )}

      <div className="absolute top-2 right-2 text-white/90 drop-shadow-md">
        <Play className="w-4 h-4 fill-white" />
      </div>

      {clip.isPartial && (
        <div className="absolute top-2 left-2 pointer-events-none">
          <Badge variant="secondary" className="bg-black/40 text-white border-none text-[8px] px-1.5 h-4 backdrop-blur-sm">
            Partial
          </Badge>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between gap-2">
          <p className="text-white text-[10px] font-medium truncate">
            {getSurahName(clip.surah)} {clip.ayahStart}-{clip.ayahEnd}
          </p>
          {clip.isPartial && (
            <Layers className="w-3 h-3 text-white/80 shrink-0" />
          )}
        </div>
      </div>
    </Link>
  );
}
