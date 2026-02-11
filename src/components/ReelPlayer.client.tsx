"use client";

import { useEffect, useRef, useState, memo, useCallback } from "react";
import type { Clip } from "@/lib/types";
import { cn, isProbablyMp4, isHls, formatSlug, formatTranslation, getSurahName } from "@/lib/utils";
import { Button } from "./ui/button";
import { Share2, Volume2, VolumeX, Play, Music, Download, MousePointer2, Repeat, Trash2 } from "lucide-react";
import Hls from "hls.js";
import { trackEvent } from "@/lib/analytics";
import { downloadClipForOffline, removeOfflineDownload } from "@/lib/client/downloads";
import { useDownloadRecord, useOnlineStatus } from "@/lib/client/downloads-hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  hasHdVariant,
  selectDownloadVariant,
  selectOfflineBaseVariant,
  selectPlaybackVariant,
} from "@/lib/clip-variants";

interface ReelPlayerProps {
  clip: Clip;
  isActive: boolean;
  isMuted: boolean;
  onMuteChange: (muted: boolean) => void;
  autoScroll: boolean;
  onAutoScrollChange: (autoScroll: boolean) => void;
  onClipEnd: () => void;
  filterButton?: React.ReactNode;
}

// --- Progress bar --- only re-renders on progress ticks
const ProgressBar = memo(function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-20">
      <div
        className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(255,255,255,0.8)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
});

// --- Clip info text (expandable) --- stable unless clip or expansion state changes
const ClipInfo = memo(function ClipInfo({ clip, isExpanded, onToggleExpanded }: {
  clip: Clip;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 pointer-events-auto max-w-[85%] mb-2">
      {isExpanded ? (
        <div className="flex flex-col gap-1 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-white font-bold text-base drop-shadow-md">
            {clip.reciterName}
          </p>
          <p className="text-white/90 text-sm drop-shadow-sm leading-snug">
            {formatSlug(clip.riwayah)} {clip.translation ? `· ${formatTranslation(clip.translation)}` : ""}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpanded(); }}
            className="text-white/50 hover:text-white text-xs text-left mt-1 font-medium underline underline-offset-4"
          >
            Show less
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpanded(); }}
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
            {hasHdVariant(clip.variants) ? "HD" : "SD"}
          </span>
        </div>
      </div>
    </div>
  );
});

