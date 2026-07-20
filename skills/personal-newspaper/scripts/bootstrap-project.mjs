#!/usr/bin/env node

import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseOptions, required } from "./cli.mjs";

const usage = "Usage: node bootstrap-project.mjs --target <empty-project-directory>";
const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = resolve(skillRoot, "../..");
const directories = ["app", "build", "db", "drizzle", "lib", "tests", "worker", "skills/personal-newspaper"];
const files = [
  ".gitignore",
  "AGENTS.md",
  "cloudflare.d.ts",
  "drizzle.config.ts",
  "DESIGN.md",
  "eslint.config.mjs",
  "next.config.ts",
  "package.json",
  "pnpm-lock.yaml",
  "postcss.config.mjs",
  "PRODUCT.md",
  "tsconfig.json",
  "vite.config.ts",
];

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Unable to create the newspaper project");
  process.exitCode = 1;
});

async function main(args) {
  const options = parseOptions(args, ["target"], usage);
  if (options.help) {
    console.log(usage);
    return;
  }

  const target = resolve(required(options, "target", usage));
  await mkdir(target, { recursive: true });
  const existing = (await readdir(target)).filter((name) => name !== ".DS_Store");
  if (existing.length > 0) throw new Error("The first run needs a new or empty project directory");

  for (const directory of directories) {
    await cp(resolve(pluginRoot, directory), resolve(target, directory), { recursive: true, errorOnExist: true });
  }
  for (const file of files) {
    await cp(resolve(pluginRoot, file), resolve(target, file), { errorOnExist: true });
  }

  await mkdir(resolve(target, ".openai"), { recursive: true });
  await writeFile(
    resolve(target, ".openai/hosting.json"),
    `${JSON.stringify({ d1: "DB", r2: "EDITION_ASSETS" }, null, 2)}\n`,
    { flag: "wx" },
  );

  const packagePath = resolve(target, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.private = true;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  console.log("Created an isolated Personal Newspaper Sites project.");
}
