"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
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

export function HomeUiStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProviderState>(() => ({
    ...defaultHomeUiState,
    ...parseHomeUiStateFromSearch(
      typeof window !== "undefined" ? window.location.search : ""
    ),
    randomSeed: 0,
  }));

  const replaceHomeUrl = useCallback((nextState: HomeUiState) => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/") return;

    const nextUrl = buildHomeUrl(nextState);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, []);

  const updateState = useCallback((updater: (prev: ProviderState) => ProviderState) => {
    setState((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      replaceHomeUrl(next);
      return next;
    });
  }, [replaceHomeUrl]);

  const setView = useCallback((view: HomeUiView) => {
    updateState((prev) => {
      if (view === prev.view) return prev;
      if (view === "grid") return { ...prev, view, clipId: null };
      return { ...prev, view };
    });
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
        prev.surah === filters.surah &&
        prev.start === filters.start &&
        prev.end === filters.end &&
        prev.reciter === filters.reciter &&
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
        prev.surah == null &&
        prev.start == null &&
        prev.end == null &&
        prev.reciter == null &&
        prev.riwayah == null &&
        prev.translation == null
      ) {
        return prev;
      }
      return {
        ...prev,
        surah: null,
        start: null,
        end: null,
        reciter: null,
        riwayah: null,
        translation: null,
      };
    });
  }, [updateState]);

  const openReel = useCallback((clipId: string) => {
    updateState((prev) => {
      if (prev.view === "reel" && prev.clipId === clipId) return prev;
      return { ...prev, view: "reel", clipId };
    });
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
