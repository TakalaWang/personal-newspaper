import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { EditionReader } from "@/app/EditionReader";
import { getDb } from "@/db";
import { editions, shares } from "@/db/schema";
import { getEditionBundle } from "@/lib/edition-store";
import { hashShareToken, resolveShare } from "@/lib/reader";

export default async function SharedEdition({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = await hashShareToken(token);
  const db = getDb();
  const shareRows = await db
    .select()
    .from(shares)
    .where(and(eq(shares.tokenHash, tokenHash), isNull(shares.revokedAt)))
    .limit(1);
  const share = resolveShare(shareRows, tokenHash);
  if (!share) notFound();

  const editionRows = await db.select().from(editions).where(eq(editions.id, share.editionId)).limit(1);
  const edition = editionRows[0];
  if (!edition) notFound();

  const bundle = await getEditionBundle(edition.bundleKey);
  if (!bundle) notFound();

  return (
    <main className="public-edition">
      <p className="shared-edition-note">朋友分享的唯讀本期・{bundle.date}</p>
      <EditionReader bundle={bundle} />
    </main>
  );
}
