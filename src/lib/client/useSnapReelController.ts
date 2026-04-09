"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";

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

  // Inline ref syncs — always fresh, no effect needed
  onActiveItemChangeRef.current = onActiveItemChange;

  // Store dynamic values in refs for the mount-time subscriptions
  const itemIdsRef = useRef(itemIds);
  itemIdsRef.current = itemIds;
  const lockDurationMsRef = useRef(lockDurationMs);
  lockDurationMsRef.current = lockDurationMs;
  const intersectionThresholdRef = useRef(intersectionThreshold);
  intersectionThresholdRef.current = intersectionThreshold;
  const initialIndexRef = useRef(initialIndex);
  initialIndexRef.current = initialIndex;

  // Stable callbacks — read everything from refs, never change identity
  const setActiveIndexAndNotify = useCallback(
    (nextIndex: number) => {
      const ids = itemIdsRef.current;
      if (ids.length === 0) return;
      const boundedIndex = Math.max(0, Math.min(ids.length - 1, nextIndex));
      if (activeIndexRef.current === boundedIndex) return;

      activeIndexRef.current = boundedIndex;
      setActiveIndex(boundedIndex);
      const nextId = ids[boundedIndex];
      if (nextId) {
        onActiveItemChangeRef.current?.(nextId, boundedIndex);
      }
    },
    [],
  );

  const setActiveIndexAndNotifyRef = useRef(setActiveIndexAndNotify);
  setActiveIndexAndNotifyRef.current = setActiveIndexAndNotify;

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const container = containerRef.current;
      if (!container) return;
      const ids = itemIdsRef.current;
      const boundedIndex = Math.max(0, Math.min(ids.length - 1, index));
      const target = container.querySelector(`[data-index="${boundedIndex}"]`) as HTMLElement | null;
      target?.scrollIntoView({ behavior });
    },
    [],
  );

  const scrollToIndexRef = useRef(scrollToIndex);
  scrollToIndexRef.current = scrollToIndex;

  const scrollToNext = useCallback(() => {
    const ids = itemIdsRef.current;
    if (ids.length === 0) return;
    scrollToIndexRef.current(activeIndexRef.current + 1, "smooth");
  }, []);

  // Derived state: clamp activeIndex when items shrink
  if (itemIds.length > 0 && safeActiveIndex !== activeIndex) {
    activeIndexRef.current = safeActiveIndex;
    setActiveIndex(safeActiveIndex);
    const nextId = itemIds[safeActiveIndex];
    if (nextId) {
      queueMicrotask(() => onActiveItemChangeRef.current?.(nextId, safeActiveIndex));
    }
  }

  // Single mount effect: wheel handler + IntersectionObserver + initial scroll
  useMountEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // -- Initial scroll sync --
    const syncInitialScroll = () => {
      if (didSyncInitialScroll.current) return;
      const idx = initialIndexRef.current;
      setActiveIndexAndNotifyRef.current(idx);
      if (idx > 0) {
        const target = container.querySelector(`[data-index="${idx}"]`) as HTMLElement | null;
        if (target) {
          container.scrollTop = target.offsetTop;
        }
      }
      didSyncInitialScroll.current = true;
    };

    // -- Wheel handler (reads all values from refs at call-time) --
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
      const ids = itemIdsRef.current;
      const direction = event.deltaY > 0 ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(ids.length - 1, activeIndexRef.current + direction));

      if (nextIndex !== activeIndexRef.current) {
        scrollToIndexRef.current(nextIndex, "smooth");
      }

      if (unlockTimeoutRef.current) {
        clearTimeout(unlockTimeoutRef.current);
      }
      unlockTimeoutRef.current = setTimeout(() => {
        scrollLocked.current = false;
      }, lockDurationMsRef.current);
    };

    // -- IntersectionObserver --
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
        setActiveIndexAndNotifyRef.current(index);
      },
      { root: container, threshold: intersectionThresholdRef.current },
    );

    const observeItems = () => {
      observer.disconnect();
      const children = container.querySelectorAll("[data-reel-item]");
      children.forEach((child) => observer.observe(child));

      // Sync initial scroll once items are present in the DOM
      if (!didSyncInitialScroll.current && children.length > 0) {
        syncInitialScroll();
      }
    };

    observeItems();

    // Re-observe when DOM children change (items added/removed)
    const mutationObserver = new MutationObserver(observeItems);
    mutationObserver.observe(container, { childList: true, subtree: true });

    // -- Touch swipe handler --
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (event: TouchEvent) => {
      if (scrollLocked.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (scrollLocked.current) return;
      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaY = touchStartY - touch.clientY;
      const elapsed = Date.now() - touchStartTime;
      const velocity = Math.abs(deltaY) / Math.max(elapsed, 1);

      // Only trigger on intentional swipes: >60px distance or fast flick (>0.4 px/ms)
      if (Math.abs(deltaY) < 60 && velocity < 0.4) return;

      const ids = itemIdsRef.current;
      const direction = deltaY > 0 ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(ids.length - 1, activeIndexRef.current + direction));

      if (nextIndex !== activeIndexRef.current) {
        scrollLocked.current = true;
        scrollToIndexRef.current(nextIndex, "smooth");

        if (unlockTimeoutRef.current) {
          clearTimeout(unlockTimeoutRef.current);
        }
        unlockTimeoutRef.current = setTimeout(() => {
          scrollLocked.current = false;
        }, lockDurationMsRef.current);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
      observer.disconnect();
      mutationObserver.disconnect();
      if (unlockTimeoutRef.current) {
        clearTimeout(unlockTimeoutRef.current);
        unlockTimeoutRef.current = null;
      }
    };
  });

  return {
    containerRef,
    activeIndex: safeActiveIndex,
    scrollToNext,
    scrollToIndex,
  };
}
