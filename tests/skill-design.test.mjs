import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("defines a print-first base design and daily edition prompt", async () => {
  const [skill, baseDesign, design] = await Promise.all([
    readFile(new URL("skills/personal-newspaper/SKILL.md", root), "utf8"),
    readFile(new URL("skills/personal-newspaper/BASE_DESIGN.md", root), "utf8"),
    readFile(new URL("DESIGN.md", root), "utf8"),
  ]);

  assert.match(skill, /REQUIRED REFERENCE.*BASE_DESIGN\.md/);
  assert.match(skill, /## Daily edition prompt/);
  assert.match(baseDesign, /6–12 column/);
  assert.match(baseDesign, /central lead|off-centre lead/);
  assert.match(baseDesign, /Only screens narrower than 560px/);
  assert.match(baseDesign, /silhouette/i);
  assert.match(baseDesign, /Do not repeat the same composition on adjacent pages/);
  assert.match(baseDesign, /Text columns alone do not count/);
  assert.match(baseDesign, /at least two of/i);
  assert.match(baseDesign, /same-sized.*four-sided/is);
  assert.match(baseDesign, /Editorial coherence.*density/is);
  assert.match(baseDesign, /At exactly 560px/);
  assert.match(baseDesign, /9\/3 feature.*not.*sidebar/is);
  assert.match(design, /newsprint.*deep press red/is);
  assert.doesNotMatch(design, /blue-gray|brass/);
});
