export type StoryLabel = "fact" | "inference";

export type EditionPage = {
  id: string;
  html: string;
  css?: string;
};

export type EditionStory = {
  id: string;
  headline?: string;
  label: StoryLabel;
  sourceIds: string[];
};

export type EditionSource = {
  id: string;
  url: string;
};

export type EditionBundle = {
  id: string;
  date: string;
  language: string;
  masthead: string;
  pages: EditionPage[];
  stories: EditionStory[];
  sources: EditionSource[];
};

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const LANGUAGE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UNSAFE_CSS = /@import\b|\burl\s*\(|\bexpression\s*\(|\bbehavior\s*:|java[\u0000-\u0020]*script\s*:/i;
const FORBIDDEN_ELEMENTS = new Set([
  "script", "form", "iframe", "frame", "frameset", "embed", "object", "base", "link", "meta",
]);
const EVENT_ATTRIBUTE = /(?:^|[\s/])on[\w:-]+\s*=/i;
const STORY_ATTRIBUTE = /(?:^|[\s/])data-story-id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
const URL_ATTRIBUTE = /(?:^|[\s/])(?:href|src|action|formaction|poster|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
const STYLE_ATTRIBUTE = /(?:^|[\s/])style\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
const COMMENT = /<!--[\s\S]*?-->/g;

export function validateEditionBundle(value: unknown): EditionBundle {
  const bundle = record(value, "edition bundle");
  const id = identifier(bundle.id, "edition id");
  const date = localDate(bundle.date);
  const language = text(bundle.language, "language");
  const masthead = text(bundle.masthead, "masthead");

  if (!LANGUAGE.test(language)) {
    fail("language must be a BCP 47 language tag");
  }

  const pages = pageList(bundle.pages);
  const sources = sourceList(bundle.sources);
  const stories = storyList(bundle.stories, new Set(sources.map((source) => source.id)));
  assertStoryPlacement(pages, stories);

  return { id, date, language, masthead, pages, stories, sources };
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

    const html = text(input.html, `pages[${index}].html`);
    const css = input.css === undefined ? undefined : text(input.css, `pages[${index}].css`);
    assertSafeMarkup(html, `pages[${index}].html`);
    if (css !== undefined) assertSafeCss(css, `pages[${index}].css`);
    return css === undefined ? { id, html } : { id, html, css };
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

    const url = text(input.url, `sources[${index}].url`);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      fail(`sources[${index}].url must be an HTTPS URL`);
    }
    if (parsed!.protocol !== "https:") {
      fail(`sources[${index}].url must be an HTTPS URL`);
    }
    return { id, url };
  });
}

function storyList(value: unknown, sourceIds: Set<string>): EditionStory[] {
  const stories = list(value, "stories");
  if (stories.length === 0) fail("stories must not be empty");

  const ids = new Set<string>();
  return stories.map((story, index) => {
    const input = record(story, `stories[${index}]`);
    const id = identifier(input.id, `stories[${index}].id`);
    if (ids.has(id)) fail(`duplicate story id: ${id}`);
    ids.add(id);

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

    const headline = input.headline === undefined ? undefined : text(input.headline, `stories[${index}].headline`);
    return headline === undefined
      ? { id, label: input.label, sourceIds: sourceIdsForStory }
      : { id, headline, label: input.label, sourceIds: sourceIdsForStory };
  });
}

function assertStoryPlacement(pages: EditionPage[], stories: EditionStory[]) {
  const placements = new Map<string, number>();
  for (const page of pages) {
    for (const tag of openingTags(tagsOnly(page.html))) {
      const attribute = tag[0].match(STORY_ATTRIBUTE);
      if (!attribute) continue;
      const storyId = decodeEntities(attribute[1] ?? attribute[2] ?? attribute[3]);
      placements.set(storyId, (placements.get(storyId) ?? 0) + 1);
    }
  }

  const knownStoryIds = new Set(stories.map((story) => story.id));
  for (const storyId of placements.keys()) {
    if (!knownStoryIds.has(storyId)) fail(`element references unknown story id: ${storyId}`);
  }
  for (const story of stories) {
    const count = placements.get(story.id) ?? 0;
    if (count !== 1) fail(`story ${story.id} must appear exactly once; found ${count} times`);
  }
}

function assertSafeMarkup(html: string, path: string) {
  const withoutStyleBlocks = html.replace(styleBlock(), (_, openingTag: string, css: string) => {
    assertSafeTag(openingTag, path);
    assertSafeCss(css, path);
    return "";
  });
  const markup = withoutStyleBlocks.replace(COMMENT, "");
  if (/<style\b/i.test(markup)) fail(`${path} contains an unclosed style element`);

  for (const tag of openingTags(markup)) {
    assertSafeTag(tag[0], path);
  }
}

function assertSafeCss(css: string, path: string) {
  if (UNSAFE_CSS.test(decodeCss(css))) fail(`${path} contains unsafe CSS`);
}

function assertSafeTag(tag: string, path: string) {
  const [, name] = /^<([A-Za-z][\w:-]*)/i.exec(tag) ?? [];
  if (!name) return;
  if (FORBIDDEN_ELEMENTS.has(name.toLowerCase())) fail(`${path} contains a forbidden HTML element`);
  if (EVENT_ATTRIBUTE.test(tag)) fail(`${path} contains an unsafe event attribute`);

  for (const attribute of tag.matchAll(URL_ATTRIBUTE)) {
    if (isJavascriptUrl(attribute[1] ?? attribute[2] ?? attribute[3])) {
      fail(`${path} contains an unsafe javascript: URL`);
    }
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
  return html
    .replace(styleBlock(), "")
    .replace(COMMENT, "");
}

function styleBlock(): RegExp {
  return /(<style\b(?:(?:"[^"]*")|(?:'[^']*')|[^>"'])*>)([\s\S]*?)<\/style\s*>/gi;
}

function localDate(value: unknown): string {
  const date = text(value, "date");
  if (!DATE.test(date) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
    fail("date must be a valid YYYY-MM-DD local date");
  }
  return date;
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
  return value.replace(/&(colon|tab|newline);/gi, (_, entity: string) => {
    return entity.toLowerCase() === "colon" ? ":" : "\n";
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
