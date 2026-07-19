import assert from "node:assert/strict";
import test from "node:test";
import { validateEditionBundle } from "../lib/edition.ts";

const validBundle = {
  id: "daily-2026-07-19",
  date: "2026-07-19",
  language: "zh-Hant-TW",
  masthead: "光譜日報",
  pages: [
    {
      id: "front-page",
      html: '<article data-story-id="ai-policy"><h1>AI policy shifts</h1></article>',
      css: ".lead { color: #111; }",
    },
  ],
  stories: [
    { id: "ai-policy", label: "fact", sourceIds: ["reuters-ai"] },
  ],
  sources: [
    {
      id: "reuters-ai",
      url: "https://www.reuters.com/technology/example",
    },
  ],
};

function bundleWith(
  page: Partial<(typeof validBundle.pages)[number]>,
) {
  return {
    ...validBundle,
    pages: [{ ...validBundle.pages[0], ...page }],
  };
}

test("accepts a complete multi-page edition bundle", () => {
  assert.deepEqual(validateEditionBundle(validBundle), validBundle);
});

test("rejects executable HTML and unsafe CSS", () => {
  const unsafePages = [
    { html: '<script>alert(1)</script><article data-story-id="ai-policy"></article>' },
    { html: '<article data-story-id="ai-policy" onclick="alert(1)"></article>' },
    { html: '<svg/onload="alert(1)"></svg><article data-story-id="ai-policy"></article>' },
    { html: '<form><article data-story-id="ai-policy"></article></form>' },
    { html: '<article data-story-id="ai-policy"><a href="javascript:alert(1)">x</a></article>' },
    { html: '<style>.lead { background: url(https://example.com/image.png); }</style><article data-story-id="ai-policy"></article>' },
    { css: '@import url("https://example.com/style.css");' },
    { css: ".lead { background: url(https://example.com/image.png); }" },
    { css: ".lead { background: u\\72l(https://example.com/image.png); }" },
    { css: ".lead { width: expression(alert(1)); }" },
    { css: ".lead { behavior: url(#default#time2); }" },
    { css: ".lead { background: javascript:alert(1); }" },
  ];

  for (const page of unsafePages) {
    assert.throws(() => validateEditionBundle(bundleWith(page)), /unsafe|forbidden/i);
  }
});

test("allows harmless prose that mentions unsafe URL and CSS syntax", () => {
  const bundle = bundleWith({
    html: '<style>.lead { color: #111; }</style><section data-story-id="ai-policy"><p>Never use javascript: URLs or CSS url( values) in untrusted content.</p></section>',
  });

  assert.deepEqual(validateEditionBundle(bundle), bundle);
});

test("requires HTTPS sources", () => {
  const bundle = {
    ...validBundle,
    sources: [{ id: "reuters-ai", url: "http://www.reuters.com/technology/example" }],
  };

  assert.throws(() => validateEditionBundle(bundle), /HTTPS/i);
});

test("accepts only fact and inference story labels", () => {
  const bundle = {
    ...validBundle,
    stories: [{ ...validBundle.stories[0], label: "opinion" }],
  };

  assert.throws(() => validateEditionBundle(bundle), /fact.*inference/i);
});

test("requires every story to have exactly one article placement", () => {
  assert.throws(
    () => validateEditionBundle(bundleWith({ html: "<article>Unmapped</article>" })),
    /ai-policy.*exactly once/i,
  );
  assert.throws(
    () =>
      validateEditionBundle(
        bundleWith({
          html: '<article data-story-id="ai-policy"></article><article data-story-id="ai-policy"></article>',
        }),
      ),
    /ai-policy.*2 times/i,
  );
});

test("maps a story from any element with data-story-id", () => {
  const bundle = bundleWith({ html: '<section data-story-id="ai-policy">Lead story</section>' });

  assert.deepEqual(validateEditionBundle(bundle), bundle);
});
