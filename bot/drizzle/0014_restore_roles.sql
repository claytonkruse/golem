CREATE TABLE `member_roles` (
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_ids` text NOT NULL,
	`left_at` integer NOT NULL,
	PRIMARY KEY(`guild_id`, `user_id`),
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `restore_roles` integer DEFAULT false NOT NULL;