import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("database revision guard rejects a publication snapshot changed by a late reaction", async () => {
  const migrationNames = (await readdir(new URL("drizzle/", root)))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  assert.ok(migrationNames.length >= 4, "expected a context-revision migration");

  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const name of migrationNames) {
    const sql = await readFile(new URL(`drizzle/${name}`, root), "utf8");
    database.exec(sql.replaceAll("--> statement-breakpoint", ""));
  }

  database.prepare(`
    INSERT INTO profiles (
      id, owner_email, masthead, language, timezone, publication_time, preferences, updated_at
    ) VALUES (1, 'owner@example.com', 'Daily', 'en', 'UTC', '00:00', '{}', 1)
  `).run();
  const profileRevision = database.prepare("SELECT revision FROM agent_state WHERE id = 1").get().revision;
  assert.equal(profileRevision, 1);

  database.prepare("UPDATE agent_state SET revision = revision + 1 WHERE id = 1 AND revision = ?").run(profileRevision);
  database.prepare(`
    INSERT INTO editions (
      id, local_date, bundle_key, manifest, status, is_current, published_at, context_revision
    ) VALUES ('edition-1', '2026-07-19', 'one.json', '{}', 'published', 1, 1, ?)
  `).run(profileRevision);
  database.prepare(`
    INSERT INTO reactions (edition_id, story_id, action, created_at)
    VALUES ('edition-1', 'story-1', 'love', 2)
  `).run();

  const publishedRevision = profileRevision + 1;
  database.prepare("UPDATE agent_state SET revision = revision + 1 WHERE id = 1 AND revision = ?").run(publishedRevision);

  assert.throws(
    () => database.prepare(`
      INSERT INTO editions (
        id, local_date, bundle_key, manifest, status, is_current, published_at, context_revision
      ) VALUES ('stale-edition', '2026-07-20', 'stale.json', '{}', 'published', 0, 2, ?)
    `).run(publishedRevision),
    /stale agent context/i,
  );

  const currentRevision = database.prepare("SELECT revision FROM agent_state WHERE id = 1").get().revision;
  assert.equal(currentRevision, publishedRevision + 1);
  database.prepare("UPDATE agent_state SET revision = revision + 1 WHERE id = 1 AND revision = ?").run(currentRevision);
  database.prepare(`
    INSERT INTO editions (
      id, local_date, bundle_key, manifest, status, is_current, published_at, context_revision
    ) VALUES ('edition-2', '2026-07-20', 'two.json', '{}', 'published', 0, 2, ?)
  `).run(currentRevision);

  database.prepare("UPDATE editions SET is_current = 0 WHERE id = 'edition-1' AND is_current = 1").run();
  database.prepare("UPDATE editions SET is_current = 1 WHERE id = 'edition-2' AND is_current = 0").run();
  const editionTwoRevision = currentRevision + 1;
  database.prepare("UPDATE agent_state SET revision = revision + 1 WHERE id = 1 AND revision = ?").run(editionTwoRevision);
  database.prepare(`
    INSERT INTO editions (
      id, local_date, bundle_key, manifest, status, is_current, published_at, context_revision
    ) VALUES ('edition-3', '2026-07-21', 'three.json', '{}', 'published', 0, 3, ?)
  `).run(editionTwoRevision);
  database.prepare("UPDATE editions SET is_current = 0 WHERE id = 'edition-2' AND is_current = 1").run();
  database.prepare("UPDATE editions SET is_current = 1 WHERE id = 'edition-3' AND is_current = 0").run();

  const revisionBeforeStaleRestore = database.prepare("SELECT revision FROM agent_state WHERE id = 1").get().revision;
  assert.throws(() => {
    database.exec("BEGIN");
    try {
      database.prepare("UPDATE agent_state SET revision = revision + 1 WHERE id = 1").run();
      database.prepare("UPDATE editions SET is_current = 0 WHERE id = 'edition-2' AND is_current = 1").run();
      database.prepare("UPDATE editions SET is_current = 1 WHERE id = 'edition-1' AND is_current = 0").run();
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }, /current edition changed/i);
  assert.equal(database.prepare("SELECT id FROM editions WHERE is_current = 1").get().id, "edition-3");
  assert.equal(database.prepare("SELECT revision FROM agent_state WHERE id = 1").get().revision, revisionBeforeStaleRestore);
});