// --- Action buttons column --- re-renders only when isMuted / autoScroll / offline state changes
const ActionButtons = memo(function ActionButtons({
  clip,
  isMuted,
  onToggleMute,
  autoScroll,
  onAutoScrollChange,
  filterButton,
  onShare,
  onSaveToDevice,
  onToggleOfflineDownload,
  offlineRecord,
  offlineBusy,
  online,
  beside,
}: {
  clip: Clip;
  isMuted: boolean;
  onToggleMute: (e: React.MouseEvent) => void;
  autoScroll: boolean;
  onAutoScrollChange: (v: boolean) => void;
  filterButton?: React.ReactNode;
  onShare: (e: React.MouseEvent) => void;
  onSaveToDevice: (e: React.MouseEvent) => void;
  onToggleOfflineDownload: (e: React.MouseEvent) => void;
  offlineRecord: ReturnType<typeof useDownloadRecord>["record"];
  offlineBusy: boolean;
  online: boolean;
  beside?: boolean;
}) {
  return (
    <div className={beside ? "flex flex-col gap-6 pointer-events-auto justify-end pb-8" : "absolute right-4 bottom-24 flex flex-col gap-6 pointer-events-auto"}>
      {filterButton}

      <div
        className="relative flex flex-col items-center bg-muted/50 backdrop-blur-md rounded-full border border-white/5 p-1 h-[88px] w-12 cursor-pointer transition-colors hover:bg-muted/70"
        onClick={(e) => { e.stopPropagation(); onAutoScrollChange(!autoScroll); }}
        title={autoScroll ? "Auto-scroll enabled" : "Looping enabled"}
      >
        <div
          className={cn(
            "absolute left-1 w-10 h-10 bg-background rounded-full shadow-md transition-transform duration-300 ease-in-out z-0",
            autoScroll ? "translate-y-0" : "translate-y-10"
          )}
        />
        <div className={cn(
          "relative z-10 flex items-center justify-center w-10 h-10 transition-colors duration-200",
          autoScroll ? "text-foreground" : "text-muted-foreground/60"
        )}>
          <MousePointer2 className="h-5 w-5" />
        </div>
        <div className={cn(
          "relative z-10 flex items-center justify-center w-10 h-10 transition-colors duration-200",
          !autoScroll ? "text-foreground" : "text-muted-foreground/60"
        )}>
          <Repeat className="h-5 w-5" />
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="rounded-full bg-muted/50 backdrop-blur-md text-foreground hover:bg-muted/70 h-12 w-12 border border-white/5"
        onClick={onToggleMute}
      >
        {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-muted/50 backdrop-blur-md text-foreground hover:bg-muted/70 h-12 w-12 border border-white/5"
            onClick={(e) => e.stopPropagation()}
            title="Download options"
          >
            <Download className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="left" className="bg-popover/80 backdrop-blur-md border-white/10">
          <DropdownMenuItem onClick={onToggleOfflineDownload} disabled={offlineBusy || (!online && !offlineRecord)}>
            {offlineBusy ? (
              <div className="w-4 h-4 border-2 border-current/20 border-t-current/80 rounded-full animate-spin" />
            ) : offlineRecord ? (
              <Trash2 />
            ) : (
              <Download />
            )}
            {offlineRecord ? "Remove offline download" : "Download for offline"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSaveToDevice}>
            <Download />
            Save file to device
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        className="rounded-full bg-muted/50 backdrop-blur-md text-foreground hover:bg-muted/70 h-12 w-12 border border-white/5"
        onClick={onShare}
      >
        <Share2 className="h-6 w-6" />
      </Button>
    </div>
  );
});

// --- Overlay (gradients + clip info + action buttons) ---
// Does NOT depend on progress, so it won't re-render on every timeupdate tick.
const ReelOverlay = memo(function ReelOverlay({
  clip,
  isMuted,
  onToggleMute,
  autoScroll,
  onAutoScrollChange,
  filterButton,
  onShare,
  onSaveToDevice,
  onToggleOfflineDownload,
  offlineRecord,
  offlineBusy,
  online,
}: {
  clip: Clip;
  isMuted: boolean;
  onToggleMute: (e: React.MouseEvent) => void;
  autoScroll: boolean;
  onAutoScrollChange: (v: boolean) => void;
  filterButton?: React.ReactNode;
  onShare: (e: React.MouseEvent) => void;
  onSaveToDevice: (e: React.MouseEvent) => void;
  onToggleOfflineDownload: (e: React.MouseEvent) => void;
  offlineRecord: ReturnType<typeof useDownloadRecord>["record"];
  offlineBusy: boolean;
  online: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const handleToggleExpanded = () => setIsExpanded((v) => !v);

  return (
    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
      {/* Top gradient */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-black/80 via-black/20 to-transparent pointer-events-none" />
      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

      <div className="flex flex-col justify-end h-full relative z-10 p-6">
        <ClipInfo clip={clip} isExpanded={isExpanded} onToggleExpanded={handleToggleExpanded} />
        {/* On small screens the buttons overlap the video; hidden on lg+ where they appear beside */}
        <div className="lg:hidden">
          <ActionButtons
            clip={clip}
            isMuted={isMuted}
            onToggleMute={onToggleMute}
            autoScroll={autoScroll}
            onAutoScrollChange={onAutoScrollChange}
            filterButton={filterButton}
            onShare={onShare}
            onSaveToDevice={onSaveToDevice}
            onToggleOfflineDownload={onToggleOfflineDownload}
            offlineRecord={offlineRecord}
            offlineBusy={offlineBusy}
            online={online}
          />
        </div>
      </div>
    </div>
  );
});

// --- Beside-video action buttons (wide screens only) ---
const BesideButtons = memo(function BesideButtons({
  clip,
  isMuted,
  onToggleMute,
  autoScroll,
  onAutoScrollChange,
  filterButton,
  onShare,
  onSaveToDevice,
  onToggleOfflineDownload,
  offlineRecord,
  offlineBusy,
  online,
}: {
  clip: Clip;
  isMuted: boolean;
  onToggleMute: (e: React.MouseEvent) => void;
  autoScroll: boolean;
  onAutoScrollChange: (v: boolean) => void;
  filterButton?: React.ReactNode;
  onShare: (e: React.MouseEvent) => void;
  onSaveToDevice: (e: React.MouseEvent) => void;
  onToggleOfflineDownload: (e: React.MouseEvent) => void;
  offlineRecord: ReturnType<typeof useDownloadRecord>["record"];
  offlineBusy: boolean;
  online: boolean;
}) {
  return (
    <div className="hidden lg:flex flex-col justify-end pb-8 pl-4 pointer-events-auto shrink-0">
      <ActionButtons
        clip={clip}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        autoScroll={autoScroll}
        onAutoScrollChange={onAutoScrollChange}
        filterButton={filterButton}
        onShare={onShare}
        onSaveToDevice={onSaveToDevice}
        onToggleOfflineDownload={onToggleOfflineDownload}
        offlineRecord={offlineRecord}
        offlineBusy={offlineBusy}
        online={online}
        beside
      />
    </div>
  );
});

export default function ReelPlayer({
  clip,
  isActive,
  isMuted,
  onMuteChange,
  autoScroll,
  onAutoScrollChange,
  onClipEnd,
  filterButton
}: ReelPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const isActiveRef = useRef(isActive);
  const online = useOnlineStatus();
  const { record: offlineRecord } = useDownloadRecord(clip.id);
  const [offlineBusy, setOfflineBusy] = useState(false);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const variants = clip.variants;

  // Prefer HLS for Reels if available
  let chosenVariant = selectPlaybackVariant(variants);
  if (!online && offlineRecord?.offlineUrl) {
    const offlineBase = selectOfflineBaseVariant(variants) ?? chosenVariant;
    if (offlineBase) {
      chosenVariant = { ...offlineBase, url: offlineRecord.offlineUrl };
    }
  }

  const src = chosenVariant?.url;
  const isVideo = isProbablyMp4(src) || isProbablyMp4(chosenVariant?.r2Key) || isHls(src) || isHls(chosenVariant?.r2Key);

  const handleMediaPlay = useCallback(() => setIsPlaying(true), []);
  const handleMediaPause = useCallback(() => setIsPlaying(false), []);

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
  }, [src]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    if (isActive) {
      trackEvent('clip_play', {
        clip_id: clip.id,
        surah_num: clip.surah,
        surah_name: getSurahName(clip.surah),
        reciter_name: clip.reciterName,
        reciter_slug: clip.reciterSlug,
      });

      const playPromise = media.play();
      playPromise?.catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        const name = err && typeof err === "object" && "name" in err ? String((err as any).name) : "";
        if (name === "AbortError" || message.includes("interrupted by a call to pause")) return;
        console.warn("Playback failed:", err);
      });
    } else {
      media.pause();
    }
  }, [isActive, clip.id, clip.surah, clip.reciterName, clip.reciterSlug]);

  const togglePlay = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) {
      media.play().catch(() => {});
    } else {
      media.pause();
    }
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onMuteChange(!isMuted);
  }, [isMuted, onMuteChange]);

  const handleTimeUpdate = useCallback(() => {
    const media = mediaRef.current;
    if (!media || !media.duration) return;
    setProgress((media.currentTime / media.duration) * 100);
  }, []);

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    trackEvent('clip_share', {
      clip_id: clip.id,
      surah_num: clip.surah,
      surah_name: getSurahName(clip.surah),
      reciter_name: clip.reciterName,
      reciter_slug: clip.reciterSlug,
    });
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
  }, [clip]);

  const handleSaveToDevice = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    trackEvent('clip_download', {
      clip_id: clip.id,
      surah_num: clip.surah,
      surah_name: getSurahName(clip.surah),
      reciter_name: clip.reciterName,
      reciter_slug: clip.reciterSlug,
      download_type: "file",
    });
    const downloadVariant = selectDownloadVariant(variants);
    const downloadUrl = downloadVariant?.url;
    if (downloadUrl) {
      toast.success("Download started", {
        description: `Saving ${getSurahName(clip.surah)}:${clip.ayahStart}-${clip.ayahEnd}`,
      });
      const link = document.createElement('a');
      link.href = downloadUrl;
      const ext = downloadVariant?.r2Key?.toLowerCase().endsWith(".mp3") ? "mp3" : "mp4";
      link.download = `quran-clip-${clip.id}.${ext}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [clip, variants]);

  const handleToggleOfflineDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setOfflineBusy(true);
      if (offlineRecord) {
        await removeOfflineDownload(clip.id);
        toast.success("Offline download removed");
        return;
      }
      if (!online) {
        toast.error("You are offline", {
          description: "Go online to download this clip.",
        });
        return;
      }
      trackEvent("clip_download", {
        clip_id: clip.id,
        surah_num: clip.surah,
        surah_name: getSurahName(clip.surah),
        reciter_name: clip.reciterName,
        reciter_slug: clip.reciterSlug,
        download_type: "offline",
      });
      toast.success("Download started", {
        description: `Downloading ${getSurahName(clip.surah)}:${clip.ayahStart}-${clip.ayahEnd} for offline`,
      });
      await downloadClipForOffline(clip);
      toast.success("Download complete", {
        description: "Clip is now available offline",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Download failed", { description: message });
    } finally {
      setOfflineBusy(false);
    }
  }, [clip, offlineRecord, online]);

  const handleEnded = useCallback(() => {
    if (autoScroll) onClipEnd();
  }, [autoScroll, onClipEnd]);

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

  const sharedButtonProps = {
    clip,
    isMuted,
    onToggleMute: toggleMute,
    autoScroll,
    onAutoScrollChange,
    filterButton,
    onShare: handleShare,
    onSaveToDevice: handleSaveToDevice,
    onToggleOfflineDownload: handleToggleOfflineDownload,
    offlineRecord,
    offlineBusy,
    online,
  };

  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center snap-start overflow-hidden group">
      {!online && (
        <div className="absolute top-4 right-4 z-30 pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-black/40 text-white text-xs backdrop-blur-md border border-white/10">
            Offline{offlineRecord ? "" : " · not downloaded"}
          </div>
        </div>
      )}

      {/* On large screens: video constrained to portrait column + buttons beside it */}
      <div className="h-full w-full flex items-center justify-center">
        {/* Video column — portrait aspect on lg+, full bleed on small */}
        <div
          className="relative h-full aspect-[9/16] max-w-full lg:max-w-[calc(100vh*9/16)] shrink-0"
          onClick={togglePlay}
        >
          {isVideo ? (
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={isHls(src) ? undefined : src}
              className="h-full w-full object-contain"
              loop={!autoScroll}
              playsInline
              muted={isMuted}
              onPlay={handleMediaPlay}
              onPause={handleMediaPause}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
                <Music className="w-12 h-12 text-white/50" />
              </div>
              <audio
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                src={isHls(src) ? undefined : src}
                loop={!autoScroll}
                muted={isMuted}
                onPlay={handleMediaPlay}
                onPause={handleMediaPause}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
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

          <ProgressBar progress={progress} />

          <ReelOverlay {...sharedButtonProps} />
        </div>

        {/* Buttons beside the video — only on large screens */}
        <BesideButtons {...sharedButtonProps} />
      </div>
    </div>
  );
}
