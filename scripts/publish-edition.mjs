#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const usage = "Usage: pnpm edition:publish -- --file <edition.json> --url <site-url> --token <automation-token>";

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Unable to publish edition");
  process.exitCode = 1;
});

async function main(args) {
  const options = parseOptions(args);
  if (options.help) {
    console.log(usage);
    return;
  }

  const file = required(options, "file");
  const token = required(options, "token");
  const endpoint = publicationEndpoint(required(options, "url"));
  let bundle;

  try {
    bundle = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Unable to read edition bundle: ${detail}`);
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(bundle),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "network error";
    throw new Error(`Unable to reach publication endpoint: ${detail}`);
  }

  const body = await response.text();
  if (!response.ok) throw new Error(`Publication failed (${response.status}): ${message(body, response.statusText)}`);

  const result = json(body);
  console.log(`Published ${typeof result?.id === "string" ? result.id : "edition"}.`);
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (!argument?.startsWith("--")) throw new Error(usage);
    const name = argument.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--") || !["file", "url", "token"].includes(name) || options[name]) {
      throw new Error(usage);
    }
    options[name] = value;
    index += 1;
  }
  return options;
}

function required(options, name) {
  if (!options[name]) throw new Error(usage);
  return options[name];
}

function publicationEndpoint(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("--url must be an absolute HTTP(S) site URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("--url must be an absolute HTTP(S) site URL");
  }
  return new URL("/api/agent/editions", url);
}

function json(value) {
  try {
    const result = JSON.parse(value);
    return result && typeof result === "object" ? result : null;
  } catch {
    return null;
  }
}

function message(body, fallback) {
  const result = json(body);
  if (typeof result?.error === "string" && result.error.trim()) return result.error;
  return body.trim() || fallback || "request rejected";
}
