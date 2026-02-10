import { NextRequest } from "next/server";

function isValidR2Key(key: string) {
  if (!key) return false;
  if (key.includes("..") || key.includes("\\") || key.includes("\0")) return false;
  if (!key.startsWith("clips/")) return false;
  const lower = key.toLowerCase();
  if (!lower.endsWith(".mp4") && !lower.endsWith(".mp3")) return false;
  return true;
}

function buildPublicUrl(base: string, r2Key: string) {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedKey = r2Key.replace(/^\/+/, "");
  return new URL(normalizedKey, normalizedBase).toString();
}

export async function GET(req: NextRequest) {
  const r2Key = req.nextUrl.searchParams.get("r2Key") ?? "";
  if (!isValidR2Key(r2Key)) {
    return new Response("Invalid r2Key", { status: 400 });
  }

  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) {
    return new Response("R2_PUBLIC_BASE_URL is not configured", { status: 500 });
  }

  const upstreamUrl = buildPublicUrl(base, r2Key);
  const range = req.headers.get("range");

  const upstream = await fetch(upstreamUrl, {
    headers: range ? { range } : undefined,
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Not found", { status: upstream.status });
  }

  const headers = new Headers();
  for (const name of [
    "content-type",
    "content-length",
    "accept-ranges",
    "content-range",
    "etag",
    "last-modified",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(upstream.body, { status: upstream.status, headers });
}

