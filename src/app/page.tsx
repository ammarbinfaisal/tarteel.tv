import ClipList from "@/components/ClipList";
import { FloatingFilters } from "@/components/FloatingFilters";
import { listClips, listReciters, listRiwayat, listTranslations } from "@/lib/server/clips";
import { variantToPublicUrl } from "@/lib/server/r2";
import type { ClipTranslation } from "@/lib/types";
import { Suspense } from "react";

type SearchParams = Record<string, string | string[] | undefined>;

function first(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function toInt(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n)) return undefined;
  return n;
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const surah = toInt(first(sp, "surah"));
  const ayahStart = toInt(first(sp, "start"));
  const ayahEnd = toInt(first(sp, "end"));
  const reciterSlug = first(sp, "reciter");
  const riwayah = first(sp, "riwayah");
  const rawTranslation = first(sp, "translation");
  const translation: ClipTranslation | undefined =
    rawTranslation === "saheeh-international" || rawTranslation === "khan-al-hilali"
      ? (rawTranslation as ClipTranslation)
      : undefined;

  const [clipsRaw, reciters, riwayat, translations] = await Promise.all([
    listClips({ surah, ayahStart, ayahEnd, reciterSlug: reciterSlug ?? undefined, riwayah, translation }),
    listReciters(),
    listRiwayat(),
    listTranslations()
  ]);

  const clips = clipsRaw.map(clip => ({
    ...clip,
    variants: clip.variants.map(v => ({
      ...v,
      url: v.url ?? variantToPublicUrl(v) ?? undefined
    }))
  }));

  const view = first(sp, "view") === "reel" ? "reel" : "grid";

  return (
    <div className={view === "reel" ? "p-0" : "py-6 flex flex-col gap-6"}>
      {view !== "reel" && (
        <div className="flex flex-col gap-1 px-2">
          <h1 className="text-2xl font-bold tracking-tight">Quran Recitation Clips</h1>
          <p className="text-muted-foreground text-sm">
            {clips.length} recitation{clips.length === 1 ? "" : "s"} found
          </p>
        </div>
      )}

      <ClipList 
        clips={clips} 
        view={view} 
        filterData={{ reciters, riwayat, translations }}
      />

      {view !== "reel" && (
        <Suspense>
          <FloatingFilters 
            reciters={reciters} 
            riwayat={riwayat} 
            translations={translations} 
          />
        </Suspense>
      )}
    </div>
  );
}
