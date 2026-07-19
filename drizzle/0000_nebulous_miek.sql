CREATE TABLE `editions` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`bundle_key` text NOT NULL,
	`manifest` text NOT NULL,
	`status` text NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`published_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`masthead` text NOT NULL,
	`language` text NOT NULL,
	`timezone` text NOT NULL,
	`publication_time` text NOT NULL,
	`preferences` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "profiles_single_owner" CHECK("profiles"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` text NOT NULL,
	`story_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL,
	`consumed_at` integer,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shares` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`edition_id` text NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shares_token_hash_unique` ON `shares` (`token_hash`);