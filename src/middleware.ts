import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseUserAgent } from "@/lib/server/ua-parser";
import { generateVisitorHash } from "@/lib/server/visitor-hash";

/**
 * Server-side analytics middleware.
 * Captures pageview data from request headers (IP, User-Agent, Referer, geo)
 * and posts it to an internal API route for async DB write.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname, searchParams } = request.nextUrl;

  // Extract analytics data from request headers
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const userAgent = request.headers.get("user-agent") || "";
  const referer = request.headers.get("referer") || null;

  const visitorHash = await generateVisitorHash(ip, userAgent);
  const { deviceType, browser, os } = parseUserAgent(userAgent);

  // Geo from Vercel headers (available in production)
  const country = request.headers.get("x-vercel-ip-country") || null;
  const region = request.headers.get("x-vercel-ip-country-region") || null;

  // UTM parameters
  const utmSource = searchParams.get("utm_source") || null;
  const utmMedium = searchParams.get("utm_medium") || null;
  const utmCampaign = searchParams.get("utm_campaign") || null;

  // Extract clip ID if present
  const clipId = searchParams.get("clipId") || null;

  // Extract referrer domain
  let referrerDomain: string | null = null;
  if (referer) {
    try {
      referrerDomain = new URL(referer).hostname;
    } catch {
      // malformed referer — ignore
    }
  }

  const payload = {
    path: pathname,
    clipId,
    visitorHash,
    referrer: referer?.slice(0, 2048) || null,
    referrerDomain,
    utmSource,
    utmMedium,
    utmCampaign,
    deviceType,
    browser,
    os,
    country,
    region,
  };

  // Fire-and-forget POST to internal API route (runs on Node.js, has DB access).
  const collectUrl = new URL("/api/analytics/collect", request.nextUrl.origin);
  const writePromise = fetch(collectUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-analytics-secret": "internal" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Analytics write failures must never affect the user experience
  });

  // waitUntil ensures the fetch completes after the response is sent
  const ctx = (globalThis as any)[Symbol.for("next.middleware.context")] ?? request;
  if (typeof ctx?.waitUntil === "function") {
    ctx.waitUntil(writePromise);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Track only public page navigations:
     * - Exclude /admin, /api, /_next, and static assets
     */
    "/((?!admin|api|_next|favicon|manifest|apple-touch|robots|sitemap|sw|workbox|offline|icon|opengraph).*)",
  ],
};
