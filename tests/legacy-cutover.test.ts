import assert from "node:assert/strict";
import test from "node:test";
import { normalizePinnedLegacyEdition } from "../lib/legacy-cutover.ts";

const legacy = JSON.stringify({
  id: "2026-07-19-print-v2",
  date: "2026-07-19",
  language: "zh-Hant-TW",
  masthead: "光譜日報",
  pages: [{
    id: "front",
    section: "今日要聞",
    html: '<main class="paper"><article data-story-id="lead"><h2>Lead</h2><p>Printed report.</p></article></main>',
    css: ".paper{display:grid}",
  }],
  stories: [{
    id: "lead",
    pageId: "front",
    headline: "Lead",
    dek: "Context for the lead.",
    bodyHtml: "<p>A detailed legacy article with enough context for the temporary reader.</p>",
    label: "fact",
    sourceIds: ["source"],
  }],
  sources: [{ id: "source", url: "https://example.com/source" }],
});

test("normalizes only a hash-pinned legacy predecessor for the one-time cutover", async () => {
  const digest = await sha256(legacy);
  const bundle = await normalizePinnedLegacyEdition(legacy, digest);

  assert.equal(bundle.readerMode, "pinned-legacy-cutover");
  assert.equal(bundle.stories[0].editorial.preferenceTags.length, 1);
  assert.match(bundle.pages[0].html, /Printed report/);
  await assert.rejects(() => normalizePinnedLegacyEdition(`${legacy} `, digest), /digest/i);
});

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
