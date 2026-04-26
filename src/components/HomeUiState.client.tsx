"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import {
  buildHomeUrl,
  defaultHomeUiState,
  parseHomeUiStateFromSearch,
  type HomeUiFilters,
  type HomeUiSort,
  type HomeUiState,
  type HomeUiView,
} from "@/lib/home-ui-state";

type ProviderState = HomeUiState & { randomSeed: number };

type HomeUiStateContextValue = {
  state: HomeUiState;
  randomSeed: number;
  setView: (view: HomeUiView) => void;
  setClipId: (clipId: string | null) => void;
  setFilters: (filters: HomeUiFilters) => void;
  resetFilters: () => void;
  openReel: (clipId: string) => void;
  setSort: (sort: HomeUiSort) => void;
};

const HomeUiStateContext = createContext<HomeUiStateContextValue | null>(null);

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function HomeUiStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProviderState>(() => ({
    ...defaultHomeUiState,
    ...parseHomeUiStateFromSearch(
      typeof window !== "undefined" ? window.location.search : ""
    ),
    randomSeed: 0,
  }));

  const syncHomeUrl = useCallback((nextState: HomeUiState, mode: "push" | "replace") => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/") return;

    const nextUrl = buildHomeUrl(nextState);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl === currentUrl) return;

    if (mode === "push") {
      window.history.pushState(window.history.state, "", nextUrl);
    } else {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, []);

  // Sync state from URL on browser back/forward
  useMountEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname !== "/") return;
      const urlState = parseHomeUiStateFromSearch(window.location.search);
      setState((prev) => ({
        ...prev,
        ...defaultHomeUiState,
        ...urlState,
        randomSeed: prev.randomSeed,
      }));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  });

  const updateState = useCallback((updater: (prev: ProviderState) => ProviderState, mode: "push" | "replace" = "replace") => {
    setState((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      syncHomeUrl(next, mode);
      return next;
    });
  }, [syncHomeUrl]);

  const setView = useCallback((view: HomeUiView) => {
    updateState((prev) => {
      if (view === prev.view) return prev;
      if (view === "grid") return { ...prev, view, clipId: null };
      return { ...prev, view };
    }, "push");
  }, [updateState]);

  const setClipId = useCallback((clipId: string | null) => {
    updateState((prev) => {
      if (prev.clipId === clipId) return prev;
      return { ...prev, clipId };
    });
  }, [updateState]);

  const setFilters = useCallback((filters: HomeUiFilters) => {
    updateState((prev) => {
      if (
        arraysEqual(prev.surahs, filters.surahs) &&
        prev.start === filters.start &&
        prev.end === filters.end &&
        arraysEqual(prev.reciters, filters.reciters) &&
        prev.riwayah === filters.riwayah &&
        prev.translation === filters.translation
      ) {
        return prev;
      }
      return { ...prev, ...filters };
    });
  }, [updateState]);

  const resetFilters = useCallback(() => {
    updateState((prev) => {
      if (
        prev.surahs.length === 0 &&
        prev.start == null &&
        prev.end == null &&
        prev.reciters.length === 0 &&
        prev.riwayah == null &&
        prev.translation == null
      ) {
        return prev;
      }
      return {
        ...prev,
        surahs: [],
        start: null,
        end: null,
        reciters: [],
        riwayah: null,
        translation: null,
      };
    });
  }, [updateState]);

  const openReel = useCallback((clipId: string) => {
    updateState((prev) => {
      if (prev.view === "reel" && prev.clipId === clipId) return prev;
      return { ...prev, view: "reel", clipId };
    }, "push");
  }, [updateState]);

  const setSort = useCallback((sort: HomeUiSort) => {
    updateState((prev) => {
      if (prev.sort === sort && sort !== "random") return prev;
      return { ...prev, sort, randomSeed: sort === "random" ? prev.randomSeed + 1 : prev.randomSeed };
    });
  }, [updateState]);

  const value = useMemo<HomeUiStateContextValue>(
    () => ({
      state,
      randomSeed: state.randomSeed,
      setView,
      setClipId,
      setFilters,
      resetFilters,
      openReel,
      setSort,
    }),
    [openReel, resetFilters, setClipId, setFilters, setSort, setView, state],
  );

  return <HomeUiStateContext.Provider value={value}>{children}</HomeUiStateContext.Provider>;
}

export function useHomeUiState() {
  const ctx = useContext(HomeUiStateContext);
  if (!ctx) {
    throw new Error("useHomeUiState must be used within HomeUiStateProvider");
  }
  return ctx;
}
