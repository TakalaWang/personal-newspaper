import { readFile, writeFile } from "node:fs/promises";

export function parseOptions(input, allowed, usage) {
  const args = input[0] === "--" ? input.slice(1) : input;
  if (args.includes("--help") || args.includes("-h")) return { help: true };
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const argument = args[index];
    const value = args[index + 1];
    if (!argument?.startsWith("--") || !value || value.startsWith("--")) throw new Error(usage);
    const name = argument.slice(2);
    if (!allowed.includes(name) || options[name] !== undefined) throw new Error(usage);
    options[name] = value;
  }
  return options;
}

export function required(options, name, usage) {
  if (!options[name]) throw new Error(usage);
  return options[name];
}

export function automationToken() {
  const token = process.env.AUTOMATION_TOKEN;
  if (!token) throw new Error("Missing required environment variable: AUTOMATION_TOKEN");
  return token;
}

export function siteEndpoint(value, pathname) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return new URL(pathname, url);
  } catch {
    throw new Error("--url must be an absolute HTTP(S) site URL");
  }
}

export async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Unable to read ${label}: ${detail}`);
  }
}

export async function writePrivateJson(path, value, label) {
  try {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Unable to write ${label}; choose a new output path: ${detail}`);
  }
}

export function responseMessage(body, fallback) {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    // Use response text below.
  }
  return body.trim() || fallback || "request rejected";
}
