CREATE TABLE `log_options` (
	`guild_id` text NOT NULL,
	`event` text NOT NULL,
	`option` text NOT NULL,
	PRIMARY KEY(`guild_id`, `event`, `option`),
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
