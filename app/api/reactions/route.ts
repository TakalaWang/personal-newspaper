import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { editions, profiles, reactions } from "@/db/schema";
import { getEditionBundle } from "@/lib/edition-store";
import { isSameOriginRequest, parseReaction } from "@/lib/reader";

export async function GET(): Promise<Response> {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to view responses" }, { status: 401 });

  try {
    const db = getDb();
    const [profile, edition] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, 1)).limit(1),
      db.select().from(editions).where(eq(editions.isCurrent, true)).limit(1),
    ]);
    if (profile[0]?.ownerEmail !== user.email) return Response.json({ error: "This edition belongs to another reader" }, { status: 403 });
    if (!edition[0]) return Response.json({ editionId: null, reactions: [] });

    const rows = await db.select({ storyId: reactions.storyId, action: reactions.action })
      .from(reactions)
      .where(eq(reactions.editionId, edition[0].id));
    return Response.json({
      editionId: edition[0].id,
      reactions: rows.filter((row) => row.action === "love" || row.action === "less"),
    });
  } catch (error) {
    console.error("Unable to load reactions", error);
    return Response.json({ error: "Unable to load reactions" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });

  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in with ChatGPT to respond" }, { status: 401 });

  let reaction;
  try {
    reaction = parseReaction(await request.json());
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 400 });
  }

  try {
    const db = getDb();
    const [profile, edition] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, 1)).limit(1),
      db.select().from(editions).where(eq(editions.isCurrent, true)).limit(1),
    ]);
    if (profile[0]?.ownerEmail !== user.email) return Response.json({ error: "This edition belongs to another reader" }, { status: 403 });
    if (!edition[0]) return Response.json({ error: "There is no current edition" }, { status: 404 });
    if (edition[0].id !== reaction.editionId) {
      return Response.json({ error: "That edition is no longer current; reload before reacting" }, { status: 409 });
    }

    const bundle = await getEditionBundle(edition[0].bundleKey);
    if (!bundle || !bundle.stories.some((story) => story.id === reaction.storyId)) {
      return Response.json({ error: "That story is not in the current edition" }, { status: 404 });
    }
    const createdAt = new Date();
    await db.insert(reactions).values({
      editionId: edition[0].id,
      storyId: reaction.storyId,
      action: reaction.action,
      createdAt,
    }).onConflictDoUpdate({
      target: [reactions.editionId, reactions.storyId],
      set: { action: reaction.action, createdAt, consumedAt: null, consumedByEditionId: null },
    });
    return Response.json({ message: "已儲存，下一期會依這項回饋調整。" }, { status: 201 });
  } catch (error) {
    console.error("Unable to save reaction", error);
    return Response.json({ error: "Unable to save reaction" }, { status: 500 });
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid reaction";
}
