#!/usr/bin/env node

import { validateEditionBundle } from "../../../lib/edition.ts";
import { parseOptions, readJson, required, writePrivateJson } from "./cli.mjs";

const usage = "Usage: pnpm edition:prepare -- --draft <draft.json> --context <context.json> --output <edition.json>";

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Unable to prepare edition");
  process.exitCode = 1;
});

async function main(args) {
  const options = parseOptions(args, ["draft", "context", "output"], usage);
  if (options.help) {
    console.log(usage);
    return;
  }

  const [draft, context] = await Promise.all([
    readJson(required(options, "draft", usage), "edition draft"),
    readJson(required(options, "context", usage), "context snapshot"),
  ]);
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) throw new Error("Edition draft must be an object");
  if (Object.hasOwn(draft, "generation")) throw new Error("Edition draft must omit generation; it is bound from context by this command");
  const profile = context?.profile;
  if (!profile || typeof profile !== "object") throw new Error("Context snapshot profile is missing");
  if (draft.masthead !== profile.masthead) throw new Error("Edition masthead does not match the context profile");
  if (draft.language !== profile.language) throw new Error("Edition language does not match the context profile");
  if (!/^ctx_[0-9a-f]{64}$/.test(context.contextVersion)) throw new Error("Context snapshot version is invalid");
  if (!Number.isSafeInteger(context.contextRevision) || context.contextRevision < 0) {
    throw new Error("Context snapshot revision is invalid");
  }
  if (!Array.isArray(context.reactions)) throw new Error("Context snapshot reactions are invalid");

  const generation = {
    basedOnEditionId: context.currentEdition?.id ?? null,
    contextVersion: context.contextVersion,
    contextRevision: context.contextRevision,
    reactions: context.reactions.map((reaction) => ({
      id: reaction.id,
      action: reaction.action,
      createdAt: reaction.createdAt,
    })),
  };
  const bundle = validateEditionBundle({ ...draft, generation });
  await writePrivateJson(required(options, "output", usage), bundle, "prepared edition bundle");
  console.log(`Prepared ${bundle.id} from context revision ${generation.contextRevision}.`);
}
