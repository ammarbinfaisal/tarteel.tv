"use client";

import { useEffect, useRef, useState } from "react";
import type { Clip, ClipVariant } from "@/lib/types";
import { cn, isProbablyMp4, formatSlug, formatTranslation } from "@/lib/utils";
import { Button } from "./ui/button";
import { Share2, ExternalLink, Volume2, VolumeX, Play, Pause, Music, Download } from "lucide-react";
import Link from "next/link";

interface ReelPlayerProps {
  clip: Clip;
  isActive: boolean;
  isMuted: boolean;
  onMuteChange: (muted: boolean) => void;
  filterButton?: React.ReactNode;
}

export default function ReelPlayer({ clip, isActive, isMuted, onMuteChange, filterButton }: ReelPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const variants = clip.variants;

  // Find high quality if available, otherwise any
  const chosenVariant = variants.find(v => v.quality === "high") || variants[0];
  const src = chosenVariant?.url;
  const isVideo = isProbablyMp4(src) || isProbablyMp4(chosenVariant?.r2Key);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    if (isActive) {
      media.play().catch(err => {
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
      media.play();
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
    if (navigator.share) {
      navigator.share({
        title: `Quran Clip: Surah ${clip.surah}:${clip.ayahStart}-${clip.ayahEnd}`,
        text: `Listen to this beautiful recitation by ${clip.reciter}`,
        url: `${window.location.origin}/clips/${clip.id}`,
      });
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/clips/${clip.id}`);
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
          src={src}
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
            src={src}
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
          <div className="flex flex-col gap-3 pointer-events-auto max-w-[85%] mb-12">
            <div className="flex flex-col gap-1">
               <h2 className="text-xl font-bold text-white drop-shadow-lg">
                  Surah {clip.surah}:{clip.ayahStart}-{clip.ayahEnd}
               </h2>
               <div className="flex items-center gap-2">
                 <span className="px-2 py-0.5 rounded bg-white/20 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                   {clip.variants.find(v => v.quality === "high") ? "HD" : "SD"}
                 </span>
               </div>
            </div>
            <p className="text-white font-semibold text-base drop-shadow-md">
              {formatSlug(clip.reciter)}
            </p>
            <p className="text-white/80 text-sm line-clamp-2 drop-shadow-sm leading-relaxed">
              {formatSlug(clip.riwayah)} {clip.translation ? `· ${formatTranslation(clip.translation)}` : ""}
            </p>
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

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 h-12 w-12 border border-white/10"
              asChild
            >
              <Link href={`/clips/${clip.id}`} onClick={(e) => e.stopPropagation()}>
                <ExternalLink className="h-6 w-6" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}