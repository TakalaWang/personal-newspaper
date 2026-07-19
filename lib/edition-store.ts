import { validateEditionBundle } from "./edition";
import { normalizeProductionLegacyEdition, type ReadableEditionBundle } from "./legacy-cutover";
import { getBucket } from "@/db";

export async function getEditionBundle(bundleKey: string): Promise<ReadableEditionBundle | null> {
  const object = await getBucket().get(bundleKey);
  if (!object) return null;
  const raw = await object.text();
  try {
    return validateEditionBundle(JSON.parse(raw));
  } catch (validationError) {
    try {
      return await normalizeProductionLegacyEdition(raw);
    } catch {
      throw validationError;
    }
  }
}
