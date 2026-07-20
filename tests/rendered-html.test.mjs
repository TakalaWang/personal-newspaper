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
  assert.match(css, /--surface: oklch\(91\.5% 0\.014 82\)/);
  assert.match(css, /data-theme="salmon"/);
  assert.match(css, /data-theme="modern"/);
  assert.match(css, /body:has\(\.edition-reader\[data-theme="salmon"\]\)/);
  assert.match(css, /\.page-turn\s*\{[\s\S]*width:\s*max\(4rem,/);
  assert.doesNotMatch(css, /width:\s*max\(1rem,\s*calc\(\(100vw - 80rem\)/);
  assert.match(css, /\.edition-stage\s*\{[\s\S]*width:\s*min\(64rem,/);
  assert.match(css, /\.page-turn\s*\{[\s\S]*calc\(\(100vw - 64rem\)/);
  assert.match(css, /\.page-turn-control > span\s*\{[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none;/);
  assert.match(reader, /<small>上一頁<\/small>/);
  assert.match(reader, /<small>下一頁<\/small>/);
  assert.doesNotMatch(css, /\.page-turn-control b/);
  assert.match(css, /\.theme-dialog/);
  assert.match(reader, /personal-newspaper-theme/);
  assert.match(reader, /暖灰新聞紙.*深酒紅正文.*深藍正文/s);
  assert.match(reader, /themeCss\(theme\)/);
  assert.match(reader, /setFrameReady\(true\)/);
  assert.match(reader, /page\.id.*theme.*frameReady/s);
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
  assert.match(reader, /new ResizeObserver\(publishHeight\)\.observe\(document\.body\)/);
  assert.doesNotMatch(reader, /new ResizeObserver\(publishHeight\)\.observe\(document\.documentElement\)/);
  assert.match(reader, /measure-page/);
  assert.match(reader, /onLoad=/);
  assert.match(reader, /event\.source !== pageFrameRef\.current\?\.contentWindow/);
  assert.match(reader, /event\.source !== articleFrameRef\.current\?\.contentWindow/);
  assert.doesNotMatch(reader, /const pageWindow =/);
  assert.doesNotMatch(reader, /const articleWindow =/);
  assert.doesNotMatch(reader, /publication-index/);
  assert.match(reader, /className="share-action"/);
  assert.match(reader, /建立本期分享連結/);
  assert.match(reader, /分享連結已複製；只會開啟本期報紙。/);
  assert.doesNotMatch(reader, />Active</);
  assert.doesNotMatch(reader, />Revoke</);
  assert.doesNotMatch(reader, /點選任一新聞區塊開啟完整報導/);
  assert.match(reader, /第 \$\{pageNumber\}／\$\{bundle\.pages\.length\} 頁/);
  assert.match(reader, /reader-story-footer/);
  assert.match(reader, /reader-story-note/);
  assert.match(reader, /:scope > \.byline, :scope > \.source, :scope > \.tomorrow/);
  assert.doesNotMatch(reader, /reader-controls \{ display: block !important; clear: both !important; margin-top: 12px !important; \}/);
  assert.doesNotMatch(reader, /document\.documentElement\.scrollHeight/);
  assert.doesNotMatch(reader, /useState\(1120\)/);
  assert.doesNotMatch(reader, /className="edition-pages"/);
  assert.doesNotMatch(reader, /閱讀全文 →/);
  assert.doesNotMatch(reader, /edition-dispatch/);
  assert.doesNotMatch(reader, /reading-rail/);
  assert.match(reader, /<dialog className="theme-dialog"/);
  assert.match(reader, /localStorage\.setItem\(THEME_STORAGE_KEY/);
});
