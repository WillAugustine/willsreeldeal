CREATE TABLE `newsletter_configuration` (
	`id` integer PRIMARY KEY NOT NULL,
	`instant_segment_id` text NOT NULL,
	`biweekly_segment_id` text NOT NULL,
	`instant_topic_id` text NOT NULL,
	`biweekly_topic_id` text NOT NULL,
	`initialized_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `newsletter_sends` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`send_key` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`provider_id` text,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_sends_send_key_unique` ON `newsletter_sends` (`send_key`);