"use client";

import Link from "next/link";
import { Play, Layers } from "lucide-react";
import type { Clip } from "@/lib/types";
import { getSurahName } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export default function ClipCard({ clip }: { clip: Clip }) {
  const searchParams = useSearchParams();
  const variants = clip.variants;

  const getReelUrl = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "reel");
    params.set("clipId", clip.id);
    return `/?${params.toString()}`;
  };

  const videoUrl = variants.find(v => v.quality === "low")?.url || variants[0]?.url;

  return (
    <Link href={getReelUrl() as any} className="relative block aspect-[4/5] bg-muted group overflow-hidden">
      {videoUrl ? (
        <video
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          loop
          playsInline
          onMouseEnter={(e) => e.currentTarget.play()}
          onMouseLeave={(e) => {
            e.currentTarget.pause();
            e.currentTarget.currentTime = 0;
          }}
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
