import type { ClipVariant } from "@/lib/types";

type VariantQualityOrder = readonly string[];

function pickVariantByQuality(variants: ClipVariant[], qualities: VariantQualityOrder): ClipVariant | undefined {
  for (const quality of qualities) {
    const match = variants.find((variant) => variant.quality === quality);
    if (match) return match;
  }
  return undefined;
}

function isPlayableMediaVariant(variant: ClipVariant) {
  const source = (variant.url ?? variant.r2Key).toLowerCase();
  return source.endsWith(".mp4") || source.endsWith(".mp3") || source.endsWith(".m3u8");
}

export function selectPlaybackVariant(variants: ClipVariant[]): ClipVariant | undefined {
  return (
    pickVariantByQuality(variants, ["hls", "high", "4", "3", "2", "1", "low"] as const) ??
    variants.find(isPlayableMediaVariant) ??
    variants[0]
  );
}

export function selectOfflineBaseVariant(variants: ClipVariant[]): ClipVariant | undefined {
  return (
    pickVariantByQuality(variants, ["high", "4", "3", "2", "1", "low"] as const) ??
    variants.find((variant) => {
      const source = variant.r2Key.toLowerCase();
      return source.endsWith(".mp4") || source.endsWith(".mp3");
    })
  );
}

export function selectDownloadVariant(variants: ClipVariant[]): ClipVariant | undefined {
  return selectOfflineBaseVariant(variants) ?? selectPlaybackVariant(variants);
}

export function selectMetadataVideoVariant(variants: ClipVariant[]): ClipVariant | undefined {
  return (
    pickVariantByQuality(variants, ["high", "4", "3", "2", "1", "low", "hls"] as const) ??
    selectPlaybackVariant(variants)
  );
}

export function selectThumbnailVariant(variants: ClipVariant[]): ClipVariant | undefined {
  return variants.find((variant) => variant.quality === "thumbnail");
}

export function hasHdVariant(variants: ClipVariant[]): boolean {
  return variants.some((variant) => ["hls", "high", "4", "3"].includes(variant.quality));
}

export function getVariantMimeType(variant: ClipVariant): string | undefined {
  const source = (variant.url ?? variant.r2Key).toLowerCase();
  if (source.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (source.endsWith(".mp3")) return "audio/mpeg";
  if (source.endsWith(".mp4")) return "video/mp4";
  return undefined;
}
