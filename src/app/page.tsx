import { FloatingFilters } from "@/components/FloatingFilters";
import HomePage from "@/components/HomePage.client";
import { listClips, listReciters, listRiwayat, listTranslations, getClipById, getRelatedClips, orderBySimilarity } from "@/lib/server/clips";
import { searchParamsCache } from "@/lib/searchparams.server";
import { variantToPublicUrl } from "@/lib/server/r2";
import type { Clip, ClipTranslation } from "@/lib/types";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getSurahName } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const { clipId } = await searchParamsCache.parse(searchParams);

  if (!clipId) {
    return {};
  }

  try {
    const clip = await getClipById(clipId);

    if (!clip) {
      return {};
    }

    const surahName = getSurahName(clip.surah);
    const title = `${surahName}:${clip.ayahStart}-${clip.ayahEnd} | ${clip.reciterName}`;
    const description = `Listen to this beautiful recitation of Surah ${surahName}, verses ${clip.ayahStart}-${clip.ayahEnd} by ${clip.reciterName}`;

    // Get video URL for Twitter player
    const videoVariant = clip.variants.find(v => ["hls", "high", "4"].includes(v.quality));
    const videoUrl = videoVariant?.url ?? (videoVariant ? variantToPublicUrl(videoVariant) : undefined);

    // Use dedicated OG image route
    const ogImage = `/api/og?clipId=${clipId}`;

    return {
      title,
      description,
      openGraph: {
        type: "video.other",
        title,
        description,
        url: `/?view=reel&clipId=${clipId}`,
        siteName: "tarteel.tv",
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        videos: videoUrl ? [
          {
            url: videoUrl,
            type: "video/mp4",
          }
        ] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
    };
  } catch (error) {
    console.error("Failed to generate metadata for clip:", error);
    return {};
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<div className="p-8 text-center animate-pulse text-muted-foreground">Loading recitations...</div>}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
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

  if (view === "reel") {
    const selectedClip = clipId ? clips.find(c => c.id === clipId) : null;

    if (selectedClip) {
      // Current clip matches filters, keep it at top
      const otherClips = clips.filter(c => c.id !== selectedClip.id);
      const orderedOtherClips = orderBySimilarity(selectedClip, otherClips);
      clips = [selectedClip, ...orderedOtherClips];
    } else if (selectedClipRaw && clips.length > 0) {
      // Current clip does NOT match filters, but we have a reference for similarity
      const orderedClips = orderBySimilarity(selectedClipRaw as any as Clip, clips);
      clips = orderedClips;
    }

    const hasFilters = Boolean(surah || start || end || reciter || riwayah || translation);

    // If the list is too short, add some related clips (only if no active filters)
    if (clips.length > 0 && clips.length < 10 && !hasFilters) {
      const referenceForRelated = selectedClip || selectedClipRaw || clips[0];
      const relatedRaw = await getRelatedClips(referenceForRelated as Clip, 20);
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
    <>
      <HomePage
        clips={clips}
        view={view}
        filterData={{ reciters, riwayat, translations }}
        clipsCount={clips.length}
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
    </>
  );
}
