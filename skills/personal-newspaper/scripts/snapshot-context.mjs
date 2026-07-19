#!/usr/bin/env node

import {
  automationToken,
  parseOptions,
  required,
  responseMessage,
  siteEndpoint,
  writePrivateJson,
} from "./cli.mjs";

const usage = "Usage: AUTOMATION_TOKEN=… pnpm edition:context -- --output <context.json> --url <site-url>";

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Unable to capture agent context");
  process.exitCode = 1;
});

async function main(args) {
  const options = parseOptions(args, ["output", "url"], usage);
  if (options.help) {
    console.log(usage);
    return;
  }

  const response = await fetch(siteEndpoint(required(options, "url", usage), "/api/agent/context"), {
    headers: { authorization: `Bearer ${automationToken()}` },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Context request failed (${response.status}): ${responseMessage(body, response.statusText)}`);

  let context;
  try {
    context = validateContext(JSON.parse(body));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid response";
    throw new Error(`Context response is invalid: ${detail}`);
  }
  await writePrivateJson(required(options, "output", usage), context, "private context snapshot");
  console.log(`Captured context revision ${context.contextRevision} with ${context.reactions.length} pending reaction(s).`);
}

function validateContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected an object");
  if (!value.profile || typeof value.profile !== "object" || Array.isArray(value.profile)) throw new Error("profile is missing");
  if (!/^ctx_[0-9a-f]{64}$/.test(value.contextVersion)) throw new Error("contextVersion is invalid");
  if (!Number.isSafeInteger(value.contextRevision) || value.contextRevision < 0) throw new Error("contextRevision is invalid");
  if (!Array.isArray(value.reactions)) throw new Error("reactions must be an array");
  for (const reaction of value.reactions) {
    if (!Number.isSafeInteger(reaction?.id) || reaction.id < 1) throw new Error("reaction id is invalid");
    if (reaction.action !== "love" && reaction.action !== "less") throw new Error("reaction action is invalid");
    if (typeof reaction.createdAt !== "string" || !Number.isFinite(Date.parse(reaction.createdAt))) {
      throw new Error("reaction createdAt is invalid");
    }
  }
  if (value.currentEdition !== undefined && value.currentEdition !== null && typeof value.currentEdition?.id !== "string") {
    throw new Error("currentEdition is invalid");
  }
  return value;
}
