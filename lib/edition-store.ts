import { validateEditionBundle, type EditionBundle } from "./edition";
import { getBucket } from "@/db";

export async function getEditionBundle(bundleKey: string): Promise<EditionBundle | null> {
  const object = await getBucket().get(bundleKey);
  if (!object) return null;
  return validateEditionBundle(JSON.parse(await object.text()), { requireEditorialExpansion: false });
}
