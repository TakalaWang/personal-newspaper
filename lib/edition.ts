export type StoryLabel = "fact" | "inference";

export type EditionPage = {
  id: string;
  section: string;
  html: string;
  css?: string;
};

export type EditionStory = {
  id: string;
  pageId: string;
  kicker: string;
  headline: string;
  dek: string;
  summaryHtml: string;
  bodyHtml: string;
  label: StoryLabel;
  sourceIds: string[];
  editorial: EditorialSignals;
  claims: EditionClaim[];
  images: EditionImage[];
};

export type EditorialSignals = {
  topics: string[];
  preferenceTags: PreferenceTag[];
  format: "brief" | "report" | "analysis" | "explainer";
  depth: "quick" | "standard" | "deep";
  style: "breaking" | "contextual" | "technical" | "narrative" | "investigative";
  importance: "lead" | "secondary" | "brief";
};

export type PreferenceTag =
  | "technology"
  | "science"
  | "business"
  | "culture"
  | "arts"
  | "entertainment"
  | "sports"
  | "games"
  | "world"
  | "local"
  | "environment"
  | "education"
  | "design"
  | "media"
  | "society"
  | "history"
  | "lifestyle"
  | "travel"
  | "food"
  | "books"
  | "film"
  | "music";

export type EditionClaim = {
  id: string;
  summaryClaim: string;
  bodySupport: string;
  sourceIds: string[];
};

export type EditionImage = {
  src: string;
  sourceId: string;
  creator: string;
  publishedDate: string;
  alt: string;
  caption: string;
  credit: string;
  usageBasis: string;
};

export type EditionSource = {
  id: string;
  url: string;
  title: string;
  publisher: string;
  publishedDate: string | null;
  eventDate: string | null;
  retrievedAt: string;
};

export type EditionBundle = {
  id: string;
  date: string;
  language: string;
  masthead: string;
  generation: EditionGeneration;
  pages: EditionPage[];
  stories: EditionStory[];
  sources: EditionSource[];
};

