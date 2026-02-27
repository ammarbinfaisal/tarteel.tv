import HomePage from "@/components/HomePage.client";
import { listClips, listReciters, listRiwayat, listTranslations, getClipById } from "@/lib/server/clips";
import { variantToPublicUrl } from "@/lib/server/r2";
import type { Clip } from "@/lib/types";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getSurahName } from "@/lib/utils";
import { parseHomeUiStateFromSearchParams } from "@/lib/home-ui-state";
import { getVariantMimeType, selectMetadataVideoVariant } from "@/lib/clip-variants";

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const { clipId } = parseHomeUiStateFromSearchParams(await searchParams);

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

    // Get a share-friendly media variant for social previews.
    const videoVariant = selectMetadataVideoVariant(clip.variants);
    const videoUrl = videoVariant?.url ?? (videoVariant ? variantToPublicUrl(videoVariant) : undefined);
    const videoType = videoVariant ? getVariantMimeType(videoVariant) : undefined;

    // Use dedicated OG image route
    const ogImage = `/api/og?clipId=${clipId}`;
    const canonicalUrl = `/?view=reel&clipId=${clipId}`;

    return {
      title,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        type: "video.other",
        title,
        description,
        url: canonicalUrl,
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
            secureUrl: videoUrl,
            type: videoType ?? "video/mp4",
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
  const parsedState = parseHomeUiStateFromSearchParams(await searchParams);

  const [clipsRaw, reciters, riwayat, translations] = await Promise.all([
    listClips({
      surah: parsedState.surah ?? undefined,
      ayahStart: parsedState.start ?? undefined,
      ayahEnd: parsedState.end ?? undefined,
      reciterSlug: parsedState.reciter ?? undefined,
      riwayah: parsedState.riwayah ?? undefined,
      translation: parsedState.translation ?? undefined,
    }),
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

  const jsonLd = await buildJsonLd(parsedState.clipId ?? null, clips);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage
        clips={clips}
        filterData={{ reciters, riwayat, translations }}
      />
    </>
  );
}

async function buildJsonLd(clipId: string | null, clips: Clip[]): Promise<object> {
  if (!clipId) {
    return {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "tarteel.tv",
      "url": "https://tarteel.tv",
      "description": "Clips of Quran Recitations.",
    };
  }

  // Find in already-fetched list first; fall back to a direct DB lookup
  let clip = clips.find(c => c.id === clipId);
  if (!clip) {
    const raw = await getClipById(clipId);
    if (raw) {
      clip = {
        ...raw,
        variants: raw.variants.map(v => ({
          ...v,
          url: v.url ?? variantToPublicUrl(v) ?? undefined,
        })),
      };
    }
  }

  if (!clip) {
    return {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "tarteel.tv",
      "url": "https://tarteel.tv",
      "description": "Clips of Quran Recitations.",
    };
  }

  const surahName = getSurahName(clip.surah);
  const title = `${surahName}:${clip.ayahStart}-${clip.ayahEnd} | ${clip.reciterName}`;
  const description = `Listen to this beautiful recitation of Surah ${surahName}, verses ${clip.ayahStart}-${clip.ayahEnd} by ${clip.reciterName}`;
  const videoVariant = selectMetadataVideoVariant(clip.variants);
  const videoUrl = videoVariant?.url;

  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": title,
    "description": description,
    "thumbnailUrl": `https://tarteel.tv/api/og?clipId=${clip.id}`,
    ...(clip.createdAt && { "uploadDate": clip.createdAt.toISOString() }),
    ...(videoUrl && { "contentUrl": videoUrl }),
    "embedUrl": `https://tarteel.tv/?view=reel&clipId=${clip.id}`,
    "inLanguage": "ar",
    "creator": {
      "@type": "Person",
      "name": clip.reciterName,
    },
    "publisher": {
      "@type": "Organization",
      "name": "tarteel.tv",
      "logo": {
        "@type": "ImageObject",
        "url": "https://tarteel.tv/apple-touch-icon.png",
      },
    },
  };
}
