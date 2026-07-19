#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Skill validation failed");
  process.exitCode = 1;
});

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("Usage: pnpm skill:validate");
    return;
  }
  const skill = await readFile(resolve(skillRoot, "SKILL.md"), "utf8");
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
  if (!frontmatter) throw new Error("SKILL.md must start with YAML frontmatter");
  const name = field(frontmatter, "name");
  const description = field(frontmatter, "description");
  const compatibility = field(frontmatter, "compatibility");
  if (name !== "personal-newspaper" || !/^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/.test(name)) {
    throw new Error("Skill name must match its directory and the Agent Skills naming rules");
  }
  if (description.length < 1 || description.length > 1024) throw new Error("Skill description must contain 1–1024 characters");
  if (compatibility.length < 1 || compatibility.length > 500) throw new Error("Skill compatibility must contain 1–500 characters");
  if (skill.split("\n").length >= 500) throw new Error("SKILL.md must stay under 500 lines");

  const links = [...skill.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
  for (const link of links) {
    if (/^[a-z]+:/i.test(link) || link.startsWith("#")) continue;
    if (!/^(?:references|assets)\/[^/]+$/.test(link)) throw new Error(`Resource link must be one level deep: ${link}`);
    await access(resolve(skillRoot, link));
  }
  const evals = JSON.parse(await readFile(resolve(skillRoot, "evals/evals.json"), "utf8"));
  if (evals.skill_name !== name || !Array.isArray(evals.evals) || evals.evals.length < 4) {
    throw new Error("evals/evals.json must define at least four evals for this skill");
  }
  for (const evaluation of evals.evals) {
    if (!Number.isSafeInteger(evaluation.id) || typeof evaluation.prompt !== "string"
      || typeof evaluation.expected_output !== "string" || !Array.isArray(evaluation.expectations)
      || evaluation.expectations.length < 3) {
      throw new Error(`Eval ${evaluation.id ?? "unknown"} does not match the official skill-creator schema`);
    }
  }
  console.log("Personal Newspaper skill structure, resources, and eval schema are valid.");
}

function field(frontmatter, name) {
  const value = frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim();
  if (!value) throw new Error(`Missing frontmatter field: ${name}`);
  return value.replace(/^(["'])(.*)\1$/, "$2");
}
