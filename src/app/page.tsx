import HomePage from "@/components/HomePage.client";
import { listClips, listReciters, listRiwayat, listTranslations, getClipById } from "@/lib/server/clips";
import { searchParamsCache } from "@/lib/searchparams.server";
import { variantToPublicUrl } from "@/lib/server/r2";
import type { Clip } from "@/lib/types";
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
  await searchParams;

  const [clipsRaw, reciters, riwayat, translations] = await Promise.all([
    listClips({}),
    listReciters(),
    listRiwayat(),
    listTranslations(),
  ]);

  const clips: Clip[] = clipsRaw.map(clip => ({
    ...clip,
    variants: clip.variants.map(v => ({
      ...v,
      url: v.url ?? variantToPublicUrl(v) ?? undefined
    }))
  }));

  return (
    <HomePage
      clips={clips}
      filterData={{ reciters, riwayat, translations }}
    />
  );
}