export type EditionGeneration = {
  basedOnEditionId: string | null;
  contextVersion: string;
  contextRevision: number;
  reactions: Array<{
    id: number;
    action: "love" | "less";
    createdAt: string;
  }>;
};

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const LANGUAGE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CONTEXT_VERSION = /^ctx_[0-9a-f]{64}$/;
const PREFERENCE_TAGS = [
  "technology", "science", "business", "culture", "arts", "entertainment", "sports", "games", "world",
  "local", "environment", "education", "design", "media", "society", "history", "lifestyle", "travel",
  "food", "books", "film", "music",
] as const satisfies readonly PreferenceTag[];
const UNSAFE_CSS = /@import\b|\burl\s*\(|(?:-webkit-)?image-set\s*\(|(?:https?|data)\s*:|(?:^|[;{])\s*content\s*:|\bexpression\s*\(|\bbehavior\s*:|java[\u0000-\u0020]*script\s*:|<\/?\s*(?:style|script)\b/i;
const PAGE_ELEMENTS = new Set(["main", "section", "article", "div"]);
const FORBIDDEN_ELEMENTS = new Set([
  "script", "style", "form", "iframe", "frame", "frameset", "embed", "object", "base", "link", "meta",
  "svg", "image", "picture", "source", "video", "audio",
]);
const EVENT_ATTRIBUTE = /(?:^|[\s/])on[\w:-]+\s*=/i;
const STORY_ATTRIBUTE = /(?:^|[\s/])data-story-id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
const URL_ATTRIBUTE = /(?:^|[\s/])(?:href|src|action|formaction|poster|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
const STYLE_ATTRIBUTE = /(?:^|[\s/])style\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
const REMOTE_VARIANT_ATTRIBUTE = /(?:^|[\s/])(?:srcset|imagesrcset)\s*=/i;
const COMMENT = /<!--[\s\S]*?-->/g;

export function validateEditionBundle(
  value: unknown,
  { requireEditorialExpansion = true }: { requireEditorialExpansion?: boolean } = {},
): EditionBundle {
  const bundle = record(value, "edition bundle");
  const id = identifier(bundle.id, "edition id");
  const date = localDate(bundle.date);
  const language = text(bundle.language, "language");
  const masthead = text(bundle.masthead, "masthead");
  const generation = generationInput(bundle.generation);

  if (!LANGUAGE.test(language)) {
    fail("language must be a BCP 47 language tag");
  }

  const pages = pageList(bundle.pages);
  const sources = sourceList(bundle.sources);
  const stories = storyList(
    bundle.stories,
    new Set(sources.map((source) => source.id)),
    new Set(pages.map((page) => page.id)),
    requireEditorialExpansion,
  );
  assertStoryPlacement(pages, stories);

  return { id, date, language, masthead, generation, pages, stories, sources };
}

function generationInput(value: unknown): EditionGeneration {
  const input = record(value, "generation");
  const basedOnEditionId = input.basedOnEditionId === null
    ? null
    : identifier(input.basedOnEditionId, "generation.basedOnEditionId");
  const contextVersion = text(input.contextVersion, "generation.contextVersion");
  if (!CONTEXT_VERSION.test(contextVersion)) fail("generation.contextVersion must be a context snapshot id");
  if (!Number.isSafeInteger(input.contextRevision) || (input.contextRevision as number) < 0) {
    fail("generation.contextRevision must be a nonnegative integer");
  }
  const contextRevision = input.contextRevision as number;
  const reactions = list(input.reactions, "generation.reactions").map((reaction, index) => {
    const item = record(reaction, `generation.reactions[${index}]`);
    if (!Number.isSafeInteger(item.id) || (item.id as number) < 1) {
      fail(`generation.reactions[${index}].id must be a positive integer`);
    }
    const action = oneOf(item.action, ["love", "less"] as const, `generation.reactions[${index}].action`);
    const createdAt = text(item.createdAt, `generation.reactions[${index}].createdAt`);
    if (!isIsoInstant(createdAt)) fail(`generation.reactions[${index}].createdAt must be an ISO timestamp`);
    return { id: item.id as number, action, createdAt };
  });
  if (new Set(reactions.map((reaction) => reaction.id)).size !== reactions.length) {
    fail("generation contains duplicate reaction ids");
  }
  return { basedOnEditionId, contextVersion, contextRevision, reactions };
}

export function renderStorySummary(story: EditionStory): string {
  return `<div class="tag">${escapeHtml(story.kicker)}</div><h2>${escapeHtml(story.headline)}</h2><p class="dek">${escapeHtml(story.dek)}</p>${story.summaryHtml}`;
}

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function pageList(value: unknown): EditionPage[] {
  const pages = list(value, "pages");
  if (pages.length === 0) fail("pages must not be empty");

  const ids = new Set<string>();
  return pages.map((page, index) => {
    const input = record(page, `pages[${index}]`);
    const id = identifier(input.id, `pages[${index}].id`);
    if (ids.has(id)) fail(`duplicate page id: ${id}`);
    ids.add(id);

    const section = text(input.section, `pages[${index}].section`);
    const html = text(input.html, `pages[${index}].html`);
    const css = input.css === undefined ? undefined : text(input.css, `pages[${index}].css`);
    assertSafeMarkup(html, `pages[${index}].html`, "page");
    assertNoLinks(html, `pages[${index}].html`);
    if (normalizeText(plainText(html)) !== "") {
      fail(`pages[${index}].html must contain layout only; canonical story prose is reader-injected`);
    }
    if (css !== undefined) assertSafeCss(css, `pages[${index}].css`);
    return css === undefined ? { id, section, html } : { id, section, html, css };
  });
}

function sourceList(value: unknown): EditionSource[] {
  const sources = list(value, "sources");
  if (sources.length === 0) fail("sources must not be empty");

  const ids = new Set<string>();
  return sources.map((source, index) => {
    const input = record(source, `sources[${index}]`);
    const id = identifier(input.id, `sources[${index}].id`);
    if (ids.has(id)) fail(`duplicate source id: ${id}`);
    ids.add(id);

    const url = httpsUrl(input.url, `sources[${index}].url`);
    const title = text(input.title, `sources[${index}].title`);
    const publisher = text(input.publisher, `sources[${index}].publisher`);
    const publishedDate = nullableDate(input.publishedDate, `sources[${index}].publishedDate`);
    const eventDate = nullableDate(input.eventDate, `sources[${index}].eventDate`);
    const retrievedAt = requiredDate(input.retrievedAt, `sources[${index}].retrievedAt`);
    return { id, url, title, publisher, publishedDate, eventDate, retrievedAt };
  });
}

function storyList(
  value: unknown,
  sourceIds: Set<string>,
  pageIds: Set<string>,
  requireEditorialExpansion: boolean,
): EditionStory[] {
  const stories = list(value, "stories");
  if (stories.length === 0) fail("stories must not be empty");

  const ids = new Set<string>();
  return stories.map((story, index) => {
    const input = record(story, `stories[${index}]`);
    const id = identifier(input.id, `stories[${index}].id`);
    if (ids.has(id)) fail(`duplicate story id: ${id}`);
    ids.add(id);
    const pageId = identifier(input.pageId, `stories[${index}].pageId`);
    if (!pageIds.has(pageId)) fail(`stories[${index}].pageId references an unknown page`);

    if (input.label !== "fact" && input.label !== "inference") {
      fail(`stories[${index}].label must be \"fact\" or \"inference\"`);
    }

    const idsForStory = list(input.sourceIds, `stories[${index}].sourceIds`);
    if (idsForStory.length === 0) fail(`stories[${index}].sourceIds must not be empty`);
    const sourceIdsForStory = idsForStory.map((sourceId, sourceIndex) =>
      identifier(sourceId, `stories[${index}].sourceIds[${sourceIndex}]`),
    );
    if (new Set(sourceIdsForStory).size !== sourceIdsForStory.length) {
      fail(`stories[${index}].sourceIds must not contain duplicates`);
    }
    for (const sourceId of sourceIdsForStory) {
      if (!sourceIds.has(sourceId)) {
        fail(`stories[${index}] references unknown source id: ${sourceId}`);
      }
    }

    const kicker = text(input.kicker, `stories[${index}].kicker`);
    const headline = text(input.headline, `stories[${index}].headline`);
    const dek = text(input.dek, `stories[${index}].dek`);
    const summaryHtml = text(input.summaryHtml, `stories[${index}].summaryHtml`);
    const bodyHtml = text(input.bodyHtml, `stories[${index}].bodyHtml`);
    assertSafeMarkup(summaryHtml, `stories[${index}].summaryHtml`, "story");
    assertNoLinks(summaryHtml, `stories[${index}].summaryHtml`);
    assertSubstantiveHtml(summaryHtml, `stories[${index}].summaryHtml`, 80, 1);
    assertSafeMarkup(bodyHtml, `stories[${index}].bodyHtml`, "story");
    assertNoLinks(bodyHtml, `stories[${index}].bodyHtml`);
    assertSubstantiveHtml(bodyHtml, `stories[${index}].bodyHtml`, 240, 2);
    const editorial = editorialSignals(input.editorial, `stories[${index}].editorial`);
    const summaryClaims = claimElements(summaryHtml, `stories[${index}].summaryHtml`, true);
    const bodyClaims = claimElements(bodyHtml, `stories[${index}].bodyHtml`, false);
    const claims = claimList(
      input.claims,
      `stories[${index}].claims`,
      new Set(sourceIdsForStory),
      summaryClaims,
      bodyClaims,
    );
    if (requireEditorialExpansion) {
      assertDetailedExpansion(summaryHtml, bodyHtml, claims, `stories[${index}].bodyHtml`);
    }
    const images = imageList(input.images, `stories[${index}].images`, new Set(sourceIdsForStory));
    assertRenderedImages(`${summaryHtml}${bodyHtml}`, images, `stories[${index}]`);
    return {
      id,
      pageId,
      kicker,
      headline,
      dek,
      summaryHtml,
      bodyHtml,
      label: input.label,
      sourceIds: sourceIdsForStory,
      editorial,
      claims,
      images,
    };
  });
}

function editorialSignals(value: unknown, path: string): EditorialSignals {
  const input = record(value, path);
  const topics = list(input.topics, `${path}.topics`).map((topic, index) => text(topic, `${path}.topics[${index}]`));
  if (topics.length === 0 || new Set(topics).size !== topics.length) fail(`${path}.topics must contain unique values`);
  const preferenceTags = list(input.preferenceTags, `${path}.preferenceTags`).map((tag, index) =>
    oneOf(tag, PREFERENCE_TAGS, `${path}.preferenceTags[${index}]`),
  );
  if (preferenceTags.length === 0 || new Set(preferenceTags).size !== preferenceTags.length) {
    fail(`${path}.preferenceTags must contain unique non-sensitive taxonomy values`);
  }
  const format = oneOf(input.format, ["brief", "report", "analysis", "explainer"] as const, `${path}.format`);
  const depth = oneOf(input.depth, ["quick", "standard", "deep"] as const, `${path}.depth`);
  const style = oneOf(input.style, ["breaking", "contextual", "technical", "narrative", "investigative"] as const, `${path}.style`);
  const importance = oneOf(input.importance, ["lead", "secondary", "brief"] as const, `${path}.importance`);
  return { topics, preferenceTags, format, depth, style, importance };
}

function claimList(
  value: unknown,
  path: string,
  storySourceIds: Set<string>,
  printedClaims: Map<string, string>,
  detailedClaims: Map<string, string>,
): EditionClaim[] {
  const claims = list(value, path);
  if (claims.length === 0) fail(`${path} must not be empty`);
  const ids = new Set<string>();
  const parsedClaims = claims.map((claim, index) => {
    const input = record(claim, `${path}[${index}]`);
    const id = identifier(input.id, `${path}[${index}].id`);
    if (ids.has(id)) fail(`${path} contains duplicate claim id: ${id}`);
    ids.add(id);
    const summaryClaim = text(input.summaryClaim, `${path}[${index}].summaryClaim`);
    const bodySupport = text(input.bodySupport, `${path}[${index}].bodySupport`);
    const normalizedSummary = normalizeText(summaryClaim);
    const normalizedSupport = normalizeText(bodySupport);
    if ([...normalizedSummary].length < 30) fail(`${path}[${index}].summaryClaim must be a complete statement`);
    if (printedClaims.get(id) !== normalizedSummary) fail(`${path}[${index}].summaryClaim must exactly match its printed claim element`);
    if (detailedClaims.get(id) !== normalizedSupport) fail(`${path}[${index}].bodySupport must exactly match its detailed claim element`);
    const sourceIds = list(input.sourceIds, `${path}[${index}].sourceIds`).map((sourceId, sourceIndex) =>
      identifier(sourceId, `${path}[${index}].sourceIds[${sourceIndex}]`),
    );
    if (sourceIds.length === 0) fail(`${path}[${index}].sourceIds must not be empty`);
    for (const sourceId of sourceIds) {
      if (!storySourceIds.has(sourceId)) fail(`${path}[${index}] references a source outside the story`);
    }
    return { id, summaryClaim, bodySupport, sourceIds };
  });
  const parsedIds = new Set(parsedClaims.map((claim) => claim.id));
  for (const id of printedClaims.keys()) {
    if (!parsedIds.has(id)) fail(`${path} is missing the printed claim id: ${id}`);
  }
  for (const id of detailedClaims.keys()) {
    if (!parsedIds.has(id)) fail(`${path} has an unknown detailed claim id: ${id}`);
  }
  if (parsedIds.size !== printedClaims.size) fail(`${path} must map every printed claim exactly once`);
  return parsedClaims;
}

function claimElements(html: string, path: string, requireEveryParagraph: boolean): Map<string, string> {
  const claims = new Map<string, string>();
  const markup = tagsOnly(html);
  for (const tag of openingTags(markup)) {
    const [, tagName] = /^<([A-Za-z][\w:-]*)/i.exec(tag[0]) ?? [];
    if (tagName?.toLowerCase() !== "p") continue;
    const claimId = attributeValue(tag[0], "data-claim-id");
    if (!claimId) {
      if (requireEveryParagraph) fail(`${path} paragraphs must declare a claim id`);
      continue;
    }
    if (!ID.test(claimId)) fail(`${path} contains an invalid claim id`);
    if (claims.has(claimId)) fail(`${path} contains a duplicate claim id: ${claimId}`);
    const contentStart = (tag.index ?? 0) + tag[0].length;
    const closing = /<\/p\s*>/gi;
    closing.lastIndex = contentStart;
    const close = closing.exec(markup);
    if (!close) fail(`${path} claim ${claimId} is missing its closing paragraph`);
    claims.set(claimId, normalizeText(plainText(markup.slice(contentStart, close.index))));
  }
  return claims;
}

function assertDetailedExpansion(summaryHtml: string, bodyHtml: string, claims: EditionClaim[], path: string) {
  const summary = normalizeText(plainText(summaryHtml));
  const detail = normalizeText(plainText(bodyHtml));
  let newReporting = detail;
  for (const claim of claims) {
    newReporting = newReporting.replaceAll(normalizeText(claim.summaryClaim), " ");
  }

  const summaryLength = [...summary].length;
  const detailLength = [...detail].length;
  const newReportingLength = [...normalizeText(newReporting)].length;
  if (detailLength < summaryLength + 160 || newReportingLength < 140) {
    fail(`${path} bodySupport must add material new reporting beyond the same printed claim`);
  }
}

export function renderStoryDetail(story: Pick<EditionStory, "bodyHtml" | "claims">): string {
  const repeatedClaimIds = new Set(
    story.claims
      .filter((claim) => normalizeText(claim.bodySupport) === normalizeText(claim.summaryClaim))
      .map((claim) => claim.id),
  );
  if (repeatedClaimIds.size === 0) return story.bodyHtml;

  return story.bodyHtml.replace(/<p\b[^>]*>[\s\S]*?<\/p\s*>/gi, (paragraph) => {
    const openingTag = /^<p\b[^>]*>/i.exec(paragraph)?.[0];
    const claimId = openingTag ? attributeValue(openingTag, "data-claim-id") : undefined;
    return claimId && repeatedClaimIds.has(claimId) ? "" : paragraph;
  });
}

function imageList(value: unknown, path: string, storySourceIds: Set<string>): EditionImage[] {
  const images = list(value, path);
  const sources = new Set<string>();
  return images.map((image, index) => {
    const input = record(image, `${path}[${index}]`);
    const src = httpsUrl(input.src, `${path}[${index}].src`);
    if (sources.has(src)) fail(`${path} contains a duplicate image src`);
    sources.add(src);
    const sourceId = identifier(input.sourceId, `${path}[${index}].sourceId`);
    if (!storySourceIds.has(sourceId)) fail(`${path}[${index}].sourceId must belong to the story`);
    return {
      src,
      sourceId,
      creator: text(input.creator, `${path}[${index}].creator`),
      publishedDate: requiredDate(input.publishedDate, `${path}[${index}].publishedDate`),
      alt: text(input.alt, `${path}[${index}].alt`),
      caption: text(input.caption, `${path}[${index}].caption`),
      credit: text(input.credit, `${path}[${index}].credit`),
      usageBasis: text(input.usageBasis, `${path}[${index}].usageBasis`),
    };
  });
}

function assertRenderedImages(html: string, images: EditionImage[], path: string) {
  const declared = new Map(images.map((image) => [image.src, image]));
  const rendered = new Set<string>();
  const readable = normalizeText(plainText(html));
  for (const match of tagsOnly(html).matchAll(/<img(?=[\s/>])(?:(?:"[^"]*")|(?:'[^']*')|[^>"'])*>/gi)) {
    const src = attributeValue(match[0], "src");
    const alt = attributeValue(match[0], "alt");
    if (!src || !declared.has(src)) fail(`${path} contains an image without an image manifest entry`);
    const image = declared.get(src)!;
    if (alt !== image.alt) fail(`${path} image alt must match its image manifest entry`);
    if (!readable.includes(normalizeText(image.caption)) || !readable.includes(normalizeText(image.credit))) {
      fail(`${path} image caption and credit must be rendered with the image`);
    }
    rendered.add(src);
  }
  for (const src of declared.keys()) {
    if (!rendered.has(src)) fail(`${path} image manifest contains an image that is not rendered`);
  }
}

function assertStoryPlacement(pages: EditionPage[], stories: EditionStory[]) {
  const placements = new Map<string, { count: number; pageId: string }>();
  for (const page of pages) {
    const markup = tagsOnly(page.html);
    for (const tag of openingTags(markup)) {
      const attribute = tag[0].match(STORY_ATTRIBUTE);
      if (!attribute) continue;
      const [, tagName] = /^<([A-Za-z][\w:-]*)/i.exec(tag[0]) ?? [];
      if (tagName?.toLowerCase() !== "article") fail("printed story placements must use article elements");
      assertEmptyStoryArticle(markup, tag);
      const storyId = decodeEntities(attribute[1] ?? attribute[2] ?? attribute[3]);
      const placement = placements.get(storyId);
      placements.set(storyId, { count: (placement?.count ?? 0) + 1, pageId: page.id });
    }
    const pageText = normalizeText(plainText(page.html));
    for (const story of stories.filter((candidate) => candidate.pageId === page.id)) {
      const canonicalText = [story.headline, story.dek, ...story.claims.map((claim) => claim.summaryClaim)];
      if (canonicalText.some((value) => pageText.includes(normalizeText(value)))) {
        fail(`pages containing story ${story.id} must not duplicate canonical story content`);
      }
    }
  }

  const knownStoryIds = new Set(stories.map((story) => story.id));
  for (const storyId of placements.keys()) {
    if (!knownStoryIds.has(storyId)) fail(`element references unknown story id: ${storyId}`);
  }
  for (const story of stories) {
    const placement = placements.get(story.id);
    const count = placement?.count ?? 0;
    if (count !== 1) fail(`story ${story.id} must appear exactly once; found ${count} times`);
    if (placement?.pageId !== story.pageId) fail(`story ${story.id} must appear on page ${story.pageId}`);
  }
}

function assertEmptyStoryArticle(html: string, openingTag: RegExpMatchArray) {
  const contentStart = (openingTag.index ?? 0) + openingTag[0].length;
  const closingTag = /<\/article\s*>/gi;
  closingTag.lastIndex = contentStart;
  const closing = closingTag.exec(html);
  if (!closing) fail("printed story article is missing its closing tag");
  if (html.slice(contentStart, closing.index).trim() !== "") {
    fail("printed story article must be empty; the reader injects canonical story content");
  }
}

function assertSafeMarkup(html: string, path: string, kind: "page" | "story") {
  const markup = html.replace(COMMENT, "");
  for (const tag of openingTags(markup)) {
    assertSafeTag(tag[0], path, kind);
  }
}

function assertSafeCss(css: string, path: string) {
  if (UNSAFE_CSS.test(decodeCss(css))) fail(`${path} contains unsafe CSS`);
}

function assertNoLinks(html: string, path: string) {
  for (const tag of openingTags(tagsOnly(html))) {
    if (/^<a(?:\s|>)/i.test(tag[0])) fail(`${path} must not contain links; sources appear in article detail`);
  }
}

function assertSubstantiveHtml(html: string, path: string, minimumCharacters: number, minimumParagraphs: number) {
  const markup = tagsOnly(html);
  const paragraphCount = [...openingTags(markup)].filter((tag) => /^<p(?:\s|>)/i.test(tag[0])).length;
  const plainText = decodeEntities(markup.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  if (paragraphCount < minimumParagraphs || [...plainText].length < minimumCharacters) {
    fail(`${path} must contain substantive editorial content`);
  }
}

function assertSafeTag(tag: string, path: string, kind: "page" | "story") {
  const [, name] = /^<([A-Za-z][\w:-]*)/i.exec(tag) ?? [];
  if (!name) return;
  const element = name.toLowerCase();
  if (kind === "page" && !PAGE_ELEMENTS.has(element)) fail(`${path} contains a non-layout HTML element`);
  if (FORBIDDEN_ELEMENTS.has(element) || (kind === "page" && element === "img")) {
    fail(`${path} contains a forbidden HTML element`);
  }
  if (EVENT_ATTRIBUTE.test(tag)) fail(`${path} contains an unsafe event attribute`);
  if (REMOTE_VARIANT_ATTRIBUTE.test(tag)) fail(`${path} contains a forbidden remote asset variant`);

  for (const attribute of tag.matchAll(URL_ATTRIBUTE)) {
    if (isJavascriptUrl(attribute[1] ?? attribute[2] ?? attribute[3])) {
      fail(`${path} contains an unsafe javascript: URL`);
    }
    if (kind === "page" || element !== "img") fail(`${path} contains a forbidden remote asset fetch`);
  }
  for (const attribute of tag.matchAll(STYLE_ATTRIBUTE)) {
    assertSafeCss(attribute[1] ?? attribute[2] ?? attribute[3], path);
  }
}

function isJavascriptUrl(value: string): boolean {
  return decodeEntities(value).replace(/[\u0000-\u0020]+/g, "").toLowerCase().startsWith("javascript:");
}

function openingTags(html: string): IterableIterator<RegExpMatchArray> {
  return html.matchAll(/<([A-Za-z][\w:-]*)(?=[\s/>])(?:(?:"[^"]*")|(?:'[^']*')|[^>"'])*>/gi);
}

function tagsOnly(html: string): string {
  return html.replace(COMMENT, "");
}

function localDate(value: unknown): string {
  const date = text(value, "date");
  if (!isDate(date)) {
    fail("date must be a valid YYYY-MM-DD local date");
  }
  return date;
}

function requiredDate(value: unknown, path: string): string {
  const date = text(value, path);
  if (!isDate(date)) fail(`${path} must be a valid YYYY-MM-DD date`);
  return date;
}

function nullableDate(value: unknown, path: string): string | null {
  if (value === null) return null;
  return requiredDate(value, path);
}

function isDate(value: string): boolean {
  return DATE.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function isIsoInstant(value: string): boolean {
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function httpsUrl(value: unknown, path: string): string {
  const url = text(value, path);
  try {
    if (new URL(url).protocol !== "https:") fail(`${path} must be an HTTPS URL`);
  } catch {
    fail(`${path} must be an HTTPS URL`);
  }
  return url;
}

function oneOf<const T extends readonly string[]>(value: unknown, choices: T, path: string): T[number] {
  if (typeof value !== "string" || !choices.includes(value)) fail(`${path} must be one of: ${choices.join(", ")}`);
  return value as T[number];
}

function attributeValue(tag: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\u0060]+))`, "i").exec(tag);
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3]) : null;
}

function plainText(html: string): string {
  return decodeEntities(tagsOnly(html).replace(/<[^>]+>/g, " "));
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function identifier(value: unknown, path: string): string {
  const id = text(value, path);
  if (!ID.test(id)) fail(`${path} must use only letters, numbers, underscores, and hyphens`);
  return id;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${path} must be a non-empty string`);
  return value;
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(`${path} must be an array`);
  return value;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function decodeEntities(value: string): string {
  return value.replace(/&(colon|tab|newline|amp|quot|apos|lt|gt);/gi, (_, entity: string) => {
    const replacements: Record<string, string> = {
      colon: ":",
      tab: "\n",
      newline: "\n",
      amp: "&",
      quot: '"',
      apos: "'",
      lt: "<",
      gt: ">",
    };
    return replacements[entity.toLowerCase()];
  }).replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi, (_, hex: string | undefined, decimal: string | undefined) => {
    const digits = hex ?? decimal;
    if (!digits) return "";
    const codePoint = Number.parseInt(digits, hex ? 16 : 10);
    return codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : "";
  });
}

function decodeCss(value: string): string {
  return decodeEntities(value)
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : "";
    })
    .replace(/\\([\s\S])/g, "$1");
}

function fail(message: string): never {
  throw new Error(`Invalid edition bundle: ${message}`);
}
