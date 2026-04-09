import { NextResponse } from "next/server";
import { db } from "@/db";
import { pageViews } from "@/db/schema/analytics";

/**
 * Internal endpoint called by middleware to record page views.
 * Runs on Node.js runtime (has DB access).
 */
export async function POST(request: Request) {
  // Only accept internal calls from middleware
  if (request.headers.get("x-analytics-secret") !== "internal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();

    await db.insert(pageViews).values({
      path: payload.path,
      clipId: payload.clipId || null,
      visitorHash: payload.visitorHash,
      referrer: payload.referrer || null,
      referrerDomain: payload.referrerDomain || null,
      utmSource: payload.utmSource || null,
      utmMedium: payload.utmMedium || null,
      utmCampaign: payload.utmCampaign || null,
      deviceType: payload.deviceType || null,
      browser: payload.browser || null,
      os: payload.os || null,
      country: payload.country || null,
      region: payload.region || null,
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Analytics write failures should not return 500 to middleware
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
