import "server-only";

import { db } from "@/db";
import { pageViews } from "@/db/schema/analytics";
import { sql, count, countDistinct, eq, gte, lte, and, isNotNull, desc } from "drizzle-orm";

type DateRange = { start: Date; end: Date };

function dateRangeCondition({ start, end }: DateRange) {
  return and(
    gte(pageViews.createdAt, start),
    lte(pageViews.createdAt, end),
  );
}

export async function getPageviewStats(range: DateRange) {
  const [result] = await db
    .select({ total: count() })
    .from(pageViews)
    .where(dateRangeCondition(range));
  return result?.total ?? 0;
}

export async function getUniqueVisitors(range: DateRange) {
  const [result] = await db
    .select({ total: countDistinct(pageViews.visitorHash) })
    .from(pageViews)
    .where(dateRangeCondition(range));
  return result?.total ?? 0;
}

export async function getTopPages(range: DateRange, limit = 10) {
  return db
    .select({
      path: pageViews.path,
      clipId: pageViews.clipId,
      views: count().as("views"),
      uniques: countDistinct(pageViews.visitorHash).as("uniques"),
    })
    .from(pageViews)
    .where(dateRangeCondition(range))
    .groupBy(pageViews.path)
    .orderBy(desc(sql`views`))
    .limit(limit);
}

export async function getTopClips(range: DateRange, limit = 10) {
  return db
    .select({
      clipId: pageViews.clipId,
      views: count().as("views"),
      uniques: countDistinct(pageViews.visitorHash).as("uniques"),
    })
    .from(pageViews)
    .where(and(dateRangeCondition(range), isNotNull(pageViews.clipId)))
    .groupBy(pageViews.clipId)
    .orderBy(desc(sql`views`))
    .limit(limit);
}

export async function getTopReferrers(range: DateRange, limit = 10) {
  return db
    .select({
      referrerDomain: pageViews.referrerDomain,
      views: count().as("views"),
      uniques: countDistinct(pageViews.visitorHash).as("uniques"),
    })
    .from(pageViews)
    .where(dateRangeCondition(range))
    .groupBy(pageViews.referrerDomain)
    .orderBy(desc(sql`views`))
    .limit(limit);
}

export async function getDeviceBreakdown(range: DateRange) {
  return db
    .select({
      deviceType: pageViews.deviceType,
      views: count().as("views"),
    })
    .from(pageViews)
    .where(dateRangeCondition(range))
    .groupBy(pageViews.deviceType)
    .orderBy(desc(sql`views`));
}

export async function getBrowserBreakdown(range: DateRange) {
  return db
    .select({
      browser: pageViews.browser,
      views: count().as("views"),
    })
    .from(pageViews)
    .where(dateRangeCondition(range))
    .groupBy(pageViews.browser)
    .orderBy(desc(sql`views`));
}

export async function getCountryBreakdown(range: DateRange, limit = 10) {
  return db
    .select({
      country: pageViews.country,
      views: count().as("views"),
      uniques: countDistinct(pageViews.visitorHash).as("uniques"),
    })
    .from(pageViews)
    .where(dateRangeCondition(range))
    .groupBy(pageViews.country)
    .orderBy(desc(sql`views`))
    .limit(limit);
}

export async function getUtmCampaigns(range: DateRange, limit = 20) {
  return db
    .select({
      utmSource: pageViews.utmSource,
      utmMedium: pageViews.utmMedium,
      utmCampaign: pageViews.utmCampaign,
      views: count().as("views"),
      uniques: countDistinct(pageViews.visitorHash).as("uniques"),
    })
    .from(pageViews)
    .where(and(dateRangeCondition(range), isNotNull(pageViews.utmSource)))
    .groupBy(pageViews.utmSource, pageViews.utmMedium, pageViews.utmCampaign)
    .orderBy(desc(sql`views`))
    .limit(limit);
}

export async function getPageviewsTimeSeries(range: DateRange, granularity: "hour" | "day" = "day") {
  const dateExpr = granularity === "hour"
    ? sql<string>`strftime('%Y-%m-%d %H:00', ${pageViews.createdAt}, 'unixepoch')`
    : sql<string>`strftime('%Y-%m-%d', ${pageViews.createdAt}, 'unixepoch')`;

  return db
    .select({
      bucket: dateExpr.as("bucket"),
      views: count().as("views"),
      uniques: countDistinct(pageViews.visitorHash).as("uniques"),
    })
    .from(pageViews)
    .where(dateRangeCondition(range))
    .groupBy(sql`bucket`)
    .orderBy(sql`bucket`);
}

export async function getClipViewCount(clipId: string) {
  const [result] = await db
    .select({ total: count() })
    .from(pageViews)
    .where(eq(pageViews.clipId, clipId));
  return result?.total ?? 0;
}

/** Compute a DateRange from a named range string. */
export function parseDateRange(range: string | null | undefined): DateRange {
  const now = new Date();
  const end = now;

  switch (range) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "7d": {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
    case "30d": {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
    case "all":
      return { start: new Date(0), end };
    default:
      return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end };
  }
}
