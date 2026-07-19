const REACTION_ACTIONS = new Set(["love", "less", "follow"]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export type ReactionAction = "love" | "less" | "follow";

export type ReaderMessage =
  | { type: "open"; storyId: string }
  | { type: "react"; storyId: string; action: ReactionAction };

export type ShareRecord = {
  tokenHash: string;
  editionId: string;
  revokedAt: Date | null;
};

type StoredShare = ShareRecord & {
  id: number;
  createdAt: Date | null;
};

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

export function parseReaction(value: unknown): { action: ReactionAction; storyId: string } {
  if (!isRecord(value)) fail("reaction body must be an object");
  for (const key of Object.keys(value)) {
    if (key !== "action" && key !== "storyId") fail(`unexpected field: ${key}`);
  }
  if (!REACTION_ACTIONS.has(value.action as string)) fail("action must be love, less, or follow");
  if (typeof value.storyId !== "string" || !IDENTIFIER.test(value.storyId)) {
    fail("storyId must be a valid identifier");
  }
  return { action: value.action as ReactionAction, storyId: value.storyId };
}

export function parseReaderMessage(value: unknown, storyIds: Set<string>): ReaderMessage {
  if (!isRecord(value)) fail("reader message must be an object");
  if (value.type !== "open" && value.type !== "react") fail("reader message type must be open or react");

  const allowedKeys = value.type === "open" ? new Set(["type", "storyId"]) : new Set(["type", "storyId", "action"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) fail(`unexpected field: ${key}`);
  }
  if (typeof value.storyId !== "string" || !storyIds.has(value.storyId)) {
    fail("storyId must reference a story in this edition");
  }
  if (value.type === "open") return { type: "open", storyId: value.storyId };
  if (!REACTION_ACTIONS.has(value.action as string)) fail("action must be love, less, or follow");
  return { type: "react", storyId: value.storyId, action: value.action as ReactionAction };
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
