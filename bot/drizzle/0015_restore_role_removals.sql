ALTER TABLE `guild_settings` ADD `restore_kicked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `restore_banned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `member_roles` ADD `removal` text DEFAULT 'left' NOT NULL;