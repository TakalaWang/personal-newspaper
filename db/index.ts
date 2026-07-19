import { drizzle, type AnyD1Database } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

type Bindings = {
  DB?: AnyD1Database;
  EDITION_ASSETS?: {
    put(
      key: string,
      value: string,
      options?: { httpMetadata?: { contentType: string } },
    ): Promise<unknown>;
  };
  AUTOMATION_TOKEN?: string;
};

function bindings(): Bindings {
  return env as Bindings;
}

export function getDb() {
  const env = bindings();
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export function getBucket() {
  const env = bindings();
  if (!env.EDITION_ASSETS) {
    throw new Error(
      "Cloudflare R2 binding `EDITION_ASSETS` is unavailable. Set the `r2` field in .openai/hosting.json to `EDITION_ASSETS` before publishing editions."
    );
  }

  return env.EDITION_ASSETS;
}

export function getAutomationToken(): string | undefined {
  return bindings().AUTOMATION_TOKEN;
}
