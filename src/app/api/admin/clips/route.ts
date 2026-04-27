import { NextRequest, NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/server/admin-auth";
import { listAdminClips } from "@/lib/server/clips";
import type { ClipTranslation } from "@/lib/types";

function parseNumberList(searchParams: URLSearchParams, keys: string[]): number[] | undefined {
  const values: number[] = [];
  for (const key of keys) {
    for (const raw of searchParams.getAll(key)) {
      for (const part of raw.split(",")) {
        const value = Number.parseInt(part.trim(), 10);
        if (!Number.isNaN(value)) {
          values.push(value);
        }
      }
    }
  }
  return values.length > 0 ? Array.from(new Set(values)) : undefined;
}

function parseStringList(searchParams: URLSearchParams, keys: string[]): string[] | undefined {
  const values: string[] = [];
  for (const key of keys) {
    for (const raw of searchParams.getAll(key)) {
      for (const part of raw.split(",")) {
        const value = part.trim();
        if (value) {
          values.push(value);
        }
      }
    }
  }
  return values.length > 0 ? Array.from(new Set(values)) : undefined;
}

export async function GET(request: NextRequest) {
  const authResponse = requireAdminAuth(request);
  if (authResponse) return authResponse;

  const { searchParams } = new URL(request.url);
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Number.parseInt(searchParams.get("pageSize") || "25", 10);

  const result = await listAdminClips({
    q: searchParams.get("q") || undefined,
    page: Number.isNaN(page) ? 1 : page,
    pageSize: Number.isNaN(pageSize) ? 25 : pageSize,
    surahs: parseNumberList(searchParams, ["surah"]),
    reciterSlugs: parseStringList(searchParams, ["reciter", "reciterSlug"]),
    riwayahs: parseStringList(searchParams, ["riwayah"]),
    translations: parseStringList(searchParams, ["translation"]) as ClipTranslation[] | undefined,
  });

  return NextResponse.json(result);
}
