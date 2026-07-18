CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`movie_id` text NOT NULL,
	`title` text NOT NULL,
	`release_year` text DEFAULT '' NOT NULL,
	`genre` text NOT NULL,
	`runtime` integer NOT NULL,
	`rating_tenths` integer NOT NULL,
	`blurb` text NOT NULL,
	`review_text` text NOT NULL,
	`poster_key` text NOT NULL,
	`poster_content_type` text NOT NULL,
	`created_by` text NOT NULL,
	`published_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_slug_unique` ON `reviews` (`slug`);--> statement-breakpoint
CREATE TABLE `studio_owner` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`claimed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_owner_email_unique` ON `studio_owner` (`email`);