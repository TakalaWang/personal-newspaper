export type ProfileUpdate = {
  ownerEmail: string;
  masthead: string;
  language: string;
  timezone: string;
  publicationTime: string;
  preferences: Record<string, unknown>;
};

const PROFILE_FIELDS = new Set([
  "ownerEmail",
  "masthead",
  "language",
  "timezone",
  "publicationTime",
  "preferences",
]);

export function isAuthorizedAgentRequest(
  request: Request,
  automationToken: string | undefined,
): boolean {
  return Boolean(automationToken) && request.headers.get("authorization") === `Bearer ${automationToken}`;
}

export function parseProfileUpdate(value: unknown): ProfileUpdate {
  if (!isRecord(value)) fail("profile body must be an object");
  for (const key of Object.keys(value)) {
    if (!PROFILE_FIELDS.has(key)) fail(`unexpected field: ${key}`);
  }

  const ownerEmail = nonEmpty(value.ownerEmail, "ownerEmail");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) fail("ownerEmail must be an email address");

  const masthead = nonEmpty(value.masthead, "masthead");
  const language = nonEmpty(value.language, "language");
  const timezone = nonEmpty(value.timezone, "timezone");
  try {
    Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    fail("timezone must be an IANA timezone");
  }

  const publicationTime = nonEmpty(value.publicationTime, "publicationTime");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(publicationTime)) {
    fail("publicationTime must use HH:MM in 24-hour time");
  }
  if (!isRecord(value.preferences)) fail("preferences must be an object");

  return { ownerEmail, masthead, language, timezone, publicationTime, preferences: value.preferences };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${name} must be a non-empty string`);
  return value;
}

function fail(message: string): never {
  throw new Error(`Invalid agent request: ${message}`);
}
