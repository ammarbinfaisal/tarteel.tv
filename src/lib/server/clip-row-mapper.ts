import type { InferSelectModel } from "drizzle-orm";

import { clips as clipsTable, clipVariants as clipVariantsTable } from "@/db/schema/clips";
import type { Clip, ClipTranslation, ClipVariant } from "@/lib/types";

type ClipRow = InferSelectModel<typeof clipsTable>;
type ClipVariantRow = InferSelectModel<typeof clipVariantsTable>;

export type ClipRowWithVariants = ClipRow & { variants: ClipVariantRow[] };

type AyahFilter = {
  start: number;
  end: number;
};

export function mapClipVariantFromRow(row: ClipVariantRow): ClipVariant {
  return {
    quality: row.quality,
    r2Key: row.r2Key,
    md5: row.md5 ?? undefined,
  };
}

export function mapClipFromRow(row: ClipRowWithVariants, ayahFilter?: AyahFilter): Clip {
  const clip: Clip = {
    id: row.id,
    surah: row.surah,
    ayahStart: row.ayahStart,
    ayahEnd: row.ayahEnd,
    reciterSlug: row.reciterSlug,
    reciterName: row.reciterName,
    riwayah: row.riwayah,
    translation: row.translation as ClipTranslation,
    thumbnailBlur: row.thumbnailBlur ?? undefined,
    variants: row.variants.map(mapClipVariantFromRow),
  };

  if (!ayahFilter) {
    return clip;
  }

  return {
    ...clip,
    isPartial: clip.ayahStart !== ayahFilter.start || clip.ayahEnd !== ayahFilter.end,
  };
}
