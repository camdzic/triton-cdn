CREATE TABLE `embed_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL,
	`color` text NOT NULL,
	`site_name` text NOT NULL,
	`author` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
