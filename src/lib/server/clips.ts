import "server-only";

import { db } from "@/db";
import { clips as clipsTable, clipVariants } from "@/db/schema/clips";
import { eq, and, gte, lte, or, asc, desc, sql, inArray, like, isNull } from "drizzle-orm";
import type { Clip, ClipTranslation, TelegramPost } from "@/lib/types";
import { mapClipFromRow } from "@/lib/server/clip-row-mapper";

export type ClipFilters = {
  surahs?: number[];
  ayahStart?: number;
  ayahEnd?: number;
  reciterSlugs?: string[];
  riwayah?: string;
  translation?: ClipTranslation;
  includeArchived?: boolean;
};

export type AdminClipFilters = ClipFilters & {
  q?: string;
  page?: number;
  pageSize?: number;
};

export type AdminClipListResult = {
  clips: Clip[];
  total: number;
  page: number;
  pageSize: number;
};

export type ClipMetadataInput = {
  surah?: number;
  ayahStart?: number;
  ayahEnd?: number;
  reciterSlug?: string;
  reciterName?: string;
  riwayah?: string;
  translation?: string;
};

function buildClipIdFromMetadata(metadata: {
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  reciterSlug: string;
  riwayah: string;
  translation: string;
}): string {
  return `s${metadata.surah}_a${metadata.ayahStart}-${metadata.ayahEnd}__${metadata.reciterSlug}__${metadata.riwayah}__${metadata.translation}`;
}

function humanizeSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildAdminClipWhere(filters: AdminClipFilters) {
  const where = [];

  if (filters.q?.trim()) {
    const query = `%${filters.q.trim()}%`;
    where.push(
      or(
        like(clipsTable.id, query),
        like(clipsTable.reciterSlug, query),
        like(clipsTable.reciterName, query),
        like(clipsTable.riwayah, query),
        like(clipsTable.translation, query),
        like(clipsTable.telegramMeta, query),
      ),
    );
  }

  if (filters.surahs && filters.surahs.length > 0) {
    where.push(filters.surahs.length === 1 ? eq(clipsTable.surah, filters.surahs[0]) : inArray(clipsTable.surah, filters.surahs));
  }

  if (filters.reciterSlugs && filters.reciterSlugs.length > 0) {
    where.push(filters.reciterSlugs.length === 1 ? eq(clipsTable.reciterSlug, filters.reciterSlugs[0]) : inArray(clipsTable.reciterSlug, filters.reciterSlugs));
  }

  if (filters.riwayah) {
    where.push(eq(clipsTable.riwayah, filters.riwayah));
  }

  if (filters.translation) {
    where.push(eq(clipsTable.translation, filters.translation));
  }

  const hasAyahFilter =
    filters.surahs?.length === 1 &&
    (filters.ayahStart != null || filters.ayahEnd != null);
  const ayahFilterStart =
    filters.ayahStart ?? (filters.ayahEnd != null ? filters.ayahEnd : 1);
  const ayahFilterEnd =
    filters.ayahEnd ?? (filters.ayahStart != null ? filters.ayahStart : 999);

  if (hasAyahFilter) {
    where.push(lte(clipsTable.ayahStart, ayahFilterEnd));
    where.push(gte(clipsTable.ayahEnd, ayahFilterStart));
  }

  return { where, hasAyahFilter, ayahFilterStart, ayahFilterEnd };
}

export async function listClips(filters: ClipFilters): Promise<Clip[]> {
  const { where, hasAyahFilter, ayahFilterStart, ayahFilterEnd } = buildAdminClipWhere(filters);

  const results = await db.query.clips.findMany({
    where: and(...where, ...(filters.includeArchived ? [] : [isNull(clipsTable.archivedAt)])),
    with: {
      variants: true
    },
    orderBy: [
      asc(clipsTable.surah),
      asc(clipsTable.ayahStart),
      asc(clipsTable.ayahEnd),
      asc(clipsTable.reciterSlug)
    ]
  });

  return results.map((result) =>
    mapClipFromRow(
      result,
      hasAyahFilter ? { start: ayahFilterStart, end: ayahFilterEnd } : undefined,
    ),
  );
}

export async function getClipById(id: string): Promise<Clip | null> {
  const result = await db.query.clips.findFirst({
    where: eq(clipsTable.id, id),
    with: {
      variants: true
    }
  });

  if (!result) return null;

  return mapClipFromRow(result);
}

export async function listAdminClips(filters: AdminClipFilters): Promise<AdminClipListResult> {
  const { where } = buildAdminClipWhere(filters);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const [totalRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(clipsTable)
      .where(and(...where)),
    db.query.clips.findMany({
      where: and(...where),
      with: {
        variants: true,
      },
      orderBy: [
        desc(clipsTable.createdAt),
        desc(clipsTable.surah),
        desc(clipsTable.ayahStart),
        desc(clipsTable.id),
      ],
      limit: pageSize,
      offset,
    }),
  ]);

  return {
    clips: rows.map((row) => mapClipFromRow(row)),
    total: totalRows[0]?.count ?? 0,
    page,
    pageSize,
  };
}

export async function setClipTelegramMeta(clipId: string, telegram: TelegramPost | null): Promise<Clip | null> {
  await db.update(clipsTable).set({
    telegramMeta: telegram ? JSON.stringify(telegram) : null,
  }).where(eq(clipsTable.id, clipId));

  return getClipById(clipId);
}

