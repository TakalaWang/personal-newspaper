import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReactionContext,
  buildPreferenceMemory,
  createAgentContextVersion,
  hashShareToken,
  isPreferenceMemoryReaction,
  isSameOriginRequest,
  parseShareId,
  parseReaction,
  parseReaderMessage,
  resolveShare,
  shareSummary,
} from "../lib/reader.ts";
import type { EditionBundle } from "../lib/edition.ts";
import type { AgentReaction } from "../lib/reader.ts";

test("accepts only known iframe story interactions", () => {
  const storyIds = new Set(["ai-policy"]);

  assert.deepEqual(parseReaderMessage({ type: "open", storyId: "ai-policy" }, storyIds), {
    type: "open",
    storyId: "ai-policy",
  });
  assert.deepEqual(parseReaderMessage({ type: "react", storyId: "ai-policy", action: "love" }, storyIds), {
    type: "react",
    storyId: "ai-policy",
    action: "love",
  });
  assert.deepEqual(parseReaderMessage({ type: "react", storyId: "ai-policy", action: "less" }, storyIds), {
    type: "react",
    storyId: "ai-policy",
    action: "less",
  });
  assert.throws(() => parseReaderMessage({ type: "open", storyId: "missing" }, storyIds), /story/i);
  assert.throws(() => parseReaderMessage({ type: "react", storyId: "ai-policy", action: "follow" }, storyIds), /action/i);
  assert.throws(() => parseReaderMessage({ type: "react", storyId: "ai-policy", action: "delete" }, storyIds), /action/i);
});

test("share tokens are stored as stable SHA-256 hashes", async () => {
  const hash = await hashShareToken("unpredictable-share-token");

  assert.equal(hash, "727871c27cca998698f9af7e583daf3c25f202bbeb2240ab0ecdf886ec85e75b");
  assert.notEqual(hash, "unpredictable-share-token");
});

test("rejects reaction requests from another origin", () => {
  const foreign = new Request("https://paper.example/api/reactions", {
    method: "POST",
    headers: { origin: "https://attacker.example" },
  });
  const local = new Request("https://paper.example/api/reactions", {
    method: "POST",
    headers: { origin: "https://paper.example" },
  });

  assert.equal(isSameOriginRequest(foreign), false);
  assert.equal(isSameOriginRequest(local), true);
});

test("reaction payloads bind supported actions to the displayed edition and story", () => {
  assert.deepEqual(parseReaction({ action: "love", storyId: "ai-policy", editionId: "daily-1" }), {
    action: "love",
    storyId: "ai-policy",
    editionId: "daily-1",
  });
  assert.deepEqual(parseReaction({ action: "less", storyId: "ai-policy", editionId: "daily-1" }), {
    action: "less",
    storyId: "ai-policy",
    editionId: "daily-1",
  });
  assert.throws(() => parseReaction({ action: "follow", storyId: "ai-policy", editionId: "daily-1" }), /action/i);
  assert.throws(() => parseReaction({ action: "bookmark", storyId: "ai-policy", editionId: "daily-1" }), /action/i);
  assert.throws(() => parseReaction({ action: "love", storyId: "", editionId: "daily-1" }), /storyId/i);
  assert.throws(() => parseReaction({ action: "love", storyId: "ai-policy" }), /editionId/i);
  assert.throws(() => parseReaction({ action: "love", storyId: "ai-policy", editionId: "daily-1", extra: true }), /unexpected/i);
});

test("agent reactions carry editorial context for latent preference inference", () => {
  const edition = {
    id: "daily-1",
    pages: [{ id: "front", section: "要聞" }],
    stories: [
      {
        id: "ai-policy",
        pageId: "front",
        kicker: "政策解讀",
        headline: "新的模型規範改變部署方式",
        dek: "開發者需要重新檢查邊界與權限。",
        label: "inference",
        editorial: {
          topics: ["AI 政策", "部署安全"],
          preferenceTags: ["technology", "society"],
          format: "analysis",
          depth: "deep",
          style: "technical",
          importance: "lead",
        },
      },
    ],
  } as EditionBundle;
  const createdAt = new Date("2026-07-19T00:00:00.000Z");

  assert.deepEqual(
    buildReactionContext(
      [
        { id: 1, editionId: "daily-1", storyId: "ai-policy", action: "love", createdAt },
        { id: 2, editionId: "daily-1", storyId: "ai-policy", action: "follow", createdAt },
      ],
      new Map([[edition.id, edition]]),
    ),
    [
      {
        id: 1,
        editionId: "daily-1",
        storyId: "ai-policy",
        action: "love",
        createdAt,
        story: {
          headline: "新的模型規範改變部署方式",
          dek: "開發者需要重新檢查邊界與權限。",
          kicker: "政策解讀",
          pageId: "front",
          section: "要聞",
          label: "inference",
          editorial: {
            topics: ["AI 政策", "部署安全"],
            preferenceTags: ["technology", "society"],
            format: "analysis",
            depth: "deep",
            style: "technical",
            importance: "lead",
          },
        },
      },
    ],
  );
  assert.throws(
    () => buildReactionContext([{ id: 3, editionId: "other", storyId: "ai-policy", action: "love", createdAt }], new Map([[edition.id, edition]])),
    /edition bundle/i,
  );
  assert.throws(
    () => buildReactionContext([{ id: 4, editionId: "daily-1", storyId: "missing", action: "less", createdAt }], new Map([[edition.id, edition]])),
    /story/i,
  );
});

