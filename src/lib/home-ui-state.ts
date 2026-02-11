import type { Clip, ClipTranslation } from "@/lib/types";

export type HomeUiView = "grid" | "reel";
export type HomeUiSort = "asc" | "desc" | "random";

export type HomeUiFilters = {
  surah: number | null;
  start: number | null;
  end: number | null;
  reciter: string | null;
  riwayah: string | null;
  translation: ClipTranslation | null;
};

export type HomeUiState = HomeUiFilters & {
  view: HomeUiView;
  clipId: string | null;
  sort: HomeUiSort;
};

export const defaultHomeUiState: HomeUiState = {
  surah: null,
  start: null,
  end: null,
  reciter: null,
  riwayah: null,
  translation: null,
  view: "grid",
  clipId: null,
  sort: "asc",
};

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function parseSurah(value: string | null): number | null {
  const n = parsePositiveInt(value);
  if (n == null || n > 114) return null;
  return n;
}

function parseSort(value: string | null): HomeUiSort {
  if (value === "desc" || value === "random") return value;
  return "asc";
}

function getFirstParamValue(
  input: URLSearchParams | SearchParamsRecord,
  key: string,
): string | null {
  if (input instanceof URLSearchParams) {
    return input.get(key);
  }
  const value = input[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseHomeUiStateFromParams(
  params: URLSearchParams | SearchParamsRecord,
): Partial<HomeUiState> {
  const clipId = getFirstParamValue(params, "clipId") || null;
  const view: HomeUiView = getFirstParamValue(params, "view") === "reel" || clipId != null ? "reel" : "grid";

  return {
    surah: parseSurah(getFirstParamValue(params, "surah")),
    start: parsePositiveInt(getFirstParamValue(params, "start")),
    end: parsePositiveInt(getFirstParamValue(params, "end")),
    reciter: getFirstParamValue(params, "reciter"),
    riwayah: getFirstParamValue(params, "riwayah"),
    translation: getFirstParamValue(params, "translation") as ClipTranslation | null,
    view,
    clipId,
    sort: parseSort(getFirstParamValue(params, "sort")),
  };
}

export function parseHomeUiStateFromSearch(search: string): Partial<HomeUiState> {
  return parseHomeUiStateFromParams(new URLSearchParams(search));
}

export function parseHomeUiStateFromSearchParams(searchParams: SearchParamsRecord): Partial<HomeUiState> {
  return parseHomeUiStateFromParams(searchParams);
}

export function buildHomeUrl(state: HomeUiState): string {
  const params = new URLSearchParams();

  if (state.surah != null) params.set("surah", String(state.surah));
  if (state.start != null) params.set("start", String(state.start));
  if (state.end != null) params.set("end", String(state.end));
  if (state.reciter) params.set("reciter", state.reciter);
  if (state.riwayah) params.set("riwayah", state.riwayah);
  if (state.translation) params.set("translation", state.translation);
  if (state.sort && state.sort !== "asc") params.set("sort", state.sort);
  if (state.view === "reel") params.set("view", "reel");
  if (state.view === "reel" && state.clipId) params.set("clipId", state.clipId);

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function filterClips(clips: Clip[], filters: HomeUiFilters, sort: HomeUiSort = "asc"): Clip[] {
  const hasAyahFilter = filters.start != null || filters.end != null;
  const fStart = filters.start ?? (filters.end ?? 1);
  const fEnd = filters.end ?? (filters.start ?? 999);

  const filtered = clips
    .filter((clip) => {
      if (filters.surah != null && clip.surah !== filters.surah) return false;
      if (filters.reciter && clip.reciterSlug !== filters.reciter) return false;
      if (filters.riwayah && clip.riwayah !== filters.riwayah) return false;
      if (filters.translation && clip.translation !== filters.translation) return false;

      if (hasAyahFilter) {
        if (clip.ayahStart > fEnd) return false;
        if (clip.ayahEnd < fStart) return false;
      }

      return true;
    })
    .map((clip) => {
      if (!hasAyahFilter) return clip;
      const isPartial = clip.ayahStart !== fStart || clip.ayahEnd !== fEnd;
      if (clip.isPartial === isPartial) return clip;
      return { ...clip, isPartial };
    });

  if (sort === "desc") {
    return [...filtered].sort((a, b) => {
      if (b.surah !== a.surah) return b.surah - a.surah;
      if (b.ayahStart !== a.ayahStart) return b.ayahStart - a.ayahStart;
      return b.ayahEnd - a.ayahEnd;
    });
  }

  if (sort === "random") {
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // "asc" is the default order from the server (surah asc, ayah asc)
  return filtered;
}
