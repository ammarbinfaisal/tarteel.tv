"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ClipQuality, ClipVariant } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

function isProbablyMp4(urlOrKey: string) {
  try {
    const u = new URL(urlOrKey);
    return u.pathname.toLowerCase().endsWith(".mp4");
  } catch {
    return urlOrKey.toLowerCase().split("?")[0].endsWith(".mp4");
  }
}

function pickInitialQuality(variants: ClipVariant[]): ClipQuality {
  const hasLow = variants.some((v) => v.quality === "low");
  const hasHigh = variants.some((v) => v.quality === "high");
  if (!hasLow && hasHigh) return "high";
  if (!hasHigh && hasLow) return "low";

  const conn = (navigator as any).connection;
  const effectiveType = typeof conn?.effectiveType === "string" ? conn.effectiveType : null;
  if (effectiveType && ["slow-2g", "2g", "3g"].includes(effectiveType)) return "low";
  return "high";
}

export default function AudioPlayer({ 
  clipId, 
  variants, 
  hideInfo = false,
  mode = "inline"
}: { 
  clipId: string; 
  variants: ClipVariant[];
  hideInfo?: boolean;
  mode?: "inline" | "clip-page";
}) {
  const [quality, setQuality] = useState<ClipQuality>(() => pickInitialQuality(variants));
  const [stableVhPx, setStableVhPx] = useState<number | null>(null);

  useEffect(() => {
    const setOnce = () => setStableVhPx(window.innerHeight);
    setOnce();
    const onOrientationChange = () => {
      window.setTimeout(setOnce, 200);
    };
    window.addEventListener("orientationchange", onOrientationChange);
    return () => window.removeEventListener("orientationchange", onOrientationChange);
  }, []);

  const chosen = useMemo(() => {
    const exact = variants.find((v) => v.quality === quality);
    return exact ?? variants[0] ?? null;
  }, [quality, variants]);

  const src = useMemo(() => {
    if (!chosen) return "";
    return chosen.url ?? "";
  }, [chosen]);

  const useVideo = useMemo(() => {
    if (!chosen) return false;
    if (chosen.url && isProbablyMp4(chosen.url)) return true;
    if (chosen.r2Key && isProbablyMp4(chosen.r2Key)) return true;
    return false;
  }, [chosen]);

  const qualities = useMemo(
    () => Array.from(new Set(variants.map((v) => v.quality))).sort() as ClipQuality[],
    [variants]
  );

  return (
    <div className="flex flex-col gap-4">
      {!hideInfo && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground text-xs">Quality</Label>
            <Select value={quality} onValueChange={(v) => setQuality(v as ClipQuality)}>
              <SelectTrigger className="h-8 w-24">
                <SelectValue placeholder="Quality" />
              </SelectTrigger>
              <SelectContent>
                {qualities.map((q) => (
                  <SelectItem key={q} value={q}>
                    {q.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {useVideo ? (
        <div
          className={mode === "clip-page" ? "clip-media-frame" : undefined}
          style={
            mode === "clip-page" && stableVhPx
              ? ({ ["--clip-vh" as any]: `${Math.round(stableVhPx * 0.76)}px` } as CSSProperties)
              : undefined
          }
        >
          <video
            controls
            preload="metadata"
            playsInline
            className={mode === "clip-page" ? "clip-media" : "w-full rounded-lg shadow-inner bg-black aspect-video"}
            src={src || undefined}
          />
        </div>
      ) : (
        <audio 
          controls 
          preload="metadata" 
          className="w-full" 
          src={src || undefined} 
        />
      )}

      {!src ? (
        <div className="text-destructive text-xs italic">
          Audio source not available.
        </div>
      ) : null}
    </div>
  );
}
