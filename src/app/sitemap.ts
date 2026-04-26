import { listClips, listReciters } from "@/lib/server/clips";
import type { MetadataRoute } from "next";

// Generate at request time, not build time — Turso reachability isn't a build-time guarantee,
// and a flaky DB call should never block a deploy. Cached for 1h once warm.
export const revalidate = 3600;

function toXmlSafeSitemapUrl(url: URL): string {
  return url.toString().replaceAll("&", "&amp;");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [clips, reciters] = await Promise.all([
    listClips({}).catch((err) => {
      console.error("[sitemap] listClips failed:", err);
      return [] as Awaited<ReturnType<typeof listClips>>;
    }),
    listReciters().catch((err) => {
      console.error("[sitemap] listReciters failed:", err);
      return [] as Awaited<ReturnType<typeof listReciters>>;
    }),
  ]);

  const clipUrls: MetadataRoute.Sitemap = clips.map((clip) => {
    const reelUrl = new URL("https://tarteel.tv/");
    reelUrl.searchParams.set("view", "reel");
    reelUrl.searchParams.set("clipId", clip.id);

    return {
      url: toXmlSafeSitemapUrl(reelUrl),
      lastModified: clip.createdAt,
      changeFrequency: "monthly",
      priority: 0.8,
    };
  });

  const reciterUrls: MetadataRoute.Sitemap = reciters.map((reciter) => {
    const url = new URL("https://tarteel.tv/");
    url.searchParams.set("reciter", reciter.slug);
    return {
      url: toXmlSafeSitemapUrl(url),
      changeFrequency: "weekly",
      priority: 0.7,
    };
  });

  const surahsWithClips = [...new Set(clips.map((c) => c.surah))].sort(
    (a, b) => a - b,
  );
  const surahUrls: MetadataRoute.Sitemap = surahsWithClips.map((surah) => {
    const url = new URL("https://tarteel.tv/");
    url.searchParams.set("surah", String(surah));
    return {
      url: toXmlSafeSitemapUrl(url),
      changeFrequency: "weekly",
      priority: 0.7,
    };
  });

  return [
    {
      url: "https://tarteel.tv",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...reciterUrls,
    ...surahUrls,
    ...clipUrls,
  ];
}
