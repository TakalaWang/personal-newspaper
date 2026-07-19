import { eq, isNull } from "drizzle-orm";
import { isAuthorizedAgentRequest } from "@/lib/agent";
import { validateEditionBundle } from "@/lib/edition";
import { getAutomationToken, getBucket, getDb } from "@/db";
import { editions, reactions } from "@/db/schema";

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorizedAgentRequest(request, getAutomationToken())) return unauthorized();

  let bundle;
  try {
    bundle = validateEditionBundle(await request.json());
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }

  const bundleKey = `editions/${bundle.id}/bundle.json`;
  try {
    const db = getDb();
    const existing = await db.select({ id: editions.id }).from(editions).where(eq(editions.id, bundle.id)).limit(1);
    if (existing.length !== 0) {
      return Response.json({ error: `Edition already exists: ${bundle.id}` }, { status: 409 });
    }

    await getBucket().put(bundleKey, JSON.stringify(bundle), {
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
    });
    const edition = {
      id: bundle.id,
      localDate: bundle.date,
      bundleKey,
      manifest,
      status: "published",
      isCurrent: true,
      publishedAt,
    };
    await db.batch([
      db.update(editions).set({ isCurrent: false }).where(eq(editions.isCurrent, true)),
      db.insert(editions).values(edition),
      db.update(reactions).set({ consumedAt: publishedAt }).where(isNull(reactions.consumedAt)),
    ]);

    return Response.json({ id: bundle.id, bundleKey, status: "published" }, { status: 201 });
  } catch (error) {
    console.error("Unable to publish edition", error);
    return Response.json({ error: "Unable to publish edition" }, { status: 500 });
  }
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid edition bundle";
}
