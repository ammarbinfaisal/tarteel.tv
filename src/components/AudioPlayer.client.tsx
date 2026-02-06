"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import Hls from "hls.js";

function isProbablyMp4(urlOrKey: string) {
  try {
    const u = new URL(urlOrKey);
    return u.pathname.toLowerCase().endsWith(".mp4");
  } catch {
    return urlOrKey.toLowerCase().split("?")[0].endsWith(".mp4");
  }
}

function isHls(urlOrKey: string) {
  try {
    const u = new URL(urlOrKey);
    return u.pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return urlOrKey.toLowerCase().split("?")[0].endsWith(".m3u8");
  }
}

function pickInitialQuality(variants: ClipVariant[]): ClipQuality {
  // Prefer HLS for automatic adaptive streaming if available
  const hasHls = variants.some((v) => v.quality === "hls");
  if (hasHls) return "hls";

  const hasLow = variants.some((v) => v.quality === "low" || v.quality === "1");
  const hasHigh = variants.some((v) => v.quality === "high" || v.quality === "4");
  
  const conn = (navigator as any).connection;
  const effectiveType = typeof conn?.effectiveType === "string" ? conn.effectiveType : null;
  
  if (effectiveType && ["slow-2g", "2g", "3g"].includes(effectiveType)) {
    return (variants.find(v => v.quality === "low")?.quality || variants.find(v => v.quality === "1")?.quality || variants[0].quality) as ClipQuality;
  }
  
  return (variants.find(v => v.quality === "high")?.quality || variants.find(v => v.quality === "4")?.quality || variants[0].quality) as ClipQuality;
}

const QUALITY_LABELS: Record<string, string> = {
  hls: "Auto (ABR)",
  low: "1 (Low)",
  "1": "1 (Low)",
  "2": "2 (Med-Low)",
  "3": "3 (Med-High)",
  high: "4 (High)",
  "4": "4 (High)",
};

const QUALITY_ORDER = ["hls", "low", "1", "2", "3", "high", "4"];

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
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);

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
    if (chosen.url && (isProbablyMp4(chosen.url) || isHls(chosen.url))) return true;
    if (chosen.r2Key && (isProbablyMp4(chosen.r2Key) || isHls(chosen.r2Key))) return true;
    return false;
  }, [chosen]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !src || !isHls(src)) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls({
        capLevelToPlayerSize: true,
      });
      hls.loadSource(src);
      hls.attachMedia(media);
      hlsRef.current = hls;
    } else if (media.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari)
      media.src = src;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  const qualities = useMemo(
    () => 
      Array.from(new Set(variants.map((v) => v.quality)))
        .sort((a, b) => QUALITY_ORDER.indexOf(a) - QUALITY_ORDER.indexOf(b)) as ClipQuality[],
    [variants]
  );

  return (
    <div className="flex flex-col gap-4">
      {!hideInfo && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground text-xs">Quality</Label>
            <Select value={quality} onValueChange={(v) => setQuality(v as ClipQuality)}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue placeholder="Quality" />
              </SelectTrigger>
              <SelectContent>
                {qualities.map((q) => (
                  <SelectItem key={q} value={q}>
                    {QUALITY_LABELS[q] || q.toUpperCase()}
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
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            controls
            preload="metadata"
            playsInline
            className={mode === "clip-page" ? "clip-media" : "w-full rounded-lg shadow-inner bg-black aspect-video"}
            src={isHls(src) ? undefined : (src || undefined)}
          />
        </div>
      ) : (
        <audio 
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          controls 
          preload="metadata" 
          className="w-full" 
          src={isHls(src) ? undefined : (src || undefined)} 
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
