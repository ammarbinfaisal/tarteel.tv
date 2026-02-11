"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Clip } from "@/lib/types";
import ReelPlayer from "@/components/ReelPlayer.client";

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
  const [activeId, setActiveId] = useState<string | null>(() => readClipIdFromUrl());

  const initialIndex = useMemo(() => {
    if (!activeId) return 0;
    const idx = clips.findIndex((c) => c.id === activeId);
    return idx >= 0 ? idx : 0;
  }, [clips, activeId]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isMuted, setIsMuted] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollLocked = useRef(false);

  useEffect(() => {
    const currentId = clips[activeIndex]?.id;
    if (currentId && currentId !== activeId) {
      replaceClipIdInUrl(currentId);
      setActiveId(currentId);
    }
  }, [activeIndex, clips, activeId]);

  const scrollToNext = () => {
    const container = containerRef.current;
    if (!container) return;

    const nextIndex = activeIndex + 1;
    if (nextIndex < clips.length) {
      const target = container.querySelector(`[data-index="${nextIndex}"]`) as HTMLElement;
      target?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const target = container.querySelector(`[data-index="${initialIndex}"]`) as HTMLElement | null;
    target?.scrollIntoView({ behavior: "auto" });
  }, [initialIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (scrollLocked.current) {
        e.preventDefault();
        return;
      }

      if (Math.abs(e.deltaY) < 30) return;
      e.preventDefault();
      scrollLocked.current = true;

      const direction = e.deltaY > 0 ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(clips.length - 1, activeIndex + direction));
      if (nextIndex !== activeIndex) {
        const target = container.querySelector(`[data-index="${nextIndex}"]`) as HTMLElement;
        target?.scrollIntoView({ behavior: "smooth" });
      }

      setTimeout(() => {
        scrollLocked.current = false;
      }, 600);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [activeIndex, clips.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).getAttribute("data-index"));
            setActiveIndex(index);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );

    const children = container.querySelectorAll("[data-reel-item]");
    children.forEach((child) => observer.observe(child));

    return () => {
      children.forEach((child) => observer.unobserve(child));
      observer.disconnect();
    };
  }, [clips]);

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
