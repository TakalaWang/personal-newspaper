ALTER TABLE `reactions` ADD `consumed_by_edition_id` text REFERENCES editions(id);--> statement-breakpoint
DELETE FROM `reactions` WHERE `consumed_at` IS NULL;--> statement-breakpoint
DELETE FROM `reactions`
WHERE `id` NOT IN (
  SELECT MAX(`id`) FROM `reactions` GROUP BY `edition_id`, `story_id`
);--> statement-breakpoint
CREATE UNIQUE INDEX `reactions_one_signal_per_story` ON `reactions` (`edition_id`,`story_id`);--> statement-breakpoint
UPDATE `editions`
SET `is_current` = 0
WHERE `is_current` = 1
  AND `id` <> (
    SELECT `id` FROM `editions` WHERE `is_current` = 1 ORDER BY `published_at` DESC LIMIT 1
  );--> statement-breakpoint
CREATE UNIQUE INDEX `editions_one_current` ON `editions` (`is_current`) WHERE "editions"."is_current" = 1;
