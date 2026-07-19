import type { EditionBundle } from "@/lib/edition";

const REACTION_ACTIONS = new Set(["love", "less"]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export type ReactionAction = "love" | "less";

export type ReaderMessage =
  | { type: "open"; storyId: string }
  | { type: "react"; storyId: string; action: ReactionAction }
  | { type: "page-resize"; height: number };

export type ShareRecord = {
  tokenHash: string;
  editionId: string;
  revokedAt: Date | null;
};

type StoredShare = ShareRecord & {
  id: number;
  createdAt: Date | null;
};

export type PendingReaction = {
  id: number;
  editionId: string;
  storyId: string;
  action: string;
  createdAt: Date | null;
};

export type AgentReaction = Omit<PendingReaction, "action"> & {
  action: ReactionAction;
  story: {
    headline: string;
    dek: string;
    kicker: string;
    pageId: string;
    section: string;
    label: EditionBundle["stories"][number]["label"];
    editorial: EditionBundle["stories"][number]["editorial"];
  };
};

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

export function parseReaction(value: unknown): { action: ReactionAction; storyId: string; editionId: string } {
  if (!isRecord(value)) fail("reaction body must be an object");
  for (const key of Object.keys(value)) {
    if (key !== "action" && key !== "storyId" && key !== "editionId") fail(`unexpected field: ${key}`);
  }
  if (!REACTION_ACTIONS.has(value.action as string)) fail("action must be love or less");
  if (typeof value.storyId !== "string" || !IDENTIFIER.test(value.storyId)) {
    fail("storyId must be a valid identifier");
  }
  if (typeof value.editionId !== "string" || !IDENTIFIER.test(value.editionId)) {
    fail("editionId must be a valid identifier");
  }
  return { action: value.action as ReactionAction, storyId: value.storyId, editionId: value.editionId };
}

export function parseReaderMessage(value: unknown, storyIds: Set<string>): ReaderMessage {
  if (!isRecord(value)) fail("reader message must be an object");
  if (value.type === "page-resize") {
    if (Object.keys(value).some((key) => key !== "type" && key !== "height")) fail("unexpected field in page resize");
    if (!Number.isSafeInteger(value.height) || (value.height as number) < 400 || (value.height as number) > 5000) {
      fail("page height must be an integer between 400 and 5000");
    }
    return { type: "page-resize", height: value.height as number };
  }
  if (value.type !== "open" && value.type !== "react") fail("reader message type must be open, react, or page-resize");

  const allowedKeys = value.type === "open" ? new Set(["type", "storyId"]) : new Set(["type", "storyId", "action"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) fail(`unexpected field: ${key}`);
  }
  if (typeof value.storyId !== "string" || !storyIds.has(value.storyId)) {
    fail("storyId must reference a story in this edition");
  }
  if (value.type === "open") return { type: "open", storyId: value.storyId };
  if (!REACTION_ACTIONS.has(value.action as string)) fail("action must be love or less");
  return { type: "react", storyId: value.storyId, action: value.action as ReactionAction };
}

export function buildReactionContext(
  reactions: PendingReaction[],
  editionBundles: Map<string, EditionBundle>,
): AgentReaction[] {
  return reactions.flatMap((reaction) => {
    if (!REACTION_ACTIONS.has(reaction.action)) return [];
    const edition = editionBundles.get(reaction.editionId);
    if (!edition) fail("reaction must reference an available immutable edition bundle");
    const stories = new Map(edition.stories.map((story) => [story.id, story]));
    const sections = new Map(edition.pages.map((page) => [page.id, page.section]));
    const story = stories.get(reaction.storyId);
    if (!story) fail("reaction must reference a story in the current edition");
    const section = sections.get(story.pageId);
    if (!section) fail("reaction story must reference a section page");

    return [{
      id: reaction.id,
      editionId: reaction.editionId,
      storyId: reaction.storyId,
      action: reaction.action as ReactionAction,
      createdAt: reaction.createdAt,
      story: {
        headline: story.headline,
        dek: story.dek,
        kicker: story.kicker,
        pageId: story.pageId,
        section,
        label: story.label,
        editorial: story.editorial,
      },
    }];
  });
}

type PreferenceSignal = { value: string; score: number; love: number; less: number };

export type PreferenceMemory = {
  reactionCount: number;
  topics: PreferenceSignal[];
  formats: PreferenceSignal[];
  depths: PreferenceSignal[];
  styles: PreferenceSignal[];
  importance: PreferenceSignal[];
};

export type PreferenceMemoryReaction = PendingReaction & {
  consumedAt: Date | null;
  consumedByEditionId: string | null;
};

export function isPreferenceMemoryReaction(reaction: PreferenceMemoryReaction): boolean {
  return reaction.consumedAt !== null && reaction.consumedByEditionId !== null;
}

export function buildPreferenceMemory(reactions: AgentReaction[]): PreferenceMemory {
  const topics = new Map<string, PreferenceSignal>();
  const formats = new Map<string, PreferenceSignal>();
  const depths = new Map<string, PreferenceSignal>();
  const styles = new Map<string, PreferenceSignal>();
  const importance = new Map<string, PreferenceSignal>();

  for (const reaction of reactions) {
    for (const topic of reaction.story.editorial.preferenceTags) addSignal(topics, topic, reaction.action);
    addSignal(formats, reaction.story.editorial.format, reaction.action);
    addSignal(depths, reaction.story.editorial.depth, reaction.action);
    addSignal(styles, reaction.story.editorial.style, reaction.action);
    addSignal(importance, reaction.story.editorial.importance, reaction.action);
  }

  return {
    reactionCount: reactions.length,
    topics: [...topics.values()],
    formats: [...formats.values()],
    depths: [...depths.values()],
    styles: [...styles.values()],
    importance: [...importance.values()],
  };
}

export async function createAgentContextVersion(value: {
  profile: unknown;
  contextRevision: number;
  currentEditionId: string | null;
  reactions: AgentReaction[];
  preferenceMemory: PreferenceMemory;
}): Promise<string> {
  const canonical = JSON.stringify({
    profile: value.profile,
    contextRevision: value.contextRevision,
    currentEditionId: value.currentEditionId,
    reactions: value.reactions
      .map(({ id, action, createdAt }) => ({ id, action, createdAt: createdAt?.toISOString() ?? null }))
      .sort((left, right) => left.id - right.id),
    preferenceMemory: {
      reactionCount: value.preferenceMemory.reactionCount,
      topics: sortedSignals(value.preferenceMemory.topics),
      formats: sortedSignals(value.preferenceMemory.formats),
      depths: sortedSignals(value.preferenceMemory.depths),
      styles: sortedSignals(value.preferenceMemory.styles),
      importance: sortedSignals(value.preferenceMemory.importance),
    },
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return `ctx_${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function sortedSignals(signals: PreferenceSignal[]): PreferenceSignal[] {
  return [...signals].sort((left, right) => left.value.localeCompare(right.value));
}

function addSignal(signals: Map<string, PreferenceSignal>, value: string, action: ReactionAction) {
  const signal = signals.get(value) ?? { value, score: 0, love: 0, less: 0 };
  signal[action] += 1;
  signal.score += action === "love" ? 1 : -1;
  signals.set(value, signal);
}

export async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function resolveShare<T extends ShareRecord>(shares: T[], tokenHash: string): T | undefined {
  return shares.find((share) => share.tokenHash === tokenHash && share.revokedAt === null);
}

export function shareSummary(share: StoredShare) {
  return {
    id: share.id,
    editionId: share.editionId,
    createdAt: share.createdAt,
    revokedAt: share.revokedAt,
  };
}

export function parseShareId(value: unknown): number {
  if (!isRecord(value) || Object.keys(value).length !== 1 || typeof value.shareId !== "number" || !Number.isSafeInteger(value.shareId) || value.shareId < 1) {
    fail("shareId must be a positive integer");
  }
  return value.shareId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(`Invalid reader request: ${message}`);
}
