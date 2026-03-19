import { NextRequest, NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/server/admin-auth";
import { getClipById, updateClipMetadata } from "@/lib/server/clips";

type RouteContext = {
  params: Promise<{ clipId: string }>;
};

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authResponse = requireAdminAuth(request);
  if (authResponse) return authResponse;

  const { clipId } = await context.params;
  const clip = await getClipById(clipId);

  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  return NextResponse.json({ clip });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResponse = requireAdminAuth(request);
  if (authResponse) return authResponse;

  const { clipId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = {
    surah: readNumber(body.surah),
    ayahStart: readNumber(body.ayahStart),
    ayahEnd: readNumber(body.ayahEnd),
    reciterSlug: readString(body.reciterSlug),
    reciterName: readString(body.reciterName),
    riwayah: readString(body.riwayah),
    translation: readString(body.translation),
  };

  if (Object.values(payload).every((value) => value === undefined)) {
    return NextResponse.json({ error: "No metadata fields provided" }, { status: 400 });
  }

  try {
    const clip = await updateClipMetadata(clipId, payload);
    return NextResponse.json({ clip, previousId: clipId, clipId: clip.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update clip";
    const status = message.includes("already exists") ? 409 : message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
