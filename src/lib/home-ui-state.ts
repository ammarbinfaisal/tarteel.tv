import type { Clip, ClipTranslation } from "@/lib/types";

export type HomeUiView = "grid" | "reel";

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
};

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

export function parseHomeUiStateFromSearch(search: string): Partial<HomeUiState> {
  const params = new URLSearchParams(search);
  const view = params.get("view") === "reel" ? "reel" : "grid";
  const clipId = params.get("clipId");

  return {
    surah: parseSurah(params.get("surah")),
    start: parsePositiveInt(params.get("start")),
    end: parsePositiveInt(params.get("end")),
    reciter: params.get("reciter"),
    riwayah: params.get("riwayah"),
    translation: params.get("translation") as ClipTranslation | null,
    view,
    clipId: clipId || null,
  };
}

export function buildHomeUrl(state: HomeUiState): string {
  const params = new URLSearchParams();

  if (state.surah != null) params.set("surah", String(state.surah));
  if (state.start != null) params.set("start", String(state.start));
  if (state.end != null) params.set("end", String(state.end));
  if (state.reciter) params.set("reciter", state.reciter);
  if (state.riwayah) params.set("riwayah", state.riwayah);
  if (state.translation) params.set("translation", state.translation);
  if (state.view === "reel") params.set("view", "reel");
  if (state.view === "reel" && state.clipId) params.set("clipId", state.clipId);

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function filterClips(clips: Clip[], filters: HomeUiFilters): Clip[] {
  const hasAyahFilter = filters.start != null || filters.end != null;
  const fStart = filters.start ?? (filters.end ?? 1);
  const fEnd = filters.end ?? (filters.start ?? 999);

  return clips
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
}
