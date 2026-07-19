import type { EditionBundle } from "./edition";

export async function serializeEditionBundle(bundle: EditionBundle): Promise<{
  body: string;
  bundleKey: string;
  contentHash: string;
}> {
  const body = JSON.stringify(bundle);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const contentHash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    body,
    bundleKey: `editions/${bundle.id}/${contentHash}.json`,
    contentHash,
  };
}
