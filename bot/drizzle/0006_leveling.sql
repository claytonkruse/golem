CREATE TABLE `member_xp` (
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`xp` integer NOT NULL,
	`last_award_at` integer NOT NULL,
	PRIMARY KEY(`guild_id`, `user_id`),
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_xp_rank_idx` ON `member_xp` (`guild_id`,`xp`);--> statement-breakpoint
CREATE TABLE `user_xp` (
	`user_id` text PRIMARY KEY NOT NULL,
	`xp` integer NOT NULL,
	`last_award_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_xp_rank_idx` ON `user_xp` (`xp`);