export async function updateClipMetadata(
  clipId: string,
  metadata: ClipMetadataInput,
): Promise<Clip> {
  return db.transaction(async (tx) => {
    const existing = await tx.query.clips.findFirst({
      where: eq(clipsTable.id, clipId),
      with: {
        variants: true,
      },
    });

    if (!existing) {
      throw new Error(`Clip not found: ${clipId}`);
    }

    const next = {
      surah: metadata.surah ?? existing.surah,
      ayahStart: metadata.ayahStart ?? existing.ayahStart,
      ayahEnd: metadata.ayahEnd ?? existing.ayahEnd,
      reciterSlug: metadata.reciterSlug ?? existing.reciterSlug,
      reciterName:
        metadata.reciterName ??
        (metadata.reciterSlug && metadata.reciterSlug !== existing.reciterSlug
          ? humanizeSlug(metadata.reciterSlug)
          : existing.reciterName),
      riwayah: metadata.riwayah ?? existing.riwayah,
      translation: metadata.translation ?? existing.translation,
    };

    const nextId = buildClipIdFromMetadata(next);

    if (nextId !== clipId) {
      const conflict = await tx.select({ id: clipsTable.id })
        .from(clipsTable)
        .where(eq(clipsTable.id, nextId))
        .limit(1);

      if (conflict.length > 0) {
        throw new Error(`Clip already exists as ${nextId}`);
      }

      await tx.insert(clipsTable).values({
        id: nextId,
        surah: next.surah,
        ayahStart: next.ayahStart,
        ayahEnd: next.ayahEnd,
        reciterSlug: next.reciterSlug,
        reciterName: next.reciterName,
        riwayah: next.riwayah,
        translation: next.translation,
        thumbnailBlur: existing.thumbnailBlur,
        telegramMeta: existing.telegramMeta,
        createdAt: existing.createdAt ?? new Date(),
      });

      await tx.update(clipVariants).set({
        clipId: nextId,
      }).where(eq(clipVariants.clipId, clipId));

      await tx.delete(clipsTable).where(eq(clipsTable.id, clipId));
    } else {
      await tx.update(clipsTable).set({
        surah: next.surah,
        ayahStart: next.ayahStart,
        ayahEnd: next.ayahEnd,
        reciterSlug: next.reciterSlug,
        reciterName: next.reciterName,
        riwayah: next.riwayah,
        translation: next.translation,
      }).where(eq(clipsTable.id, clipId));
    }

    const updated = await tx.query.clips.findFirst({
      where: eq(clipsTable.id, nextId),
      with: {
        variants: true,
      },
    });

    if (!updated) {
      throw new Error(`Failed to load updated clip ${nextId}`);
    }

    return mapClipFromRow(updated);
  });
}

function calculateSimilarityScore(reference: Clip, candidate: Clip): number {
  const isSameReciter = reference.reciterSlug === candidate.reciterSlug;
  const isSameSurah = reference.surah === candidate.surah;
  const surahDistance = Math.abs(reference.surah - candidate.surah);

  if (isSameSurah || isSameReciter) return 1000;
  if (surahDistance <= 3) return 200 - (surahDistance * 17);
  if (surahDistance <= 10) return 100 - (surahDistance * 6);
  return Math.max(0, 50 - surahDistance);
}

export function orderBySimilarity(reference: Clip, clips: Clip[]): Clip[] {
  const clipsWithScores = clips.map(clip => ({
    clip,
    score: calculateSimilarityScore(reference, clip)
  }));

  const tierMap = new Map<number, typeof clipsWithScores>();
  for (const item of clipsWithScores) {
    const tier = Math.floor(item.score / 100);
    if (!tierMap.has(tier)) tierMap.set(tier, []);
    tierMap.get(tier)!.push(item);
  }

  const sortedTiers = Array.from(tierMap.entries()).sort((a, b) => b[0] - a[0]);

  const result: Clip[] = [];
  for (const [, tierClips] of sortedTiers) {
    const shuffled = [...tierClips];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    result.push(...shuffled.map(item => item.clip));
  }

  return result;
}

export async function getRelatedClips(clip: Clip, limit = 10): Promise<Clip[]> {
  // Use DB for basic filtering then similarity in memory
  const relatedClips = await db.query.clips.findMany({
    where: and(
      or(
        eq(clipsTable.reciterSlug, clip.reciterSlug),
        eq(clipsTable.surah, clip.surah)
      ),
      sql`${clipsTable.id} != ${clip.id}`,
      isNull(clipsTable.archivedAt),
    ),
    with: {
      variants: true
    }
  });

  const formatted = relatedClips.map((relatedClip) => mapClipFromRow(relatedClip));

  const ordered = orderBySimilarity(clip, formatted);
  return ordered.slice(0, limit);
}

export async function listReciters(): Promise<{ slug: string; name: string }[]> {
  const results = await db
    .select({ slug: clipsTable.reciterSlug, name: clipsTable.reciterName })
    .from(clipsTable)
    .where(isNull(clipsTable.archivedAt))
    .groupBy(clipsTable.reciterSlug, clipsTable.reciterName)
    .orderBy(asc(clipsTable.reciterName));

  return results;
}

export async function listRiwayat(): Promise<string[]> {
  const results = await db
    .select({ riwayah: clipsTable.riwayah })
    .from(clipsTable)
    .where(isNull(clipsTable.archivedAt))
    .groupBy(clipsTable.riwayah)
    .orderBy(asc(clipsTable.riwayah));

  return results.map(r => r.riwayah);
}

export async function listTranslations(): Promise<ClipTranslation[]> {
  const results = await db
    .select({ translation: clipsTable.translation })
    .from(clipsTable)
    .where(isNull(clipsTable.archivedAt))
    .groupBy(clipsTable.translation)
    .orderBy(asc(clipsTable.translation));

  return results.map(r => r.translation as ClipTranslation);
}
