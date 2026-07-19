#!/usr/bin/env node

const usage = "Usage: AUTOMATION_TOKEN=… pnpm edition:restore -- --id <edition-id> --expected-current <edition-id> --url <site-url>";
const tokenEnvironment = "AUTOMATION_TOKEN";

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Unable to restore edition");
  process.exitCode = 1;
});

async function main(args) {
  if (args[0] === "--") args = args.slice(1);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    return;
  }
  const options = parseOptions(args);
  const targetEditionId = editionId(required(options, "id"), "--id");
  const expectedCurrentEditionId = editionId(required(options, "expected-current"), "--expected-current");
  const token = process.env[tokenEnvironment];
  if (!token) throw new Error(`Missing required environment variable: ${tokenEnvironment}`);

  const response = await fetch(endpoint(required(options, "url")), {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ targetEditionId, expectedCurrentEditionId }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Restore failed (${response.status}): ${message(body, response.statusText)}`);
  console.log(`Restored ${targetEditionId}.`);
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const argument = args[index];
    const value = args[index + 1];
    if (!argument?.startsWith("--") || !value || value.startsWith("--")) throw new Error(usage);
    const name = argument.slice(2);
    if (!["id", "expected-current", "url"].includes(name) || options[name]) throw new Error(usage);
    options[name] = value;
  }
  return options;
}

function editionId(value, flag) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) throw new Error(`${flag} must be a valid edition identifier`);
  return value;
}

function required(options, name) {
  if (!options[name]) throw new Error(usage);
  return options[name];
}

function endpoint(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return new URL("/api/agent/editions", url);
  } catch {
    throw new Error("--url must be an absolute HTTP(S) site URL");
  }
}

function message(body, fallback) {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    // Use the response text below.
  }
  return body.trim() || fallback || "request rejected";
}
