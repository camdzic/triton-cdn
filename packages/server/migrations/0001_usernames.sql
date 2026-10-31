ALTER TABLE `users` RENAME COLUMN `email` TO `username`;--> statement-breakpoint
DROP INDEX `users_email_unique`;--> statement-breakpoint
UPDATE `users` SET `username` = substr(`username`, 1, instr(`username`, '@') - 1)
WHERE instr(`username`, '@') > 1
	AND NOT EXISTS (
		SELECT 1 FROM `users` AS `other`
		WHERE `other`.`id` != `users`.`id`
			AND (
				`other`.`username` = substr(`users`.`username`, 1, instr(`users`.`username`, '@') - 1)
				OR substr(`other`.`username`, 1, instr(`users`.`username`, '@')) = substr(`users`.`username`, 1, instr(`users`.`username`, '@'))
			)
	);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
