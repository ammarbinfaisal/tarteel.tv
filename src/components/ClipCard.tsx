"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import type { Clip } from "@/lib/types";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatSlug, formatTranslation } from "@/lib/utils";
import AudioPlayer from "./AudioPlayer.client";

export default function ClipCard({ clip, view }: { clip: Clip, view: "grid" | "reel" }) {
  const qualities = clip.variants.map((v) => v.quality).sort();
  const variants = clip.variants;

  if (view === "reel") {
    return (
      <Card className="overflow-hidden border-none bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">
                Surah {clip.surah} · Ayah {clip.ayahStart}-{clip.ayahEnd}
              </CardTitle>
              <p className="text-muted-foreground text-sm mt-1">
                {formatSlug(clip.reciter)} · {formatSlug(clip.riwayah)}
                {clip.translation ? ` · ${formatTranslation(clip.translation)}` : null}
              </p>
            </div>
            <Link href={`/clips/${clip.id}`}>
              <Badge variant="outline" className="hover:bg-accent transition-colors">
                View Page
              </Badge>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <AudioPlayer clipId={clip.id} variants={variants} hideInfo />
        </CardContent>
      </Card>
    );
  }

  const videoUrl = variants.find(v => v.quality === "low")?.url || variants[0]?.url;

  return (
    <Link href={`/clips/${clip.id}`} className="relative block aspect-square bg-muted group overflow-hidden">
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
          <span className="text-xs">
            {clip.surah}:{clip.ayahStart}-{clip.ayahEnd}
          </span>
        </div>
      )}
      <div className="absolute top-2 right-2 text-white/90 drop-shadow-md">
        <Play className="w-4 h-4 fill-white" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-white text-[10px] font-medium truncate">
          {clip.surah}:{clip.ayahStart}-{clip.ayahEnd}
        </p>
      </div>
    </Link>
  );
}
