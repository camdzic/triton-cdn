ALTER TABLE `files` ADD `vanity` text;--> statement-breakpoint
ALTER TABLE `files` ADD `private` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `files_vanity_unique` ON `files` (`vanity`);