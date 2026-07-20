#!/usr/bin/env node

import {
  automationToken,
  parseOptions,
  readJson,
  required,
  responseMessage,
  siteEndpoint,
} from "./cli.mjs";

const usage = "Usage: AUTOMATION_TOKEN=… pnpm profile:save -- --file <profile.json> --url <site-url>";

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Unable to save the profile");
  process.exitCode = 1;
});

async function main(args) {
  const options = parseOptions(args, ["file", "url"], usage);
  if (options.help) {
    console.log(usage);
    return;
  }

  const profile = await readJson(required(options, "file", usage), "profile file");
  const response = await fetch(siteEndpoint(required(options, "url", usage), "/api/agent/profile"), {
    method: "PUT",
    headers: {
      authorization: `Bearer ${automationToken()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(profile),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Profile save failed (${response.status}): ${responseMessage(body, response.statusText)}`);
  }

  let saved;
  try {
    saved = JSON.parse(body).profile;
  } catch {
    throw new Error("Profile response is invalid");
  }
  if (typeof saved?.masthead !== "string" || saved.masthead.trim() === "") {
    throw new Error("Profile response is invalid");
  }
  console.log(`Saved profile for ${saved.masthead}.`);
}
