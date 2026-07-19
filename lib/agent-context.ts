import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { agentState, editions, profiles, reactions } from "@/db/schema";
import { getEditionBundle } from "@/lib/edition-store";
import {
  buildPreferenceMemory,
  buildReactionContext,
  createAgentContextVersion,
  isPreferenceMemoryReaction,
} from "@/lib/reader";

export async function loadAgentContextState() {
  const db = getDb();
  const [stateRows, profileRows, editionRows, pendingRows, historyRows] = await Promise.all([
    db.select().from(agentState).where(eq(agentState.id, 1)).limit(1),
    db.select().from(profiles).where(eq(profiles.id, 1)).limit(1),
    db.select().from(editions),
    db.select().from(reactions).where(isNull(reactions.consumedAt)),
    db
      .select()
      .from(reactions)
      .where(and(isNotNull(reactions.consumedAt), isNotNull(reactions.consumedByEditionId)))
      .orderBy(desc(reactions.createdAt))
      .limit(500),
  ]);
  const contextRevision = stateRows[0]?.revision;
  if (typeof contextRevision !== "number" || !Number.isSafeInteger(contextRevision) || contextRevision < 0) {
    throw new Error("Agent state revision is unavailable");
  }
  const profileRow = profileRows[0];
  const profile = profileRow && {
    ownerEmail: profileRow.ownerEmail,
    masthead: profileRow.masthead,
    language: profileRow.language,
    timezone: profileRow.timezone,
    publicationTime: profileRow.publicationTime,
    preferences: JSON.parse(profileRow.preferences),
  };
  const currentEditionRow = editionRows.find((edition) => edition.isCurrent);
  const currentEdition = currentEditionRow && {
    id: currentEditionRow.id,
    date: currentEditionRow.localDate,
    bundleKey: currentEditionRow.bundleKey,
    manifest: JSON.parse(currentEditionRow.manifest),
    status: currentEditionRow.status,
    publishedAt: currentEditionRow.publishedAt,
  };
  const pendingReactions = supportedReactions(pendingRows);
  const historyReactions = supportedReactions(historyRows.filter(isPreferenceMemoryReaction));
  const editionById = new Map(editionRows.map((edition) => [edition.id, edition]));
  const relevantEditionIds = new Set([...pendingReactions, ...historyReactions].map((reaction) => reaction.editionId));
  const bundles = new Map<string, NonNullable<Awaited<ReturnType<typeof getEditionBundle>>>>();
  await Promise.all([...relevantEditionIds].map(async (editionId) => {
    const edition = editionById.get(editionId);
    if (!edition) throw new Error(`Reaction references an unavailable edition: ${editionId}`);
    const bundle = await getEditionBundle(edition.bundleKey);
    if (!bundle) throw new Error(`Reaction edition bundle is unavailable: ${editionId}`);
    bundles.set(editionId, bundle);
  }));
  const reactionContext = buildReactionContext(pendingReactions, bundles);
  const preferenceMemory = buildPreferenceMemory(buildReactionContext(historyReactions, bundles));
  const contextVersion = await createAgentContextVersion({
    profile,
    contextRevision,
    currentEditionId: currentEdition?.id ?? null,
    reactions: reactionContext,
    preferenceMemory,
  });

  return { profile, currentEdition, reactions: reactionContext, preferenceMemory, contextVersion, contextRevision };
}

function supportedReactions<T extends { action: string }>(rows: T[]): T[] {
  return rows.filter((row) => row.action === "love" || row.action === "less");
}
