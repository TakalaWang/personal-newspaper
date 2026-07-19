import assert from "node:assert/strict";
import test from "node:test";
import {
  hashShareToken,
  isSameOriginRequest,
  parseShareId,
  parseReaction,
  resolveShare,
  shareSummary,
} from "../lib/reader.ts";

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

test("reaction payloads allow only supported actions and a story id", () => {
  assert.deepEqual(parseReaction({ action: "love", storyId: "ai-policy" }), {
    action: "love",
    storyId: "ai-policy",
  });
  assert.throws(() => parseReaction({ action: "bookmark", storyId: "ai-policy" }), /action/i);
  assert.throws(() => parseReaction({ action: "love", storyId: "" }), /storyId/i);
  assert.throws(() => parseReaction({ action: "love", storyId: "ai-policy", extra: true }), /unexpected/i);
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
