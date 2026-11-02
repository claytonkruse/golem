CREATE TABLE `feed_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`state` text NOT NULL,
	`next_check_at` integer NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_sources_kind_key_idx` ON `feed_sources` (`kind`,`key`);--> statement-breakpoint
CREATE INDEX `feed_sources_next_check_at_idx` ON `feed_sources` (`next_check_at`);--> statement-breakpoint
CREATE TABLE `feed_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`guild_id` text,
	`channel_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_error` text,
	FOREIGN KEY (`source_id`) REFERENCES `feed_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_subscriptions_source_channel_idx` ON `feed_subscriptions` (`source_id`,`channel_id`);--> statement-breakpoint
CREATE INDEX `feed_subscriptions_guild_id_idx` ON `feed_subscriptions` (`guild_id`);--> statement-breakpoint
CREATE INDEX `feed_subscriptions_channel_id_idx` ON `feed_subscriptions` (`channel_id`);