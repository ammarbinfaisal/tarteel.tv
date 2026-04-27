import HomePage from "@/components/HomePage.client";
import { listClips, listReciters, listRiwayat, listTranslations, getClipById } from "@/lib/server/clips";
import { getTopClips, parseDateRange } from "@/lib/server/analytics";
import { variantToPublicUrl } from "@/lib/server/r2";
import type { Clip } from "@/lib/types";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getSurahName, formatSlug, formatTranslation } from "@/lib/utils";
import { parseHomeUiStateFromSearchParams, buildHomeUrl, defaultHomeUiState, type HomeUiState } from "@/lib/home-ui-state";
import { getVariantMimeType, selectMetadataVideoVariant } from "@/lib/clip-variants";

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const parsed = parseHomeUiStateFromSearchParams(await searchParams);

  if (parsed.clipId) {
    try {
      const clip = await getClipById(parsed.clipId);

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
      const ogImage = `/api/og?clipId=${parsed.clipId}`;
      const canonicalUrl = `/?view=reel&clipId=${parsed.clipId}`;

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

  const filterParts = describeFilters(parsed);
  if (filterParts.length > 0) {
    const title = filterParts.join(" \u00B7 ");
    const description = `Browse Quran recitation clips: ${filterParts.join(", ")}`;
    const canonicalUrl = buildHomeUrl({ ...defaultHomeUiState, ...parsed, view: "grid", clipId: null });

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: "website",
        title,
        description,
        url: canonicalUrl,
        siteName: "tarteel.tv",
      },
    };
  }

  return {};
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

  const hasFilters = Boolean(
    (parsedState.surahs && parsedState.surahs.length > 0) ||
      (parsedState.reciters && parsedState.reciters.length > 0) ||
      (parsedState.riwayahs && parsedState.riwayahs.length > 0) ||
      (parsedState.translations && parsedState.translations.length > 0),
  );

  const [clipsRaw, reciters, riwayat, translations, topTrending] = await Promise.all([
    listClips({
      surahs: parsedState.surahs && parsedState.surahs.length > 0 ? parsedState.surahs : undefined,
      ayahStart: (parsedState.surahs?.length === 1) ? (parsedState.start ?? undefined) : undefined,
      ayahEnd: (parsedState.surahs?.length === 1) ? (parsedState.end ?? undefined) : undefined,
      reciterSlugs: parsedState.reciters && parsedState.reciters.length > 0 ? parsedState.reciters : undefined,
      riwayahs: parsedState.riwayahs && parsedState.riwayahs.length > 0 ? parsedState.riwayahs : undefined,
      translations: parsedState.translations && parsedState.translations.length > 0 ? parsedState.translations : undefined,
    }),
    listReciters(),
    listRiwayat(),
    listTranslations(),
    // Only highlight a hero on the unfiltered grid — filtered views shouldn't promote a clip outside the filter.
    hasFilters
      ? Promise.resolve([] as { clipId: string | null }[])
      : getTopClips(parseDateRange("7d"), 1).catch(() => []),
  ]);

  const trendingClipId = topTrending[0]?.clipId ?? null;

  // If the URL points at a clip that listClips excluded (e.g. a draft), pull it
  // in by id so the reel viewer can render the deep link without leaking it
  // into listings/sitemap.
  const requestedClipId = parsedState.clipId ?? null;
  const requestedClipMissing =
    requestedClipId !== null && !clipsRaw.some((c) => c.id === requestedClipId);
  const extraClipRaw = requestedClipMissing
    ? await getClipById(requestedClipId).catch(() => null)
    : null;

  const clips: Clip[] = [
    ...(extraClipRaw ? [extraClipRaw] : []),
    ...clipsRaw,
  ].map(clip => ({
    ...clip,
    variants: clip.variants.map(v => ({
      ...v,
      url: v.url ?? variantToPublicUrl(v) ?? undefined
    }))
  }));

  const jsonLd = await buildJsonLd(parsedState, clips);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage
        clips={clips}
        filterData={{ reciters, riwayat, translations }}
        trendingClipId={trendingClipId}
      />
    </>
  );
}

function describeFilters(parsed: Partial<HomeUiState>): string[] {
  const parts: string[] = [];
  if (parsed.reciters && parsed.reciters.length > 0) {
    parts.push(parsed.reciters.map(formatSlug).join(", "));
  }
  if (parsed.surahs && parsed.surahs.length > 0) {
    parts.push(parsed.surahs.map((s) => `Surah ${getSurahName(s)}`).join(", "));
  }
  if (parsed.riwayahs && parsed.riwayahs.length > 0) {
    parts.push(parsed.riwayahs.map(formatSlug).join(", "));
  }
  if (parsed.translations && parsed.translations.length > 0) {
    parts.push(parsed.translations.map(formatTranslation).join(", "));
  }
  return parts;
}

async function buildJsonLd(parsed: Partial<HomeUiState>, clips: Clip[]): Promise<object> {
  const clipId = parsed.clipId ?? null;

  if (clipId) {
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

    if (clip) {
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
  }

  const filterParts = describeFilters(parsed);
  if (filterParts.length > 0) {
    const name = filterParts.join(" \u00B7 ") + " | tarteel.tv";
    const description = `Quran recitation clips: ${filterParts.join(", ")}`;
    const canonicalUrl = `https://tarteel.tv${buildHomeUrl({ ...defaultHomeUiState, ...parsed, view: "grid", clipId: null })}`;

    // Build breadcrumb items: Home → filter segments
    const breadcrumbItems = [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://tarteel.tv" },
    ];
    let pos = 2;
    if (parsed.surahs && parsed.surahs.length > 0) {
      const surahLabel = parsed.surahs.map((s) => `Surah ${getSurahName(s)}`).join(", ");
      breadcrumbItems.push({ "@type": "ListItem", position: pos++, name: surahLabel, item: canonicalUrl });
    }
    if (parsed.reciters && parsed.reciters.length > 0) {
      const reciterLabel = parsed.reciters.map(formatSlug).join(", ");
      breadcrumbItems.push({ "@type": "ListItem", position: pos++, name: reciterLabel, item: canonicalUrl });
    }

    return [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": name,
        "description": description,
        "url": canonicalUrl,
        "mainEntity": {
          "@type": "ItemList",
          "numberOfItems": clips.length,
          "itemListElement": clips.slice(0, 50).map((clip, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "item": {
              "@type": "VideoObject",
              "name": `${getSurahName(clip.surah)}:${clip.ayahStart}-${clip.ayahEnd} | ${clip.reciterName}`,
              "url": `https://tarteel.tv/?view=reel&clipId=${clip.id}`,
            },
          })),
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbItems,
      },
    ];
  }

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "tarteel.tv",
    "url": "https://tarteel.tv",
    "description": "Clips of Quran Recitations.",
  };
}
