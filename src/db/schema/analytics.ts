import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const pageViews = sqliteTable("page_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  path: text("path").notNull(),
  clipId: text("clip_id"),
  visitorHash: text("visitor_hash").notNull(),
  referrer: text("referrer"),
  referrerDomain: text("referrer_domain"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  deviceType: text("device_type"),
  browser: text("browser"),
  os: text("os"),
  country: text("country"),
  region: text("region"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("pv_path_idx").on(table.path),
  index("pv_clip_id_idx").on(table.clipId),
  index("pv_created_at_idx").on(table.createdAt),
  index("pv_visitor_hash_idx").on(table.visitorHash),
  index("pv_referrer_domain_idx").on(table.referrerDomain),
  index("pv_country_idx").on(table.country),
]);
