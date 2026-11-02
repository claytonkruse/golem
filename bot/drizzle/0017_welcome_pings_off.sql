-- Pings start off for every server, including rows 0016 gave the old default of on.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_welcome_settings` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`channel_id` text,
	`message` text NOT NULL,
	`ping_mentions` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_welcome_settings`("guild_id", "enabled", "channel_id", "message", "ping_mentions") SELECT "guild_id", "enabled", "channel_id", "message", false FROM `welcome_settings`;--> statement-breakpoint
DROP TABLE `welcome_settings`;--> statement-breakpoint
ALTER TABLE `__new_welcome_settings` RENAME TO `welcome_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;