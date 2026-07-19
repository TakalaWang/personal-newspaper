import { eq } from "drizzle-orm";
import { forbidden } from "next/navigation";
import { EditionReader } from "./EditionReader";
import { requireChatGPTUser } from "./chatgpt-auth";
import { getDb } from "@/db";
import { editions, profiles } from "@/db/schema";
import { getEditionBundle } from "@/lib/edition-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  const db = getDb();
  const [profileRows, editionRows] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, 1)).limit(1),
    db.select().from(editions).where(eq(editions.isCurrent, true)).limit(1),
  ]);
  const profile = profileRows[0];
  const edition = editionRows[0];

  if (profile && profile.ownerEmail !== user.email) forbidden();
  if (!edition) return <Onboarding masthead={profile?.masthead ?? "The Personal Daily"} />;

  const bundle = await getEditionBundle(edition.bundleKey);
  if (!bundle) {
    return (
      <main className="access-state">
        <p className="access-mark" aria-hidden="true" />
        <h1>This edition is not available.</h1>
        <p>Ask Codex to republish it. Your previous preferences have not been changed.</p>
      </main>
    );
  }

  return (
    <main className="private-edition">
      <EditionReader bundle={bundle} owner />
    </main>
  );
}

function Onboarding({ masthead }: { masthead: string }) {
  return (
    <main className="onboarding-empty">
      <p className="edition-rule" aria-hidden="true" />
      <p className="onboarding-name">{masthead}</p>
      <h1>Your first edition is waiting to be made.</h1>
      <p>
        Ask Codex to publish the first issue after your interview. It will appear here as a private daily edition.
      </p>
    </main>
  );
}
