import assert from "node:assert/strict";
import test from "node:test";
import { renderStoryDetail, renderStorySummary, validateEditionBundle } from "../lib/edition.ts";

const validBundle = {
  id: "daily-2026-07-19",
  date: "2026-07-19",
  language: "zh-Hant-TW",
  masthead: "光譜日報",
  generation: {
    basedOnEditionId: "daily-2026-07-18",
    contextVersion: `ctx_${"0".repeat(64)}`,
    contextRevision: 7,
    reactions: [{ id: 7, action: "love", createdAt: "2026-07-19T00:00:00.000Z" }],
  },
  pages: [
    {
      id: "front-page",
      section: "科技",
      html: '<main><article class="lead" data-story-id="ai-policy"></article></main>',
      css: ".lead { color: #111; }",
    },
  ],
  stories: [
    {
      id: "ai-policy",
      pageId: "front-page",
      kicker: "今日焦點・報導",
      headline: "AI policy shifts",
      dek: "The verified context behind today's lead story.",
      summaryHtml: '<p data-claim-id="scope-change">The policy changes which systems are covered, who must document them, and when the new review takes effect. The printed report gives the decision and its immediate consequence without withholding the substance.</p>',
      bodyHtml: '<p data-claim-id="scope-change">The policy changes which systems are covered, who must document them, and when the new review takes effect. The printed report gives the decision and its immediate consequence without withholding the substance. The detailed article begins from this same verified finding.</p><p>It then explains the primary-source evidence, the implementation timeline, the affected teams, and the limits of what has been confirmed. This added context clarifies the printed précis instead of introducing a separate angle or contradicting it.</p>',
      label: "fact",
      sourceIds: ["reuters-ai"],
      editorial: {
        topics: ["AI policy", "software governance"],
        preferenceTags: ["technology", "society"],
        format: "report",
        depth: "standard",
        style: "contextual",
        importance: "lead",
      },
      claims: [
        {
          id: "scope-change",
          summaryClaim: "The policy changes which systems are covered, who must document them, and when the new review takes effect. The printed report gives the decision and its immediate consequence without withholding the substance.",
          bodySupport: "The policy changes which systems are covered, who must document them, and when the new review takes effect. The printed report gives the decision and its immediate consequence without withholding the substance. The detailed article begins from this same verified finding.",
          sourceIds: ["reuters-ai"],
        },
      ],
      images: [],
    },
  ],
  sources: [
    {
      id: "reuters-ai",
      url: "https://www.reuters.com/technology/example",
      title: "Example policy report",
      publisher: "Reuters",
      publishedDate: "2026-07-18",
      eventDate: "2026-07-18",
      retrievedAt: "2026-07-19",
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

test("requires section pages and maps each story to its printed page", () => {
  assert.throws(
    () => validateEditionBundle({ ...validBundle, pages: [{ ...validBundle.pages[0], section: "" }] }),
    /section/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...validBundle.stories[0], pageId: "culture" }] }),
    /pageId/i,
  );
});

test("binds publication to an exact context reaction snapshot", () => {
  assert.throws(
    () => validateEditionBundle({ ...validBundle, generation: { ...validBundle.generation, contextVersion: "stale" } }),
    /contextVersion/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, generation: { ...validBundle.generation, reactions: [{ id: 7, action: "follow", createdAt: "2026-07-19T00:00:00.000Z" }] } }),
    /generation.*action/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, generation: { ...validBundle.generation, reactions: [{ id: 7, action: "love", createdAt: "not-a-date" }] } }),
    /generation.*createdAt/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, generation: { ...validBundle.generation, reactions: [...validBundle.generation.reactions, ...validBundle.generation.reactions] } }),
    /duplicate.*reaction/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, generation: { ...validBundle.generation, contextRevision: -1 } }),
    /contextRevision/i,
  );
});

