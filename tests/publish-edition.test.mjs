import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cli = new URL("../skills/personal-newspaper/scripts/publish-edition.mjs", import.meta.url);
const restoreCli = new URL("../skills/personal-newspaper/scripts/restore-edition.mjs", import.meta.url);
const contextCli = new URL("../skills/personal-newspaper/scripts/snapshot-context.mjs", import.meta.url);
const prepareCli = new URL("../skills/personal-newspaper/scripts/prepare-edition.mjs", import.meta.url);
const draft = JSON.parse(await readFile(new URL("../skills/personal-newspaper/assets/edition-template.json", import.meta.url), "utf8"));
const bundle = {
  ...draft,
  generation: {
    basedOnEditionId: "daily-2026-07-18",
    contextVersion: `ctx_${"a".repeat(64)}`,
    contextRevision: 9,
    reactions: [],
  },
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
    response.end(`{"id":"${bundle.id}","status":"published"}`);
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

test("rejects an invalid bundle locally before making a publication request", async () => {
  const file = await bundleFile({ ...bundle, generation: { ...bundle.generation, contextRevision: -1 } });
  try {
    const result = await run(file.path, "http://127.0.0.1:1", "private-token");
    assert.equal(result.code, 1);
    assert.match(result.stderr, /validation failed.*contextRevision/i);
    assert.doesNotMatch(result.stdout + result.stderr, /private-token/);
  } finally {
    await file.cleanup();
  }
});

test("captures a private context and prepares an edition with the exact snapshot", async () => {
  const context = {
    profile: { masthead: draft.masthead, language: draft.language, timezone: "Asia/Taipei" },
    currentEdition: { id: "daily-2026-07-18" },
    reactions: [{ id: 5, action: "less", createdAt: "2026-07-19T01:02:03.000Z", story: { headline: "Private context" } }],
    preferenceMemory: { reactionCount: 0, topics: [], formats: [], depths: [], styles: [], importance: [] },
    contextVersion: `ctx_${"b".repeat(64)}`,
    contextRevision: 12,
  };
  const received = requestOnce((request, response) => {
    assert.equal(request.method, "GET");
    assert.equal(request.url, "/api/agent/context");
    assert.equal(request.headers.authorization, "Bearer private-token");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(context));
  });
  const directory = await mkdtemp(join(tmpdir(), "personal-newspaper-pipeline-"));
  const contextPath = join(directory, "context.json");
  const draftPath = join(directory, "draft.json");
  const outputPath = join(directory, "edition.json");
  await writeFile(draftPath, JSON.stringify(draft));
  const url = await received.url;

  try {
    const captured = await runScript(contextCli, ["--output", contextPath, "--url", url], { AUTOMATION_TOKEN: "private-token" });
    assert.equal(captured.code, 0);
    assert.doesNotMatch(captured.stdout + captured.stderr, /private-token|Private context/);
    assert.deepEqual(JSON.parse(await readFile(contextPath, "utf8")), context);

    const prepared = await runScript(prepareCli, ["--draft", draftPath, "--context", contextPath, "--output", outputPath]);
    assert.equal(prepared.code, 0);
    const result = JSON.parse(await readFile(outputPath, "utf8"));
    assert.deepEqual(result.generation, {
      basedOnEditionId: "daily-2026-07-18",
      contextVersion: context.contextVersion,
      contextRevision: 12,
      reactions: [{ id: 5, action: "less", createdAt: "2026-07-19T01:02:03.000Z" }],
    });
  } finally {
    await received.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("restores an explicit previous edition without exposing the token", async () => {
  const received = requestOnce((request, response, body) => {
    assert.equal(request.method, "DELETE");
    assert.equal(request.url, "/api/agent/editions");
    assert.equal(request.headers.authorization, "Bearer private-token");
    assert.deepEqual(JSON.parse(body), {
      targetEditionId: "daily-2026-07-18",
      expectedCurrentEditionId: "daily-2026-07-19",
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"id":"daily-2026-07-18","status":"restored"}');
  });
  const url = await received.url;

  try {
    const result = await runScript(
      restoreCli,
      ["--id", "daily-2026-07-18", "--expected-current", "daily-2026-07-19", "--url", url],
      { AUTOMATION_TOKEN: "private-token" },
    );
    assert.equal(result.code, 0);
    assert.match(result.stdout, /restored daily-2026-07-18/i);
    assert.doesNotMatch(result.stdout + result.stderr, /private-token/);
  } finally {
    await received.stop();
  }
});

async function bundleFile(value = bundle) {
  const directory = await mkdtemp(join(tmpdir(), "personal-newspaper-"));
  const path = join(directory, "edition.json");
  await writeFile(path, JSON.stringify(value));
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
  return runScript(cli, args, environment);
}

async function runScript(script, args, environment = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(script), ...args], {
      env: { ...process.env, ...environment },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