test("pending reactions resolve against their own immutable edition", () => {
  const current = {
    id: "daily-2",
    pages: [{ id: "front", section: "要聞" }],
    stories: [{
      id: "current-story",
      pageId: "front",
      kicker: "今日",
      headline: "Current story",
      dek: "Current dek",
      label: "fact",
      editorial: { topics: ["current"], preferenceTags: ["technology"], format: "report", depth: "quick", style: "breaking", importance: "lead" },
    }],
  } as EditionBundle;
  const previous = {
    ...current,
    id: "daily-1",
    stories: [{
      ...current.stories[0],
      id: "previous-story",
      headline: "Previous story",
      editorial: { ...current.stories[0].editorial, topics: ["previous"] },
    }],
  } as EditionBundle;
  const createdAt = new Date("2026-07-19T00:00:00.000Z");
  const context = buildReactionContext(
    [{ id: 8, editionId: "daily-1", storyId: "previous-story", action: "less", createdAt }],
    new Map([[current.id, current], [previous.id, previous]]),
  );

  assert.equal(context[0].story.headline, "Previous story");
  assert.deepEqual(context[0].story.editorial.topics, ["previous"]);
});

test("consumed reactions retain non-sensitive preference memory", () => {
  const reaction: AgentReaction = {
    id: 1,
    editionId: "daily-1",
    storyId: "ai-policy",
    action: "love" as const,
    createdAt: new Date("2026-07-19T00:00:00.000Z"),
    story: {
      headline: "Policy",
      dek: "Context",
      kicker: "Analysis",
      pageId: "front",
      section: "要聞",
      label: "inference" as const,
      editorial: {
        topics: ["AI policy", "deployment"],
        preferenceTags: ["technology", "society"],
        format: "analysis" as const,
        depth: "deep" as const,
        style: "technical" as const,
        importance: "lead" as const,
      },
    },
  };

  assert.deepEqual(buildPreferenceMemory([reaction]), {
    reactionCount: 1,
    topics: [
      { value: "technology", score: 1, love: 1, less: 0 },
      { value: "society", score: 1, love: 1, less: 0 },
    ],
    formats: [{ value: "analysis", score: 1, love: 1, less: 0 }],
    depths: [{ value: "deep", score: 1, love: 1, less: 0 }],
    styles: [{ value: "technical", score: 1, love: 1, less: 0 }],
    importance: [{ value: "lead", score: 1, love: 1, less: 0 }],
  });
});

test("reactions without a consuming edition stay outside preference memory", () => {
  const unbound = {
    id: 1,
    editionId: "previous-edition",
    storyId: "previous-story",
    action: "love",
    createdAt: new Date("2026-07-18T00:00:00.000Z"),
    consumedAt: new Date("2026-07-19T00:00:00.000Z"),
    consumedByEditionId: null,
  };
  const consumed = { ...unbound, consumedByEditionId: "daily-2" };

  assert.equal(isPreferenceMemoryReaction(unbound), false);
  assert.equal(isPreferenceMemoryReaction(consumed), true);
});

test("agent context version is deterministic and changes with its exact snapshot", async () => {
  const value = {
    profile: { masthead: "光譜日報" },
    contextRevision: 3,
    currentEditionId: "daily-1",
    reactions: [],
    preferenceMemory: { reactionCount: 0, topics: [], formats: [], depths: [], styles: [], importance: [] },
  };
  const first = await createAgentContextVersion(value);
  const second = await createAgentContextVersion(value);
  const changed = await createAgentContextVersion({ ...value, currentEditionId: "daily-2" });
  const changedRevision = await createAgentContextVersion({ ...value, contextRevision: 4 });

  assert.match(first, /^ctx_[0-9a-f]{64}$/);
  assert.equal(first, second);
  assert.notEqual(first, changed);
  assert.notEqual(first, changedRevision);
});

test("public sharing resolves only a live matching capability", () => {
  const shares = [
    { id: 1, tokenHash: "live", editionId: "daily-1", revokedAt: null },
    { id: 2, tokenHash: "revoked", editionId: "daily-2", revokedAt: new Date() },
  ];

  assert.equal(resolveShare(shares, "live")?.editionId, "daily-1");
  assert.equal(resolveShare(shares, "revoked"), undefined);
  assert.equal(resolveShare(shares, "missing"), undefined);
});

test("persisted share rows expose safe metadata and revoke by row id", () => {
  const createdAt = new Date("2026-07-19T00:00:00.000Z");
  assert.deepEqual(
    shareSummary({ id: 9, editionId: "daily-1", tokenHash: "never-return-this", createdAt, revokedAt: null }),
    { id: 9, editionId: "daily-1", createdAt, revokedAt: null },
  );
  assert.equal(parseShareId({ shareId: 9 }), 9);
  assert.throws(() => parseShareId({ shareId: 0 }), /shareId/i);
});