test("requires a complete clickable article and validates its body", () => {
  const story = validBundle.stories[0];
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...story, dek: "" }] }),
    /dek/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...story, summaryHtml: "<p>Too short.</p>" }] }),
    /summaryHtml/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...story, summaryHtml: '<p>Useful context with an <a href="https://example.com">original link</a> that belongs only in detail.</p>' }] }),
    /summaryHtml.*(?:link|remote asset)/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...story, bodyHtml: "<p>Only one short paragraph.</p>" }] }),
    /bodyHtml/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...story, bodyHtml: "<script>alert(1)</script>" }] }),
    /unsafe|forbidden/i,
  );
});

test("requires machine-checkable editorial signals and claim evidence", () => {
  const story = validBundle.stories[0];
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...story, editorial: undefined }] }),
    /editorial/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...story, claims: [] }] }),
    /claims/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...story, claims: [{ ...story.claims[0], summaryClaim: "A claim absent from the printed summary." }] }] }),
    /summaryClaim/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...story, claims: [{ ...story.claims[0], bodySupport: "Support absent from detailed reporting." }] }] }),
    /bodySupport/i,
  );
  assert.throws(
    () => validateEditionBundle({
      ...validBundle,
      stories: [{
        ...story,
        bodyHtml: '<p data-claim-id="scope-change">An unrelated detailed assertion with enough length to look substantive but no matching printed claim.</p><p>The rest of the detailed article is long enough to pass the general body length requirement, but it does not repair the broken claim mapping between summary and detail.</p>',
        claims: [{ ...story.claims[0], bodySupport: "An unrelated detailed assertion with enough length to look substantive but no matching printed claim." }],
      }],
    }),
    /same printed claim|bodySupport/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...story, summaryHtml: `${story.summaryHtml}<p>An uncovered factual statement that has no claim id and no evidence mapping.</p>` }] }),
    /claim id/i,
  );
});

test("rejects a detailed article that only repeats the printed report", () => {
  const story = validBundle.stories[0];
  const repeated = story.claims[0].summaryClaim;
  assert.throws(
    () => validateEditionBundle({
      ...validBundle,
      stories: [{
        ...story,
        bodyHtml: `<p data-claim-id="scope-change">${repeated}</p><p>${repeated}</p>`,
        claims: [{ ...story.claims[0], bodySupport: repeated }],
      }],
    }),
    /materially expand|new reporting/i,
  );
});

test("reads archived shallow detail while removing its duplicated printed claim from display", () => {
  const story = validBundle.stories[0];
  const repeated = story.claims[0].summaryClaim;
  const archived = {
    ...validBundle,
    stories: [{
      ...story,
      bodyHtml: `<p data-claim-id="scope-change">${repeated}</p><p>The archived report still contains a separate implementation timeline paragraph with enough context for the reader.</p>`,
      claims: [{ ...story.claims[0], bodySupport: repeated }],
    }],
  };

  const parsed = validateEditionBundle(archived, { requireEditorialExpansion: false });
  const detail = renderStoryDetail(parsed.stories[0]);
  assert.ok(!detail.includes(repeated));
  assert.match(detail, /implementation timeline/);
});

test("requires every rendered image to have a source-linked manifest", () => {
  const story = validBundle.stories[0];
  const summaryHtml = `${story.summaryHtml}<figure><img src="https://static.example.com/policy.png" alt="Policy coverage diagram"><figcaption>Systems newly covered by the policy. Credit: Example Agency.</figcaption></figure>`;
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...story, summaryHtml }] }),
    /image manifest/i,
  );

  const images = [{
    src: "https://static.example.com/policy.png",
    sourceId: "reuters-ai",
    creator: "Example Agency",
    publishedDate: "2026-07-18",
    alt: "Policy coverage diagram",
    caption: "Systems newly covered by the policy.",
    credit: "Credit: Example Agency.",
    usageBasis: "Official explanatory figure used with editorial attribution.",
  }];
  const bundle = { ...validBundle, stories: [{ ...story, summaryHtml, images }] };
  assert.deepEqual(validateEditionBundle(bundle), bundle);
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
    { css: "</style><script>alert(1)</script><style>" },
    { css: '.lead::before { content: "unbound story prose"; }' },
    { html: '<img src="https://tracker.example/page.png"><article data-story-id="ai-policy"></article>' },
    { html: `<p>${validBundle.stories[0].headline}</p><article data-story-id="ai-policy"></article>` },
  ];

  for (const page of unsafePages) {
    assert.throws(() => validateEditionBundle(bundleWith(page)), /unsafe|forbidden|layout|duplicate canonical/i);
  }
});

