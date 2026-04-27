import { NextRequest, NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/server/admin-auth";
import { setClipTelegramMeta } from "@/lib/server/clips";
import type { TelegramPost } from "@/lib/types";

type RouteContext = {
  params: Promise<{ clipId: string }>;
};

function parseTelegramUrl(raw: string): TelegramPost | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!/^t\.me$/i.test(url.hostname)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  // /<channel>/<messageId>            → public channel
  // /c/<internalChatId>/<messageId>   → private channel (numeric chat id, no username)
  if (segments[0] === "c" && segments.length >= 3) {
    const messageId = Number.parseInt(segments[2], 10);
    const chatId = Number.parseInt(segments[1], 10);
    if (!Number.isFinite(messageId) || !Number.isFinite(chatId)) return null;
    return { messageId, chatId, url: url.toString() };
  }

  if (segments.length >= 2) {
    const messageId = Number.parseInt(segments[1], 10);
    if (!Number.isFinite(messageId)) return null;
    return {
      messageId,
      chatId: 0,
      channelUsername: segments[0],
      url: url.toString(),
    };
  }

  return null;
}

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

  // Empty/null clears the link.
  if (body.url === null || body.url === "" || body.url === undefined) {
    const clip = await setClipTelegramMeta(clipId, null);
    if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    return NextResponse.json({ clip });
  }

  if (typeof body.url !== "string") {
    return NextResponse.json({ error: "url (string) is required" }, { status: 400 });
  }

  const meta = parseTelegramUrl(body.url);
  if (!meta) {
    return NextResponse.json(
      { error: "Expected a t.me link like https://t.me/<channel>/<messageId>" },
      { status: 400 },
    );
  }

  const clip = await setClipTelegramMeta(clipId, meta);
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  return NextResponse.json({ clip });
}
