"use client";

import { useEffect, useRef, useState } from "react";
import type { Clip, ClipVariant } from "@/lib/types";
import { cn, isProbablyMp4, isHls, formatSlug, formatTranslation, getSurahName } from "@/lib/utils";
import { Button } from "./ui/button";
import { Share2, Volume2, VolumeX, Play, Music, Download } from "lucide-react";
import Hls from "hls.js";

interface ReelPlayerProps {
  clip: Clip;
  isActive: boolean;
  isMuted: boolean;
  onMuteChange: (muted: boolean) => void;
  filterButton?: React.ReactNode;
}

export default function ReelPlayer({ clip, isActive, isMuted, onMuteChange, filterButton }: ReelPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const variants = clip.variants;

  // Prefer HLS for Reels if available
  const chosenVariant = variants.find(v => v.quality === "hls") || variants.find(v => v.quality === "high") || variants[0];
  const src = chosenVariant?.url;
  const isVideo = isProbablyMp4(src) || isProbablyMp4(chosenVariant?.r2Key) || isHls(src) || isHls(chosenVariant?.r2Key);

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
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        abrEwmaDefaultEstimate: 5000000, 
        // Be more aggressive with quality switching
        abrBandWidthFactor: 0.9,
        abrBandWidthUpFactor: 0.7,
      });
      hls.loadSource(src);
      hls.attachMedia(media);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isActiveRef.current && media) {
          media.play().catch(() => {
             // Autoplay might be blocked until interaction
          });
        }
      });
    } else if (media.canPlayType("application/vnd.apple.mpegurl")) {
      (media as HTMLVideoElement).src = src;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
              }
            };
          // eslint-disable-next-line react-hooks/exhaustive-deps
          }, [src]);
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    if (isActive) {
      const playPromise = media.play();
      playPromise?.catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        const name = err && typeof err === "object" && "name" in err ? String((err as any).name) : "";
        if (name === "AbortError" || message.includes("interrupted by a call to pause")) return;
        console.warn("Playback failed:", err);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    } else {
      media.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    const media = mediaRef.current;
    if (!media) return;

    if (media.paused) {
      media.play().catch(() => {
        setIsPlaying(false);
      });
      setIsPlaying(true);
    } else {
      media.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMuteChange(!isMuted);
  };

  const handleTimeUpdate = () => {
    const media = mediaRef.current;
    if (!media || !media.duration) return;
    setProgress((media.currentTime / media.duration) * 100);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `Quran Clip: Surah ${clip.surah}:${clip.ayahStart}-${clip.ayahEnd}`,
        text: `Listen to this beautiful recitation by ${clip.reciterName}`,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard!");
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (src) {
      const link = document.createElement('a');
      link.href = src;
      link.download = `quran-clip-${clip.id}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!src) {
    return (
      <div className="relative h-full w-full bg-black flex flex-col items-center justify-center snap-start">
        <div className="text-white/50 flex flex-col items-center gap-2">
          <VolumeX className="w-12 h-12" />
          <p className="text-sm">Source not available</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative h-full w-full bg-black flex items-center justify-center snap-start overflow-hidden group"
      onClick={togglePlay}
    >
      {isVideo ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={isHls(src) ? undefined : src}
          className="h-full w-full object-contain"
          loop
          playsInline
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
        />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
            <Music className="w-12 h-12 text-white/50" />
          </div>
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={isHls(src) ? undefined : src}
            loop
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
          />
        </div>
      )}

      {/* Play/Pause indicator overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none transition-opacity">
          <div className="bg-black/40 p-4 rounded-full backdrop-blur-sm">
            <Play className="w-12 h-12 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-20">
        <div 
          className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(255,255,255,0.8)]" 
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Overlay UI */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
        {/* Top gradient for header contrast */}
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-black/80 via-black/20 to-transparent pointer-events-none" />
        
        {/* Bottom gradient for text contrast */}
        <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

        <div className="flex flex-col justify-end h-full relative z-10 p-6">
          <div className="flex flex-col gap-2 pointer-events-auto max-w-[85%] mb-12">
            {isExpanded ? (
              <div className="flex flex-col gap-1 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-white font-bold text-base drop-shadow-md">
                  {clip.reciterName}
                </p>
                <p className="text-white/90 text-sm drop-shadow-sm leading-snug">
                  {formatSlug(clip.riwayah)} {clip.translation ? `· ${formatTranslation(clip.translation)}` : ""}
                </p>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                  className="text-white/50 hover:text-white text-xs text-left mt-1 font-medium underline underline-offset-4"
                >
                  Show less
                </button>
              </div>
            ) : (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                className="text-white/70 hover:text-white text-left text-lg font-bold leading-none py-1"
                title="Show details"
              >
                ...
              </button>
            )}
            
            <div className="flex items-center gap-2">
               <h2 className="text-[10px] font-medium text-white/50 drop-shadow-lg uppercase tracking-wider">
                  Surah {getSurahName(clip.surah)}:{clip.ayahStart}-{clip.ayahEnd}
               </h2>
               <div className="flex items-center gap-2">
                 <span className="px-1 py-0 rounded bg-white/5 backdrop-blur-md text-[7px] font-bold text-white/30 uppercase tracking-tighter border border-white/5">
                   {clip.variants.some(v => ["hls", "high", "4", "3"].includes(v.quality)) ? "HD" : "SD"}
                 </span>
               </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="absolute right-4 bottom-24 flex flex-col gap-6 pointer-events-auto">
            {filterButton}

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 h-12 w-12 border border-white/10"
              onClick={toggleMute}
            >
              {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 h-12 w-12 border border-white/10"
              onClick={handleDownload}
            >
              <Download className="h-6 w-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 h-12 w-12 border border-white/10"
              onClick={handleShare}
            >
              <Share2 className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
