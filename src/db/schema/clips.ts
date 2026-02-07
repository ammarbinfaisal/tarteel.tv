import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const clips = sqliteTable("clips", {
  id: text("id").primaryKey(),
  surah: integer("surah").notNull(),
  ayahStart: integer("ayah_start").notNull(),
  ayahEnd: integer("ayah_end").notNull(),
  reciterSlug: text("reciter_slug").notNull(),
  reciterName: text("reciter_name").notNull(),
  riwayah: text("riwayah").default("hafs-an-asim").notNull(),
  translation: text("translation").default("saheeh-international").notNull(),
  thumbnailBlur: text("thumbnail_blur"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => [
  index("surah_idx").on(table.surah),
  index("reciter_slug_idx").on(table.reciterSlug),
  index("riwayah_idx").on(table.riwayah),
  index("translation_idx").on(table.translation),
]);

export const clipVariants = sqliteTable("clip_variants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clipId: text("clip_id").notNull().references(() => clips.id, { onDelete: "cascade" }),
  quality: text("quality").notNull(), // 'hls', 'high', 'low', etc.
  r2Key: text("r2_key").notNull(),
  md5: text("md5"),
});

export const clipsRelations = relations(clips, ({ many }) => ({
  variants: many(clipVariants),
}));

export const clipVariantsRelations = relations(clipVariants, ({ one }) => ({
  clip: one(clips, {
    fields: [clipVariants.clipId],
    references: [clips.id],
  }),
}));
