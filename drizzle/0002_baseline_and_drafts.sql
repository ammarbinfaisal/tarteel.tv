CREATE TABLE `page_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`clip_id` text,
	`visitor_hash` text NOT NULL,
	`referrer` text,
	`referrer_domain` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`device_type` text,
	`browser` text,
	`os` text,
	`country` text,
	`region` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pv_path_idx` ON `page_views` (`path`);--> statement-breakpoint
CREATE INDEX `pv_clip_id_idx` ON `page_views` (`clip_id`);--> statement-breakpoint
CREATE INDEX `pv_created_at_idx` ON `page_views` (`created_at`);--> statement-breakpoint
CREATE INDEX `pv_visitor_hash_idx` ON `page_views` (`visitor_hash`);--> statement-breakpoint
CREATE INDEX `pv_referrer_domain_idx` ON `page_views` (`referrer_domain`);--> statement-breakpoint
CREATE INDEX `pv_country_idx` ON `page_views` (`country`);--> statement-breakpoint
ALTER TABLE `clips` ADD `thumbnail_blur` text;--> statement-breakpoint
ALTER TABLE `clips` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `clips` ADD `is_draft` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `is_draft_idx` ON `clips` (`is_draft`);