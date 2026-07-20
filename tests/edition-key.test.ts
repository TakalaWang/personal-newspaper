import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { serializeEditionBundle } from "../lib/edition-key.ts";
import { validateEditionBundle } from "../lib/edition.ts";

const draft = JSON.parse(
  await readFile(new URL("../skills/codex-reporter/assets/edition-template.json", import.meta.url), "utf8"),
);
const generation = {
  basedOnEditionId: "previous-edition",
  contextVersion: `ctx_${"a".repeat(64)}`,
  contextRevision: 7,
  reactions: [],
};

test("same edition id with different content cannot address the same R2 object", async () => {
  const first = validateEditionBundle({ ...draft, generation });
  const second = validateEditionBundle({
    ...draft,
    generation,
    stories: draft.stories.map((story: Record<string, unknown>, index: number) =>
      index === 0 ? { ...story, headline: `${story.headline}（更新）` } : story,
    ),
  });

  const firstObject = await serializeEditionBundle(first);
  const repeatedObject = await serializeEditionBundle(first);
  const competingObject = await serializeEditionBundle(second);

  assert.equal(firstObject.bundleKey, repeatedObject.bundleKey);
  assert.equal(firstObject.body, repeatedObject.body);
  assert.notEqual(firstObject.bundleKey, competingObject.bundleKey);
  assert.match(firstObject.bundleKey, new RegExp(`^editions/${first.id}/[0-9a-f]{64}\\.json$`));
  assert.equal(JSON.parse(firstObject.body).stories[0].headline, first.stories[0].headline);
  assert.equal(JSON.parse(competingObject.body).stories[0].headline, second.stories[0].headline);
});
