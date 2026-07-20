import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseProfileUpdate } from "../lib/agent.ts";
import { validateEditionBundle } from "../lib/edition.ts";

const cli = new URL("../skills/personal-newspaper/scripts/publish-edition.mjs", import.meta.url);
const restoreCli = new URL("../skills/personal-newspaper/scripts/restore-edition.mjs", import.meta.url);
const contextCli = new URL("../skills/personal-newspaper/scripts/snapshot-context.mjs", import.meta.url);
const prepareCli = new URL("../skills/personal-newspaper/scripts/prepare-edition.mjs", import.meta.url);
const validateCli = new URL("../skills/personal-newspaper/scripts/validate-edition.mjs", import.meta.url);
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

test("runs the empty first-run pipeline without touching production state", async () => {
  const [packageText, readme, skill] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../skills/personal-newspaper/SKILL.md", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageText);
  assert.equal(
    packageJson.scripts["flow:verify-empty"],
    "node --import ./tests/cloudflare-loader.mjs --test --test-name-pattern='empty first-run pipeline' tests/publish-edition.test.mjs && pnpm skill:validate",
  );
  assert.match(readme, /pnpm flow:verify-empty/);
  assert.match(skill, /pnpm flow:verify-empty/);

  const paper = emptyPaper();
  const url = await paper.url;
  const directory = await mkdtemp(join(tmpdir(), "personal-newspaper-empty-flow-"));
  const contextPath = join(directory, "context.json");
  const draftPath = join(directory, "draft.json");
  const outputPath = join(directory, "edition.json");
  const token = "empty-flow-token";
  const profile = {
    ownerEmail: "reader@example.com",
    masthead: draft.masthead,
    language: draft.language,
    timezone: "Asia/Taipei",
    publicationTime: "00:00",
    preferences: { topics: ["AI", "science"], exclusions: [] },
  };

  try {
    const initial = await agentJson(url, "/api/agent/context", token);
    assert.equal(initial.profile, undefined);
    assert.equal(initial.currentEdition, undefined);

    const saved = await agentJson(url, "/api/agent/profile", token, { method: "PUT", body: profile });
    assert.deepEqual(saved.profile, profile);
    await writeFile(draftPath, JSON.stringify(draft));

    const captured = await runScript(contextCli, ["--output", contextPath, "--url", url], { AUTOMATION_TOKEN: token });
    assert.equal(captured.code, 0, captured.stderr);
    const context = JSON.parse(await readFile(contextPath, "utf8"));
    assert.deepEqual(context.profile, profile);
    assert.equal(context.currentEdition, undefined);
    assert.equal(context.contextRevision, 1);

    const prepared = await runScript(prepareCli, ["--draft", draftPath, "--context", contextPath, "--output", outputPath]);
    assert.equal(prepared.code, 0, prepared.stderr);
    const checked = await runScript(validateCli, ["--file", outputPath]);
    assert.equal(checked.code, 0, checked.stderr);
    const published = await run(outputPath, url, token);
    assert.equal(published.code, 0, published.stderr);

    const final = await agentJson(url, "/api/agent/context", token);
    assert.equal(final.currentEdition.id, draft.id);
    assert.equal(final.currentEdition.status, "published");
    assert.equal(final.currentEdition.manifest.pageCount, draft.pages.length);
    assert.equal(final.currentEdition.manifest.storyCount, draft.stories.length);
    assert.equal(final.currentEdition.manifest.sourceCount, draft.sources.length);
    assert.equal(final.reactions.length, 0);
    assert.equal(paper.publishedBundle.generation.basedOnEditionId, null);
    assert.deepEqual(paper.publishedBundle.generation.reactions, []);
    assert.doesNotMatch([captured, prepared, checked, published].flatMap((result) => [result.stdout, result.stderr]).join("\n"), new RegExp(token));
  } finally {
    await paper.stop();
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

function emptyPaper() {
  let profile;
  let currentEdition;
  let revision = 0;
  const state = { publishedBundle: undefined };
  const context = () => {
    const value = {
      profile,
      currentEdition,
      reactions: [],
      preferenceMemory: { reactionCount: 0, topics: [], formats: [], depths: [], styles: [], importance: [] },
      contextRevision: revision,
    };
    return { ...value, contextVersion: `ctx_${createHash("sha256").update(JSON.stringify(value)).digest("hex")}` };
  };
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== "Bearer empty-flow-token") return jsonResponse(response, 401, { error: "Unauthorized" });
    try {
      if (request.method === "GET" && request.url === "/api/agent/context") {
        return jsonResponse(response, 200, context());
      }
      if (request.method === "PUT" && request.url === "/api/agent/profile") {
        profile = parseProfileUpdate(JSON.parse(await readBody(request)));
        revision += 1;
        return jsonResponse(response, 200, { profile });
      }
      if (request.method === "POST" && request.url === "/api/agent/editions") {
        const snapshot = context();
        const bundle = validateEditionBundle(JSON.parse(await readBody(request)));
        assert.equal(bundle.generation.basedOnEditionId, null);
        assert.equal(bundle.generation.contextVersion, snapshot.contextVersion);
        assert.equal(bundle.generation.contextRevision, snapshot.contextRevision);
        state.publishedBundle = bundle;
        currentEdition = {
          id: bundle.id,
          date: bundle.date,
          status: "published",
          manifest: {
            pageCount: bundle.pages.length,
            storyCount: bundle.stories.length,
            sourceCount: bundle.sources.length,
          },
        };
        revision += 1;
        return jsonResponse(response, 201, { id: bundle.id, status: "published" });
      }
      return jsonResponse(response, 404, { error: "Not found" });
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : "Invalid request" });
    }
  });
  return Object.assign(state, {
    url: new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    })),
    stop: () => new Promise((resolve) => server.close(resolve)),
  });
}

async function agentJson(url, path, token, options = {}) {
  const response = await fetch(new URL(path, url), {
    method: options.method,
    headers: { authorization: `Bearer ${token}`, ...(options.body && { "content-type": "application/json" }) },
    body: options.body && JSON.stringify(options.body),
  });
  const body = await response.json();
  assert.ok(response.ok, `${response.status}: ${body.error ?? "request failed"}`);
  return body;
}

function jsonResponse(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
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
