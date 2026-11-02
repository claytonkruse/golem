CREATE TABLE `log_channels` (
	`guild_id` text NOT NULL,
	`event` text NOT NULL,
	`channel_id` text NOT NULL,
	PRIMARY KEY(`guild_id`, `event`, `channel_id`),
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `log_channels_channel_id_idx` ON `log_channels` (`channel_id`);