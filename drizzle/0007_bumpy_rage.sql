CREATE TABLE `movie_request_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`movie_id` text NOT NULL,
	`title` text NOT NULL,
	`release_year` text DEFAULT '' NOT NULL,
	`email` text NOT NULL,
	`last_error` text,
	`attempted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `movie_request_notifications_movie_email_unique` ON `movie_request_notifications` (`movie_id`,`email`);