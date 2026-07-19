import type { EditionBundle, PreferenceTag } from "./edition";

const PINNED_LEGACY_DIGEST = "9087911038bc107a423c9df0ab2d8463f7bb45ed4f8f7d472cd1163b088dc26b";

export type ReadableEditionBundle = EditionBundle & {
  readerMode?: "pinned-legacy-cutover";
};

export async function normalizeProductionLegacyEdition(raw: string): Promise<ReadableEditionBundle> {
  return normalizePinnedLegacyEdition(raw, PINNED_LEGACY_DIGEST);
}

export async function normalizePinnedLegacyEdition(
  raw: string,
  expectedDigest: string,
): Promise<ReadableEditionBundle & { readerMode: "pinned-legacy-cutover" }> {
  if (await sha256(raw) !== expectedDigest) throw new Error("Legacy edition digest does not match the pinned cutover predecessor");
  const input = object(JSON.parse(raw), "legacy bundle");
  if (input.id !== "2026-07-19-print-v2") throw new Error("Legacy edition id is not the cutover predecessor");

  const pages = array(input.pages, "legacy pages").map((value, index) => {
    const page = object(value, `legacy pages[${index}]`);
    return {
      id: string(page.id, `legacy pages[${index}].id`),
      section: string(page.section, `legacy pages[${index}].section`),
      html: string(page.html, `legacy pages[${index}].html`)
        .replaceAll("喜歡、不喜歡、追蹤主題", "喜歡、不喜歡")
        .replaceAll("喜歡、少一點、追蹤主題", "喜歡、不喜歡"),
      ...(page.css === undefined ? {} : { css: string(page.css, `legacy pages[${index}].css`) }),
    };
  });
  const sectionByPage = new Map(pages.map((page) => [page.id, page.section]));
  const stories = array(input.stories, "legacy stories").map((value, index) => {
    const story = object(value, `legacy stories[${index}]`);
    const pageId = string(story.pageId, `legacy stories[${index}].pageId`);
    const section = sectionByPage.get(pageId) ?? "要聞";
    const headline = string(story.headline, `legacy stories[${index}].headline`);
    const dek = string(story.dek, `legacy stories[${index}].dek`);
    return {
      id: string(story.id, `legacy stories[${index}].id`),
      pageId,
      kicker: section,
      headline,
      dek,
      summaryHtml: `<p>${escapeHtml(dek)}</p>`,
      bodyHtml: string(story.bodyHtml, `legacy stories[${index}].bodyHtml`),
      label: story.label === "inference" ? "inference" as const : "fact" as const,
      sourceIds: array(story.sourceIds, `legacy stories[${index}].sourceIds`).map((id, sourceIndex) =>
        string(id, `legacy stories[${index}].sourceIds[${sourceIndex}]`),
      ),
      editorial: {
        topics: [section],
        preferenceTags: [sectionTag(section)],
        format: "report" as const,
        depth: "standard" as const,
        style: "contextual" as const,
        importance: index === 0 ? "lead" as const : "secondary" as const,
      },
      claims: [],
      images: [],
    };
  });
  const sources = array(input.sources, "legacy sources").map((value, index) => {
    const source = object(value, `legacy sources[${index}]`);
    const url = string(source.url, `legacy sources[${index}].url`);
    return {
      id: string(source.id, `legacy sources[${index}].id`),
      url,
      title: "Original source",
      publisher: new URL(url).hostname,
      publishedDate: null,
      eventDate: null,
      retrievedAt: string(input.date, "legacy date"),
    };
  });

  return {
    id: string(input.id, "legacy id"),
    date: string(input.date, "legacy date"),
    language: string(input.language, "legacy language"),
    masthead: string(input.masthead, "legacy masthead"),
    generation: {
      basedOnEditionId: null,
      contextVersion: `ctx_${"f".repeat(64)}`,
      contextRevision: 0,
      reactions: [],
    },
    pages,
    stories,
    sources,
    readerMode: "pinned-legacy-cutover",
  };
}

export function isPinnedLegacyEdition(
  bundle: ReadableEditionBundle,
): bundle is ReadableEditionBundle & { readerMode: "pinned-legacy-cutover" } {
  return bundle.readerMode === "pinned-legacy-cutover";
}

function sectionTag(section: string): PreferenceTag {
  if (/科技|技術/.test(section)) return "technology";
  if (/運動/.test(section)) return "sports";
  if (/遊戲/.test(section)) return "games";
  if (/娛樂/.test(section)) return "entertainment";
  if (/文化|藝術/.test(section)) return "culture";
  return "media";
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${path} must be a string`);
  return value;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
