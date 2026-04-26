import { NextRequest, NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/server/admin-auth";
import { setClipDraftStatus } from "@/lib/server/clips";

type RouteContext = {
  params: Promise<{ clipId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const authResponse = requireAdminAuth(request);
  if (authResponse) return authResponse;

  const { clipId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.isDraft !== "boolean") {
    return NextResponse.json({ error: "isDraft (boolean) is required" }, { status: 400 });
  }

  const clip = await setClipDraftStatus(clipId, body.isDraft);
  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  return NextResponse.json({ clip });
}
