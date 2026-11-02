CREATE TABLE `invite_joins` (
	`guild_id` text NOT NULL,
	`member_id` text NOT NULL,
	`inviter_id` text NOT NULL,
	`invite_code` text NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`guild_id`, `member_id`),
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invite_joins_inviter_idx` ON `invite_joins` (`guild_id`,`inviter_id`);