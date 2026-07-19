CREATE TABLE `agent_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "agent_state_singleton" CHECK("agent_state"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE `editions` ADD `context_revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
INSERT INTO `agent_state` (`id`, `revision`) VALUES (1, 0);
--> statement-breakpoint
CREATE TRIGGER `profiles_revision_after_insert`
AFTER INSERT ON `profiles`
BEGIN
	UPDATE `agent_state` SET `revision` = `revision` + 1 WHERE `id` = 1;
END;
--> statement-breakpoint
CREATE TRIGGER `profiles_revision_after_update`
AFTER UPDATE ON `profiles`
BEGIN
	UPDATE `agent_state` SET `revision` = `revision` + 1 WHERE `id` = 1;
END;
--> statement-breakpoint
CREATE TRIGGER `profiles_revision_after_delete`
AFTER DELETE ON `profiles`
BEGIN
	UPDATE `agent_state` SET `revision` = `revision` + 1 WHERE `id` = 1;
END;
--> statement-breakpoint
CREATE TRIGGER `reactions_revision_after_insert`
AFTER INSERT ON `reactions`
BEGIN
	UPDATE `agent_state` SET `revision` = `revision` + 1 WHERE `id` = 1;
END;
--> statement-breakpoint
CREATE TRIGGER `reactions_revision_after_update`
AFTER UPDATE ON `reactions`
BEGIN
	UPDATE `agent_state` SET `revision` = `revision` + 1 WHERE `id` = 1;
END;
--> statement-breakpoint
CREATE TRIGGER `reactions_revision_after_delete`
AFTER DELETE ON `reactions`
BEGIN
	UPDATE `agent_state` SET `revision` = `revision` + 1 WHERE `id` = 1;
END;
--> statement-breakpoint
CREATE TRIGGER `editions_context_revision_guard`
BEFORE INSERT ON `editions`
WHEN
	(SELECT `revision` FROM `agent_state` WHERE `id` = 1) <> NEW.`context_revision` + 1
	OR changes() <> 1
BEGIN
	SELECT RAISE(ABORT, 'stale agent context');
END;
--> statement-breakpoint
CREATE TRIGGER `editions_activation_guard`
BEFORE UPDATE OF `is_current` ON `editions`
WHEN NEW.`is_current` = 1 AND OLD.`is_current` = 0 AND changes() <> 1
BEGIN
	SELECT RAISE(ABORT, 'current edition changed');
END;
