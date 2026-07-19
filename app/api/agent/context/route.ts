import { eq, isNull } from "drizzle-orm";
import { isAuthorizedAgentRequest } from "@/lib/agent";
import { getAutomationToken, getDb } from "@/db";
import { editions, profiles, reactions } from "@/db/schema";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedAgentRequest(request, getAutomationToken())) return unauthorized();

  try {
    const db = getDb();
    const [profileRows, editionRows, pendingReactions] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, 1)).limit(1),
      db.select().from(editions).where(eq(editions.isCurrent, true)).limit(1),
      db.select().from(reactions).where(isNull(reactions.consumedAt)),
    ]);
    const profile = profileRows[0];
    const currentEdition = editionRows[0];

    return Response.json({
      profile: profile && {
        ownerEmail: profile.ownerEmail,
        masthead: profile.masthead,
        language: profile.language,
        timezone: profile.timezone,
        publicationTime: profile.publicationTime,
        preferences: JSON.parse(profile.preferences),
      },
      currentEdition: currentEdition && {
        id: currentEdition.id,
        date: currentEdition.localDate,
        bundleKey: currentEdition.bundleKey,
        manifest: JSON.parse(currentEdition.manifest),
        status: currentEdition.status,
        publishedAt: currentEdition.publishedAt,
      },
      reactions: pendingReactions,
    });
  } catch (error) {
    console.error("Unable to load agent context", error);
    return Response.json({ error: "Unable to load agent context" }, { status: 500 });
  }
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
