#!/usr/bin/env node

import { validateEditionBundle } from "../../../lib/edition.ts";
import { parseOptions, readJson, required } from "./cli.mjs";

const usage = "Usage: pnpm edition:validate -- --file <edition.json>";

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Edition validation failed");
  process.exitCode = 1;
});

async function main(args) {
  const options = parseOptions(args, ["file"], usage);
  if (options.help) {
    console.log(usage);
    return;
  }
  const bundle = validateEditionBundle(await readJson(required(options, "file", usage), "edition bundle"));
  console.log(`Valid ${bundle.id}: ${bundle.pages.length} page(s), ${bundle.stories.length} story/stories, ${bundle.sources.length} source(s).`);
}
