CREATE TABLE `chip_balances` (
	`user_id` text PRIMARY KEY NOT NULL,
	`chips` integer NOT NULL,
	`last_daily_at` integer
);
--> statement-breakpoint
CREATE TABLE `chip_holds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`game` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` integer NOT NULL
);
