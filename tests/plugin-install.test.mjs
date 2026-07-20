import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

test("ships as a Codex plugin with a credential-free reader quick start", async () => {
  const [manifestSource, marketplaceSource, readme, skill, screenshot] = await Promise.all([
    readFile(new URL(".codex-plugin/plugin.json", root), "utf8"),
    readFile(new URL(".agents/plugins/marketplace.json", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL("skills/personal-newspaper/SKILL.md", root), "utf8"),
    readFile(new URL("assets/personal-newspaper.png", root)),
  ]);

  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.name, "personal-newspaper");
  assert.equal(manifest.version, "1.0.1");
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.license, "MIT");
  assert.deepEqual(manifest.interface.screenshots, ["./assets/personal-newspaper.png"]);
  assert.ok(manifest.interface.defaultPrompt.some((prompt) => /create my daily newspaper/i.test(prompt)));
  assert.deepEqual([...screenshot.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);

  const marketplace = JSON.parse(marketplaceSource);
  assert.equal(marketplace.plugins[0].name, "personal-newspaper");
  assert.equal(marketplace.plugins[0].source.source, "url");
  assert.equal(marketplace.plugins[0].source.url, "https://github.com/TakalaWang/personal-newspaper.git");

  const quickStart = readme.match(/## Quick start\n([\s\S]*?)(?=\n## )/)?.[1] ?? "";
  assert.match(quickStart, /codex plugin marketplace add TakalaWang\/personal-newspaper/);
  assert.match(quickStart, /codex plugin add personal-newspaper@personal-newspaper/);
  assert.match(quickStart, /start a new task/i);
  assert.doesNotMatch(quickStart, /\.env|AUTOMATION_TOKEN|PAPER_URL|ln -s|pnpm/i);

  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const frontmatterKeys = frontmatter
    .split("\n")
    .map((line) => line.match(/^([a-zA-Z][\w-]*):/)?.[1])
    .filter(Boolean);
  assert.deepEqual(frontmatterKeys, ["name", "description"]);
  assert.match(skill, /new or empty project/i);
  assert.match(skill, /create.*Sites.*project/is);
  assert.match(skill, /generate.*credential/is);
  assert.match(skill, /do not ask.*environment variable|never ask.*environment variable/is);
  assert.doesNotMatch(skill, /Load PAPER_URL and AUTOMATION_TOKEN from \.env\.local/);
});

test("bootstraps an isolated Sites project without the demo deployment identity", async () => {
  const target = await mkdtemp(join(tmpdir(), "personal-newspaper-install-"));
  try {
    const result = await runNode(
      new URL("skills/personal-newspaper/scripts/bootstrap-project.mjs", root),
      ["--target", target],
    );
    assert.equal(result.code, 0, result.stderr);

    const hosting = JSON.parse(await readFile(join(target, ".openai/hosting.json"), "utf8"));
    assert.deepEqual(hosting, { d1: "DB", r2: "EDITION_ASSETS" });
    assert.ok((await readdir(join(target, "app"))).includes("page.tsx"));
    assert.ok((await readdir(join(target, "tests"))).includes("publish-edition.test.mjs"));
    assert.ok((await readdir(join(target, "skills/personal-newspaper/scripts"))).includes("publish-edition.mjs"));
    await assert.rejects(readFile(join(target, "docs/assets/personal-newspaper.jpg")));
    await assert.rejects(readFile(join(target, "README.md")));
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

function runNode(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(script), ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
