import assert from "node:assert/strict";
import test from "node:test";
import { isAuthorizedAgentRequest, parseProfileUpdate } from "../lib/agent.ts";

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
