CREATE TABLE `guild_level_commands` (
	`guild_id` text NOT NULL,
	`command` text NOT NULL,
	`enabled` integer NOT NULL,
	PRIMARY KEY(`guild_id`, `command`),
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_guild_settings` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`command_xp` integer DEFAULT true NOT NULL,
	`level_commands` integer DEFAULT false NOT NULL,
	`games_enabled` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_guild_settings`("guild_id", "command_xp", "level_commands", "games_enabled") SELECT "guild_id", "command_xp", "level_commands", "games_enabled" FROM `guild_settings`;--> statement-breakpoint
DROP TABLE `guild_settings`;--> statement-breakpoint
ALTER TABLE `__new_guild_settings` RENAME TO `guild_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
-- Leveling commands are now off by default. Rows saved before this only had "on" from the
-- old default, never by choice, so they start off too.
UPDATE `guild_settings` SET `level_commands` = false;
