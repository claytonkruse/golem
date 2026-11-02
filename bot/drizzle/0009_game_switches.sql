CREATE TABLE `guild_games` (
	`guild_id` text NOT NULL,
	`game` text NOT NULL,
	`enabled` integer NOT NULL,
	PRIMARY KEY(`guild_id`, `game`),
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `games_enabled` integer DEFAULT false NOT NULL;