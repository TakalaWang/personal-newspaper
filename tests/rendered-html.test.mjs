import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("redirects unsigned readers to ChatGPT sign-in", async () => {
  const response = await render();
  assert.equal(response.status, 307);
  assert.match(response.headers.get("location") ?? "", /\/signin-with-chatgpt\?return_to=%2F$/);
});

test("ships the private reader instead of the starter preview", async () => {
  const [css, page, layout, packageJson, reader] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/EditionReader.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /requireChatGPTUser/);
  assert.match(page, /getEditionBundle/);
  assert.match(page, /Onboarding/);
  assert.match(layout, /title:\s*"The Personal Daily"/);
  assert.match(reader, /sandbox="allow-scripts"/);
  assert.match(reader, /api\/reactions/);
  assert.match(reader, /api\/shares/);
  assert.match(css, /--surface: oklch\(94\.8% 0\.006 85\)/);
  assert.match(css, /data-theme="salmon"/);
  assert.match(css, /data-theme="evening"/);
  assert.match(css, /\.theme-dialog/);
  assert.match(reader, /personal-newspaper-theme/);
  assert.match(reader, /灰白晨報.*鮭色財經.*藍灰晚報/s);
  assert.match(reader, /themeCss\(theme\)/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(
    access(new URL("app/_sites-preview", templateRoot)),
  );
});

test("uses paper-turn navigation with story-level feedback inside each article", async () => {
  const reader = await readFile(new URL("../app/EditionReader.tsx", import.meta.url), "utf8");

  assert.match(reader, /page\.section/);
  assert.match(reader, /story\.pageId/);
  assert.match(reader, /postMessage/);
  assert.match(reader, /story-dialog/);
  assert.match(reader, /aria-label="上一頁"/);
  assert.match(reader, /aria-label="下一頁"/);
  assert.match(reader, /data-turn=/);
  assert.match(reader, /onAnimationEnd=/);
  assert.match(reader, /document\.body\.getBoundingClientRect\(\)\.height/);
  assert.match(reader, /measure-page/);
  assert.doesNotMatch(reader, /document\.documentElement\.scrollHeight/);
  assert.doesNotMatch(reader, /useState\(1120\)/);
  assert.doesNotMatch(reader, /className="edition-pages"/);
  assert.doesNotMatch(reader, /閱讀全文 →/);
  assert.doesNotMatch(reader, /edition-dispatch/);
  assert.doesNotMatch(reader, /reading-rail/);
  assert.match(reader, /<dialog className="theme-dialog"/);
  assert.match(reader, /localStorage\.setItem\(THEME_STORAGE_KEY/);
});
