CREATE TABLE `invite_count_adjustments` (
	`guild_id` text NOT NULL,
	`inviter_id` text NOT NULL,
	`extra` integer NOT NULL,
	PRIMARY KEY(`guild_id`, `inviter_id`),
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
