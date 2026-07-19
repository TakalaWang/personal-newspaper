import { and, eq, isNull, or, sql } from "drizzle-orm";
import { isAuthorizedAgentRequest, parseEditionRestore } from "@/lib/agent";
import { loadAgentContextState } from "@/lib/agent-context";
import { validateEditionBundle } from "@/lib/edition";
import { serializeEditionBundle } from "@/lib/edition-key";
import { getEditionBundle } from "@/lib/edition-store";
import { getAutomationToken, getBucket, getDb } from "@/db";
import { agentState, editions, reactions } from "@/db/schema";

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorizedAgentRequest(request, getAutomationToken())) return unauthorized();

  let bundle;
  try {
    bundle = validateEditionBundle(await request.json());
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }

  try {
    const { body, bundleKey, contentHash } = await serializeEditionBundle(bundle);
    const db = getDb();
    const reactionIds = bundle.generation.reactions.map((reaction) => reaction.id);
    const [existing, context] = await Promise.all([
      db.select({ id: editions.id }).from(editions).where(eq(editions.id, bundle.id)).limit(1),
      loadAgentContextState(),
    ]);
    if (existing.length !== 0) {
      return Response.json({ error: `Edition already exists: ${bundle.id}` }, { status: 409 });
    }
    if ((context.currentEdition?.id ?? null) !== bundle.generation.basedOnEditionId) {
      return Response.json({ error: "Agent context is stale; load context again before publishing" }, { status: 409 });
    }
    if (context.contextVersion !== bundle.generation.contextVersion) {
      return Response.json({ error: "Agent context version is stale; load context again before publishing" }, { status: 409 });
    }
    if (context.contextRevision !== bundle.generation.contextRevision) {
      return Response.json({ error: "Agent context revision is stale; load context again before publishing" }, { status: 409 });
    }
    if (!matchesReactionSnapshot(context.reactions, bundle.generation.reactions)) {
      return Response.json({ error: "Reaction snapshot is stale; load context again before publishing" }, { status: 409 });
    }

    await getBucket().put(bundleKey, body, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    const publishedAt = new Date();
    const manifest = JSON.stringify({
      id: bundle.id,
      date: bundle.date,
      language: bundle.language,
      masthead: bundle.masthead,
      pageCount: bundle.pages.length,
      storyCount: bundle.stories.length,
      sourceCount: bundle.sources.length,
      reactionCount: bundle.generation.reactions.length,
      contextRevision: bundle.generation.contextRevision,
      contentHash,
    });
    const edition = {
      id: bundle.id,
      localDate: bundle.date,
      bundleKey,
      manifest,
      status: "published",
      isCurrent: false,
      publishedAt,
      contextRevision: bundle.generation.contextRevision,
    };
    const reserveContext = () =>
      db.update(agentState)
        .set({ revision: sql`${agentState.revision} + 1` })
        .where(and(eq(agentState.id, 1), eq(agentState.revision, bundle.generation.contextRevision)));
    const consumeReactions = () =>
      db.update(reactions)
        .set({ consumedAt: publishedAt, consumedByEditionId: bundle.id })
        .where(or(...bundle.generation.reactions.map((reaction) => and(
          eq(reactions.id, reaction.id),
          eq(reactions.action, reaction.action),
          eq(reactions.createdAt, new Date(reaction.createdAt)),
          isNull(reactions.consumedAt),
        ))));
    const retireCurrent = () =>
      db.update(editions)
        .set({ isCurrent: false })
        .where(and(eq(editions.id, bundle.generation.basedOnEditionId!), eq(editions.isCurrent, true)));
    const insertEdition = () => db.insert(editions).values(edition);
    const activateEdition = () =>
      db.update(editions)
        .set({ isCurrent: true })
        .where(and(eq(editions.id, bundle.id), eq(editions.isCurrent, false)));
    if (bundle.generation.basedOnEditionId && reactionIds.length > 0) {
      await db.batch([reserveContext(), insertEdition(), retireCurrent(), activateEdition(), consumeReactions()]);
    } else if (bundle.generation.basedOnEditionId) {
      await db.batch([reserveContext(), insertEdition(), retireCurrent(), activateEdition()]);
    } else if (reactionIds.length > 0) {
      await db.batch([reserveContext(), insertEdition(), activateEdition(), consumeReactions()]);
    } else {
      await db.batch([reserveContext(), insertEdition(), activateEdition()]);
    }

    return Response.json({ id: bundle.id, bundleKey, status: "published" }, { status: 201 });
  } catch (error) {
    if (isStaleContextError(error)) {
      return Response.json({ error: "Agent context changed during publication; regenerate from a new snapshot" }, { status: 409 });
    }
    if (isConcurrentEditionError(error)) {
      return Response.json({ error: "Current edition changed during publication; load context again" }, { status: 409 });
    }
    console.error("Unable to publish edition", error);
    return Response.json({ error: "Unable to publish edition" }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isAuthorizedAgentRequest(request, getAutomationToken())) return unauthorized();

  let targetEditionId: string;
  let expectedCurrentEditionId: string;
  try {
    ({ targetEditionId, expectedCurrentEditionId } = parseEditionRestore(await request.json()));
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }

  try {
    const db = getDb();
    const [targetRows, currentRows] = await Promise.all([
      db.select().from(editions).where(eq(editions.id, targetEditionId)).limit(1),
      db.select({ id: editions.id, bundleKey: editions.bundleKey }).from(editions).where(eq(editions.isCurrent, true)).limit(1),
    ]);
    const target = targetRows[0];
    if (!target) return Response.json({ error: `Edition not found: ${targetEditionId}` }, { status: 404 });
    const current = currentRows[0];
    if (current?.id !== expectedCurrentEditionId) {
      return Response.json({ error: "Current edition changed; refusing to restore stale state" }, { status: 409 });
    }
    if (target.isCurrent) return Response.json({ error: `Edition is already current: ${targetEditionId}` }, { status: 409 });
    const [targetBundle, failedBundle] = await Promise.all([
      getEditionBundle(target.bundleKey),
      current && getEditionBundle(current.bundleKey),
    ]);
    if (!targetBundle) {
      return Response.json({ error: `Edition bundle is unavailable: ${targetEditionId}` }, { status: 409 });
    }
    if (!failedBundle || failedBundle.generation.basedOnEditionId !== targetEditionId) {
      return Response.json({ error: "Target is not the direct predecessor of the failed edition" }, { status: 409 });
    }

    await db.batch([
      db.update(agentState).set({ revision: sql`${agentState.revision} + 1` }).where(eq(agentState.id, 1)),
      db.update(editions)
        .set({ isCurrent: false })
        .where(and(eq(editions.id, expectedCurrentEditionId), eq(editions.isCurrent, true))),
      db.update(editions).set({ isCurrent: true }).where(eq(editions.id, targetEditionId)),
      db.update(reactions)
        .set({ consumedAt: null, consumedByEditionId: null })
        .where(eq(reactions.consumedByEditionId, expectedCurrentEditionId)),
    ]);
    const restoredCurrent = await db.select({ id: editions.id }).from(editions).where(eq(editions.isCurrent, true)).limit(1);
    if (restoredCurrent[0]?.id !== targetEditionId) {
      return Response.json({ error: "Edition restore lost a concurrent update" }, { status: 409 });
    }

    return Response.json({ id: targetEditionId, status: "restored", replacedEditionId: expectedCurrentEditionId });
  } catch (error) {
    if (isConcurrentEditionError(error)) {
      return Response.json({ error: "Current edition changed; refusing to restore stale state" }, { status: 409 });
    }
    console.error("Unable to restore edition", error);
    return Response.json({ error: "Unable to restore edition" }, { status: 500 });
  }
}

function matchesReactionSnapshot(
  rows: Array<{ id: number; action: string; createdAt: Date | null }>,
  snapshot: Array<{ id: number; action: "love" | "less"; createdAt: string }>,
): boolean {
  if (rows.length !== snapshot.length) return false;
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  return snapshot.every((reaction) => {
    const row = rowsById.get(reaction.id);
    return row?.action === reaction.action
      && row.createdAt !== null
      && row.createdAt.toISOString() === reaction.createdAt;
  });
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid edition bundle";
}

function isStaleContextError(error: unknown): boolean {
  return error instanceof Error && /stale agent context/i.test(error.message);
}

function isConcurrentEditionError(error: unknown): boolean {
  return error instanceof Error && /current edition changed|unique constraint failed.*is_current/i.test(error.message);
}
