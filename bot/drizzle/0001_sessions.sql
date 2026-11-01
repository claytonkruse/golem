CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`global_name` text,
	`avatar` text,
	`access_token` text NOT NULL,
	`expires_at` integer NOT NULL
);
