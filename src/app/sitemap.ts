import { listClips } from "@/lib/server/clips";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const clips = await listClips({});

  const clipUrls: MetadataRoute.Sitemap = clips.map((clip) => ({
    url: `https://tarteel.tv/?view=reel&clipId=${clip.id}`,
    lastModified: clip.createdAt,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

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
