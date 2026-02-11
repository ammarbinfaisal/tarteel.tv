"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UseSnapReelControllerParams = {
  itemIds: string[];
  initialItemId?: string | null;
  onActiveItemChange?: (itemId: string, index: number) => void;
  lockDurationMs?: number;
  intersectionThreshold?: number;
};

function findInitialIndex(itemIds: string[], initialItemId?: string | null): number {
  if (!initialItemId) return 0;
  const index = itemIds.findIndex((itemId) => itemId === initialItemId);
  return index >= 0 ? index : 0;
}

export function useSnapReelController({
  itemIds,
  initialItemId,
  onActiveItemChange,
  lockDurationMs = 600,
  intersectionThreshold = 0.6,
}: UseSnapReelControllerParams) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollLocked = useRef(false);
  const didSyncInitialScroll = useRef(false);
  const onActiveItemChangeRef = useRef(onActiveItemChange);
  const unlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialIndex = useMemo(
    () => findInitialIndex(itemIds, initialItemId),
    [initialItemId, itemIds],
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeIndexRef = useRef(activeIndex);
  const maxIndex = Math.max(0, itemIds.length - 1);
  const safeActiveIndex = Math.min(activeIndex, maxIndex);

  useEffect(() => {
    onActiveItemChangeRef.current = onActiveItemChange;
  }, [onActiveItemChange]);

  const setActiveIndexAndNotify = useCallback(
    (nextIndex: number) => {
      if (itemIds.length === 0) return;
      const boundedIndex = Math.max(0, Math.min(itemIds.length - 1, nextIndex));
      if (activeIndexRef.current === boundedIndex) return;

      activeIndexRef.current = boundedIndex;
      setActiveIndex(boundedIndex);
      const nextId = itemIds[boundedIndex];
      if (nextId) {
        onActiveItemChangeRef.current?.(nextId, boundedIndex);
      }
    },
    [itemIds],
  );

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const container = containerRef.current;
      if (!container) return;
      const boundedIndex = Math.max(0, Math.min(itemIds.length - 1, index));
      const target = container.querySelector(`[data-index="${boundedIndex}"]`) as HTMLElement | null;
      target?.scrollIntoView({ behavior });
    },
    [itemIds.length],
  );

  const scrollToNext = useCallback(() => {
    if (itemIds.length === 0) return;
    scrollToIndex(safeActiveIndex + 1, "smooth");
  }, [itemIds.length, safeActiveIndex, scrollToIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setActiveIndexAndNotify(initialIndex);

    if (initialIndex > 0) {
      const target = container.querySelector(`[data-index="${initialIndex}"]`) as HTMLElement | null;
      if (target) {
        container.scrollTop = target.offsetTop;
      }
    }
    didSyncInitialScroll.current = true;
  }, [initialIndex, setActiveIndexAndNotify]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      if (scrollLocked.current) {
        event.preventDefault();
        return;
      }

      const target = event.target as HTMLElement;
      if (!container.contains(target) || document.body.style.overflow === "hidden") {
        return;
      }

      let currentElement: HTMLElement | null = target;
      while (currentElement && currentElement !== container) {
        const style = window.getComputedStyle(currentElement);
        const isScrollable =
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          currentElement.scrollHeight > currentElement.clientHeight;
        if (isScrollable) return;
        currentElement = currentElement.parentElement;
      }

      if (Math.abs(event.deltaY) < 30) return;

      event.preventDefault();
      scrollLocked.current = true;
      const direction = event.deltaY > 0 ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(itemIds.length - 1, activeIndexRef.current + direction));

      if (nextIndex !== activeIndexRef.current) {
        scrollToIndex(nextIndex, "smooth");
      }

      if (unlockTimeoutRef.current) {
        clearTimeout(unlockTimeoutRef.current);
      }
      unlockTimeoutRef.current = setTimeout(() => {
        scrollLocked.current = false;
      }, lockDurationMs);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (unlockTimeoutRef.current) {
        clearTimeout(unlockTimeoutRef.current);
        unlockTimeoutRef.current = null;
      }
    };
  }, [itemIds.length, lockDurationMs, scrollToIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!didSyncInitialScroll.current) return;

        let bestEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
            bestEntry = entry;
          }
        }
        if (!bestEntry) return;

        const index = Number(bestEntry.target.getAttribute("data-index"));
        if (Number.isNaN(index)) return;
        setActiveIndexAndNotify(index);
      },
      { root: container, threshold: intersectionThreshold },
    );

    const children = container.querySelectorAll("[data-reel-item]");
    children.forEach((child) => observer.observe(child));

    return () => {
      children.forEach((child) => observer.unobserve(child));
      observer.disconnect();
    };
  }, [intersectionThreshold, setActiveIndexAndNotify, itemIds]);

  useEffect(() => {
    if (itemIds.length === 0) return;
    if (safeActiveIndex !== activeIndex) {
      setActiveIndexAndNotify(safeActiveIndex);
    }
  }, [activeIndex, itemIds.length, safeActiveIndex, setActiveIndexAndNotify]);

  return {
    containerRef,
    activeIndex: safeActiveIndex,
    scrollToNext,
    scrollToIndex,
  };
}
