"use client";

import { useState, useCallback, useRef, memo } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { Play, Layers, Flame } from "lucide-react";
import type { Clip } from "@/lib/types";
import { getSurahName, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useHomeUiState } from "@/components/HomeUiState.client";
import { buildHomeUrl } from "@/lib/home-ui-state";
import Link from "next/link";
import { selectThumbnailVariant } from "@/lib/clip-variants";

// Module-level cache: thumbnails that have already been loaded this session.
// Avoids the blur→fade transition on revisits / re-renders.
const loadedThumbnails = new Set<string>();

function ClipCard({ clip, featured = false }: { clip: Clip; featured?: boolean }) {
  const { state, openReel } = useHomeUiState();

  const getReelUrl = () => {
    return buildHomeUrl({
      ...state,
      view: "reel",
      clipId: clip.id,
    });
  };

  const thumbnailUrl = selectThumbnailVariant(clip.variants)?.url;
  const blurSrc = clip.thumbnailBlur;

  const alreadyCached = thumbnailUrl ? loadedThumbnails.has(thumbnailUrl) : false;
  const [thumbLoaded, setThumbLoaded] = useState(alreadyCached);
  const imgRef = useRef<HTMLImageElement>(null);

  const onThumbLoad = useCallback(() => {
    if (thumbnailUrl) loadedThumbnails.add(thumbnailUrl);
    setThumbLoaded(true);
  }, [thumbnailUrl]);

  // Handle SSR hydration race: image may have loaded before React attached onLoad
  useMountEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      onThumbLoad();
    }
  });

  const hasBlur = !!blurSrc;
  const hasThumb = !!thumbnailUrl;
  const showBlurLayer = hasBlur && (!hasThumb || !thumbLoaded);

  return (
    <Link
      href={getReelUrl() as any}
      className={cn(
        "relative block aspect-[4/5] bg-muted group overflow-hidden",
        featured && "col-span-2 row-span-2",
      )}
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 120px" }}
      onClick={(e) => {
        e.preventDefault();
        openReel(clip.id);
      }}
    >
      {/* Blur placeholder – shown immediately, hidden once thumbnail loads */}
      {showBlurLayer && (
        <img
          src={blurSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Full thumbnail – fades in over the blur placeholder */}
      {hasThumb && (
        <img
          ref={imgRef}
          src={thumbnailUrl}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            thumbLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
          onLoad={onThumbLoad}
        />
      )}

      {/* Text fallback when neither blur nor thumbnail is available */}
      {!hasBlur && !hasThumb && (
        <div className="flex flex-col items-center justify-center h-full text-foreground/80 p-2 text-center">
          <span className="text-sm font-semibold leading-tight">
            {getSurahName(clip.surah)}<br/>{clip.ayahStart}-{clip.ayahEnd}
          </span>
          {clip.isPartial && (
            <div className="mt-1.5 flex items-center justify-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Layers className="w-3 h-3" />
              <span>Partial</span>
            </div>
          )}
        </div>
      )}

      <div className="absolute top-2 right-2 text-white/90 drop-shadow-md">
        <Play className={cn("fill-white", featured ? "w-6 h-6" : "w-4 h-4")} />
      </div>

      {featured && (
        <div className="absolute top-2 left-2 pointer-events-none">
          <Badge className="bg-amber-500/90 text-amber-950 border-none text-xs px-2 h-6 backdrop-blur-sm font-semibold gap-1">
            <Flame className="w-3 h-3" />
            Trending
          </Badge>
        </div>
      )}

      {!featured && clip.isPartial && (
        <div className="absolute top-2 left-2 pointer-events-none">
          <Badge variant="secondary" className="bg-black/40 text-white border-none text-xs px-2 h-5 backdrop-blur-sm">
            Partial
          </Badge>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between gap-2">
          <p className="text-white text-xs font-medium truncate">
            {getSurahName(clip.surah)} {clip.ayahStart}-{clip.ayahEnd}
          </p>
          {clip.isPartial && (
            <Layers className="w-3.5 h-3.5 text-white/80 shrink-0" />
          )}
        </div>
      </div>
    </Link>
  );
}

export default memo(ClipCard);
