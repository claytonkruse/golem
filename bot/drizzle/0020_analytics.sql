CREATE TABLE `member_activity` (
	`guild_id` text NOT NULL,
	`day` text NOT NULL,
	`user_id` text NOT NULL,
	`messages` integer NOT NULL,
	PRIMARY KEY(`guild_id`, `day`, `user_id`),
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `member_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_events_guild_at_idx` ON `member_events` (`guild_id`,`at`);