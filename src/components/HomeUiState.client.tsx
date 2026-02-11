"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const [state, setState] = useState<ProviderState>(() => ({
    ...defaultHomeUiState,
    ...parseHomeUiStateFromSearch(
      typeof window !== "undefined" ? window.location.search : ""
    ),
    randomSeed: 0,
  }));

  useEffect(() => {
    if (pathname !== "/") return;
    const nextUrl = buildHomeUrl(state);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [pathname, state]);

  const setView = useCallback((view: HomeUiView) => {
    setState((prev) => {
      if (view === prev.view) return prev;
      if (view === "grid") return { ...prev, view, clipId: null };
      return { ...prev, view };
    });
  }, []);

  const setClipId = useCallback((clipId: string | null) => {
    setState((prev) => {
      if (prev.clipId === clipId) return prev;
      return { ...prev, clipId };
    });
  }, []);

  const setFilters = useCallback((filters: HomeUiFilters) => {
    setState((prev) => ({ ...prev, ...filters }));
  }, []);

  const resetFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      surah: null,
      start: null,
      end: null,
      reciter: null,
      riwayah: null,
      translation: null,
    }));
  }, []);

  const openReel = useCallback((clipId: string) => {
    setState((prev) => ({ ...prev, view: "reel", clipId }));
  }, []);

  const setSort = useCallback((sort: HomeUiSort) => {
    setState((prev) => {
      if (prev.sort === sort && sort !== "random") return prev;
      return { ...prev, sort, randomSeed: sort === "random" ? prev.randomSeed + 1 : prev.randomSeed };
    });
  }, []);

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
