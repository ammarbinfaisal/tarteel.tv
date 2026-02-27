import { listClips } from "@/lib/server/clips";
import type { MetadataRoute } from "next";

function toXmlSafeSitemapUrl(url: URL): string {
  return url.toString().replaceAll("&", "&amp;");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const clips = await listClips({});

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

  return [
    {
      url: "https://tarteel.tv",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...clipUrls,
  ];
}
