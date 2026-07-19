import assert from "node:assert/strict";
import test from "node:test";
import { isAuthorizedAgentRequest, parseEditionRestore, parseProfileUpdate } from "../lib/agent.ts";

const profile = {
  ownerEmail: "reader@example.com",
  masthead: "光譜日報",
  language: "zh-Hant-TW",
  timezone: "Asia/Taipei",
  publicationTime: "00:00",
  preferences: { topics: ["AI", "biology"] },
};

test("requires the configured Bearer token for Codex agent requests", () => {
  const request = new Request("https://paper.example/api/agent/context", {
    headers: { authorization: "Bearer secret" },
  });

  assert.equal(isAuthorizedAgentRequest(request, "secret"), true);
  assert.equal(isAuthorizedAgentRequest(request, "other"), false);
  assert.equal(isAuthorizedAgentRequest(request, undefined), false);
});

test("profile updates accept only interview-confirmed fields", () => {
  assert.deepEqual(parseProfileUpdate(profile), profile);
  assert.throws(
    () => parseProfileUpdate({ ...profile, ignored: "do not persist me" }),
    /unexpected field/i,
  );
  assert.throws(
    () => parseProfileUpdate({ ...profile, publicationTime: "25:00" }),
    /publicationTime/i,
  );
});

test("edition restore accepts only an explicit immutable edition id", () => {
  assert.deepEqual(
    parseEditionRestore({ targetEditionId: "2026-07-18-edition", expectedCurrentEditionId: "2026-07-19-edition" }),
    { targetEditionId: "2026-07-18-edition", expectedCurrentEditionId: "2026-07-19-edition" },
  );
  assert.throws(() => parseEditionRestore({ targetEditionId: "", expectedCurrentEditionId: "daily" }), /targetEditionId/i);
  assert.throws(() => parseEditionRestore({ targetEditionId: "daily", expectedCurrentEditionId: "current", force: true }), /unexpected/i);
});
