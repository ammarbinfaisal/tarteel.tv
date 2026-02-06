import ClipList from "@/components/ClipList";
import { FloatingFilters } from "@/components/FloatingFilters";
import { listClips, listReciters, listRiwayat, listTranslations, getClipById, getRelatedClips } from "@/lib/server/clips";
import { searchParamsCache } from "@/lib/searchparams.server";
import { variantToPublicUrl } from "@/lib/server/r2";
import type { Clip, ClipTranslation } from "@/lib/types";
import { Suspense } from "react";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { surah, start, end, reciter, riwayah, translation, view, clipId } = await searchParamsCache.parse(searchParams);
  const translationFilter: ClipTranslation | undefined = translation ?? undefined;

  const [clipsRaw, reciters, riwayat, translations, selectedClipRaw] = await Promise.all([
    listClips({
      surah: surah ?? undefined,
      ayahStart: start ?? undefined,
      ayahEnd: end ?? undefined,
      reciterSlug: reciter ?? undefined,
      riwayah: riwayah ?? undefined,
      translation: translationFilter,
    }),
    listReciters(),
    listRiwayat(),
    listTranslations(),
    clipId && view === "reel" ? getClipById(clipId) : Promise.resolve(null)
  ]);

  let clips: Clip[] = clipsRaw.map(clip => ({
    ...clip,
    variants: clip.variants.map(v => ({
      ...v,
      url: v.url ?? variantToPublicUrl(v) ?? undefined
    }))
  }));

  if (selectedClipRaw && view === "reel") {
    const selectedClip: Clip = {
      ...selectedClipRaw,
      variants: selectedClipRaw.variants.map(v => ({
        ...v,
        url: v.url ?? variantToPublicUrl(v) ?? undefined
      }))
    };

    const otherClips = clips.filter(c => c.id !== selectedClip.id);
    clips = [selectedClip, ...otherClips];

    // If the list is too short, add some related clips
    if (clips.length < 10) {
      const relatedRaw = await getRelatedClips(selectedClipRaw, 20);
      const related = relatedRaw
        .filter(r => !clips.some(c => c.id === r.id))
        .map(clip => ({
          ...clip,
          variants: clip.variants.map(v => ({
            ...v,
            url: v.url ?? variantToPublicUrl(v) ?? undefined
          }))
        }));
      clips = [...clips, ...related];
    }
  }

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
