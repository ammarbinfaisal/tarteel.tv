CREATE TABLE `clip_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clip_id` text NOT NULL,
	`quality` text NOT NULL,
	`r2_key` text NOT NULL,
	`md5` text,
	FOREIGN KEY (`clip_id`) REFERENCES `clips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `clips` (
	`id` text PRIMARY KEY NOT NULL,
	`surah` integer NOT NULL,
	`ayah_start` integer NOT NULL,
	`ayah_end` integer NOT NULL,
	`reciter_slug` text NOT NULL,
	`reciter_name` text NOT NULL,
	`riwayah` text DEFAULT 'hafs-an-asim' NOT NULL,
	`translation` text DEFAULT 'saheeh-international' NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE INDEX `surah_idx` ON `clips` (`surah`);--> statement-breakpoint
CREATE INDEX `reciter_slug_idx` ON `clips` (`reciter_slug`);--> statement-breakpoint
CREATE INDEX `riwayah_idx` ON `clips` (`riwayah`);--> statement-breakpoint
CREATE INDEX `translation_idx` ON `clips` (`translation`);