test("rejects undeclared remote asset fetch surfaces", () => {
  const story = validBundle.stories[0];
  const unsafeSummaries = [
    `${story.summaryHtml}<svg><image href="https://tracker.example/a.svg"></image></svg>`,
    `${story.summaryHtml}<figure><img src="https://static.example.com/declared.png" srcset="https://tracker.example/2x.png 2x" alt="Declared image"><figcaption>Declared caption. Declared credit.</figcaption></figure>`,
    `${story.summaryHtml}<picture><source srcset="https://tracker.example/a.webp"><img src="https://static.example.com/declared.png" alt="Declared image"><span>Declared caption. Declared credit.</span></picture>`,
    `${story.summaryHtml}<video src="https://tracker.example/video.mp4"></video>`,
  ];
  const images = [{
    src: "https://static.example.com/declared.png",
    sourceId: "reuters-ai",
    creator: "Example Agency",
    publishedDate: "2026-07-18",
    alt: "Declared image",
    caption: "Declared caption.",
    credit: "Declared credit.",
    usageBasis: "Official explanatory figure used with editorial attribution.",
  }];

  for (const summaryHtml of unsafeSummaries) {
    assert.throws(() => validateEditionBundle({ ...validBundle, stories: [{ ...story, summaryHtml, images }] }), /forbidden|fetch|srcset|manifest/i);
  }
  assert.throws(
    () => validateEditionBundle({ ...validBundle, pages: [{ ...validBundle.pages[0], css: '.lead { background: image-set("https://tracker.example/a.png" 1x); }' }] }),
    /unsafe/i,
  );
  assert.throws(
    () => validateEditionBundle({ ...validBundle, pages: [{ ...validBundle.pages[0], css: '.lead { background: image("https://tracker.example/a.png"); }' }] }),
    /unsafe/i,
  );
});

test("rejects visible page prose outside canonical story placements", () => {
  assert.throws(
    () => validateEditionBundle(bundleWith({ html: '<div>Rewritten story copy outside the canonical article.</div><article data-story-id="ai-policy"></article>' })),
    /layout only/i,
  );
});

test("requires HTTPS sources", () => {
  const bundle = {
    ...validBundle,
    sources: [{ ...validBundle.sources[0], url: "http://www.reuters.com/technology/example" }],
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
    () => validateEditionBundle(bundleWith({ html: "<main></main>" })),
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

test("requires each printed story placement to be an empty article root", () => {
  assert.throws(
    () => validateEditionBundle(bundleWith({ html: '<section data-story-id="ai-policy"></section>' })),
    /article/i,
  );
  assert.throws(
    () => validateEditionBundle(bundleWith({ html: '<article data-story-id="ai-policy"><div></div></article>' })),
    /empty/i,
  );
  assert.throws(
    () => validateEditionBundle(bundleWith({ html: '<article data-story-id="ai-policy"><style>.lead { color: red; }</style></article>' })),
    /empty|forbidden|layout/i,
  );
});

test("detailed body cannot add its own source links", () => {
  const story = validBundle.stories[0];
  assert.throws(
    () => validateEditionBundle({ ...validBundle, stories: [{ ...story, bodyHtml: `${story.bodyHtml}<a href="https://untracked.example">untracked source</a>` }] }),
    /bodyHtml.*(?:link|remote asset)/i,
  );
});

test("renders the printed précis from canonical story fields", () => {
  const story = validateEditionBundle(validBundle).stories[0];
  const summary = renderStorySummary({ ...story, headline: "Policy <change>" });

  assert.match(summary, /今日焦點・報導/);
  assert.match(summary, /Policy &lt;change&gt;/);
  assert.match(summary, /verified context/);
  assert.match(summary, /which systems are covered/);
  assert.doesNotMatch(summary, /implementation timeline/);
});
