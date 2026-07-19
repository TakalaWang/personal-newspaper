import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cli = new URL("../scripts/publish-edition.mjs", import.meta.url);
const bundle = {
  id: "daily-2026-07-19",
  date: "2026-07-19",
  language: "zh-Hant-TW",
  masthead: "光譜日報",
  pages: [{ id: "front", section: "Front page", html: '<article data-story-id="lead">Briefing</article>' }],
  stories: [{
    id: "lead",
    pageId: "front",
    headline: "The lead story",
    dek: "The verified context behind the lead story.",
    bodyHtml: "<p>A complete original article.</p>",
    label: "fact",
    sourceIds: ["source"],
  }],
  sources: [{ id: "source", url: "https://example.com/source" }],
};

test("accepts pnpm's leading argument separator", async () => {
  const result = await runArgs(["--", "--help"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /pnpm edition:publish/);
});

test("publishes a bundle to a local agent endpoint without exposing the token", async () => {
  const received = requestOnce((request, response, body) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/agent/editions");
    assert.equal(request.headers.authorization, "Bearer private-token");
    assert.deepEqual(JSON.parse(body), bundle);
    response.writeHead(201, { "content-type": "application/json" });
    response.end('{"id":"daily-2026-07-19","status":"published"}');
  });
  const file = await bundleFile();
  const url = await received.url;

  try {
    const result = await run(file.path, url, "private-token");
    assert.equal(result.code, 0);
    assert.match(result.stdout, /published/i);
    assert.doesNotMatch(result.stdout + result.stderr, /private-token/);
  } finally {
    await received.stop();
    await file.cleanup();
  }
});

test("reports a rejected publication without exposing the token", async () => {
  const received = requestOnce((_, response) => {
    response.writeHead(400, { "content-type": "application/json" });
    response.end('{"error":"sources are incomplete"}');
  });
  const file = await bundleFile();
  const url = await received.url;

  try {
    const result = await run(file.path, url, "private-token");
    assert.equal(result.code, 1);
    assert.match(result.stderr, /publication failed \(400\): sources are incomplete/i);
    assert.doesNotMatch(result.stdout + result.stderr, /private-token/);
  } finally {
    await received.stop();
    await file.cleanup();
  }
});

async function bundleFile() {
  const directory = await mkdtemp(join(tmpdir(), "personal-newspaper-"));
  const path = join(directory, "edition.json");
  await writeFile(path, JSON.stringify(bundle));
  return { path, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

function requestOnce(handler) {
  let stopped = false;
  let resolveStopped;
  const stoppedPromise = new Promise((resolve) => { resolveStopped = resolve; });
  const stop = () => {
    if (stopped) return stoppedPromise;
    stopped = true;
    server.close(() => resolveStopped());
    return stoppedPromise;
  };
  const server = createServer(async (request, response) => {
    await handler(request, response, await readBody(request));
    void stop();
  });
  return {
    stop,
    url: new Promise((resolveUrl) => server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveUrl(`http://127.0.0.1:${address.port}`);
    })),
  };
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body;
}

async function run(file, url, token) {
  return runArgs(["--file", file, "--url", url], { AUTOMATION_TOKEN: token });
}

async function runArgs(args, environment = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(cli), ...args], {
      env: { ...process.env, ...environment },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
