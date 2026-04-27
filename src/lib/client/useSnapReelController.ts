"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { useSyncRef } from "@/hooks/useSyncRef";

type UseSnapReelControllerParams = {
  itemIds: string[];
  initialItemId?: string | null;
  onActiveItemChange?: (itemId: string, index: number) => void;
  lockDurationMs?: number;
  intersectionThreshold?: number;
  /**
   * When set, treats the rendered list as a ring buffer with `headPad` clones
   * before/after a `canonicalLength`-sized body. After a scroll settles inside
   * a clone zone, the controller silently teleports scrollTop back to the
   * canonical-zone equivalent so the user can scroll endlessly in either
   * direction without seeing the jump.
   */
  circular?: { headPad: number; canonicalLength: number } | null;
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
  circular = null,
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

  // Long-lived handlers below capture these via refs. We sync the refs in a
  // post-commit effect (useSyncRef) instead of writing during render — the
  // latter trips react-hooks/refs and is unsafe under React Compiler.
  useSyncRef(onActiveItemChangeRef, onActiveItemChange);

  const itemIdsRef = useRef(itemIds);
  useSyncRef(itemIdsRef, itemIds);
  const lockDurationMsRef = useRef(lockDurationMs);
  useSyncRef(lockDurationMsRef, lockDurationMs);
  const intersectionThresholdRef = useRef(intersectionThreshold);
  useSyncRef(intersectionThresholdRef, intersectionThreshold);
  const initialIndexRef = useRef(initialIndex);
  useSyncRef(initialIndexRef, initialIndex);
  const circularRef = useRef(circular);
  useSyncRef(circularRef, circular);
  const rebindingRef = useRef(false);

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
  useSyncRef(setActiveIndexAndNotifyRef, setActiveIndexAndNotify);

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
  useSyncRef(scrollToIndexRef, scrollToIndex);

  const scrollToNext = useCallback(() => {
    const ids = itemIdsRef.current;
    if (ids.length === 0) return;
    const curr = activeIndexRef.current;
    // With a circular config the rendered list has clones at both ends,
    // so a plain +1 from the canonical-last enters a clone and the
    // scroll-settle rebind below carries us to canonical-first. Without
    // circular config, fall back to a wrap-jump.
    if (circularRef.current) {
      scrollToIndexRef.current(Math.min(ids.length - 1, curr + 1), "smooth");
      return;
    }
    if (curr >= ids.length - 1) {
      scrollToIndexRef.current(0, "auto");
      return;
    }
    scrollToIndexRef.current(curr + 1, "smooth");
  }, []);

  // Derived state: clamp activeIndex when items shrink. Setting state during
  // render is the documented "store info from previous render" pattern. The
  // ref write moves out to a post-commit useSyncRef so we don't trip the
  // react-hooks/refs rule.
  if (itemIds.length > 0 && safeActiveIndex !== activeIndex) {
    setActiveIndex(safeActiveIndex);
    const nextId = itemIds[safeActiveIndex];
    if (nextId) {
      // The microtask runs after this render flushes, so the onActiveItemChange
      // read happens post-commit even though it's scheduled in render. The lint
      // rule can't see that and flags it; the timing is correct.
      // eslint-disable-next-line react-hooks/refs
      queueMicrotask(() => onActiveItemChangeRef.current?.(nextId, safeActiveIndex));
    }
  }
  useSyncRef(activeIndexRef, safeActiveIndex);

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

    // -- Circular rebind on settle (silent teleport from clone zone → canonical zone) --
    const handleScrollEnd = () => {
      if (rebindingRef.current) return;
      const cfg = circularRef.current;
      if (!cfg || cfg.canonicalLength <= 0) return;
      const idx = activeIndexRef.current;
      let teleportTo: number | null = null;
      if (idx < cfg.headPad) teleportTo = idx + cfg.canonicalLength;
      else if (idx >= cfg.headPad + cfg.canonicalLength) teleportTo = idx - cfg.canonicalLength;
      if (teleportTo == null) return;

      const target = container.querySelector(`[data-index="${teleportTo}"]`) as HTMLElement | null;
      if (!target) return;

      rebindingRef.current = true;
      // Direct scrollTop assignment is instantaneous and won't trigger another scrollend.
      container.scrollTop = target.offsetTop;
      activeIndexRef.current = teleportTo;
      setActiveIndex(teleportTo);
      // Clear the guard a tick later so genuine scrolls aren't suppressed.
      queueMicrotask(() => { rebindingRef.current = false; });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("scrollend", handleScrollEnd);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("scrollend", handleScrollEnd);
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
