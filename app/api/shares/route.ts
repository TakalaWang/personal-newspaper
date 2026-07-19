import { and, eq, isNull } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { editions, profiles, shares } from "@/db/schema";
import { createShareToken, hashShareToken, isSameOriginRequest } from "@/lib/reader";

export async function POST(request: Request): Promise<Response> {
  const owner = await requireOwner(request);
  if (owner instanceof Response) return owner;

  let editionId: string;
  try {
    const body = await request.json();
    if (!isRecord(body) || typeof body.editionId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(body.editionId)) {
      throw new Error("editionId must be a valid identifier");
    }
    editionId = body.editionId;
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 400 });
  }

  try {
    const db = getDb();
    const edition = await db.select({ id: editions.id }).from(editions).where(eq(editions.id, editionId)).limit(1);
    if (!edition[0]) return Response.json({ error: "Edition not found" }, { status: 404 });

    const token = createShareToken();
    await db.insert(shares).values({ tokenHash: await hashShareToken(token), editionId });
    return Response.json({ token, url: new URL(`/share/${token}`, request.url).toString() }, { status: 201 });
  } catch (error) {
    console.error("Unable to create share", error);
    return Response.json({ error: "Unable to create share link" }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const owner = await requireOwner(request);
  if (owner instanceof Response) return owner;

  try {
    const body = await request.json();
    if (!isRecord(body) || typeof body.token !== "string" || body.token.length < 32) throw new Error("token is required");
    const result = await getDb()
      .update(shares)
      .set({ revokedAt: new Date() })
      .where(and(eq(shares.tokenHash, await hashShareToken(body.token)), isNull(shares.revokedAt)));
    if (result.meta.changes === 0) return Response.json({ error: "Share link not found" }, { status: 404 });
    return Response.json({ message: "Share link revoked" });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 400 });
  }
}

async function requireOwner(request: Request): Promise<true | Response> {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to manage sharing" }, { status: 401 });
  const profile = await getDb().select().from(profiles).where(eq(profiles.id, 1)).limit(1);
  return profile[0]?.ownerEmail === user.email
    ? true
    : Response.json({ error: "This edition belongs to another reader" }, { status: 403 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid share request";
}
