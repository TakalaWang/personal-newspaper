import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("follows the Agent Skills structure and progressive-disclosure contract", async () => {
  const [skill, pipeline, contract, baseDesign, evals, template, design] = await Promise.all([
    readFile(new URL("skills/personal-newspaper/SKILL.md", root), "utf8"),
    readFile(new URL("skills/personal-newspaper/references/pipeline.md", root), "utf8"),
    readFile(new URL("skills/personal-newspaper/references/edition-contract.md", root), "utf8"),
    readFile(new URL("skills/personal-newspaper/references/base-design.md", root), "utf8"),
    readFile(new URL("skills/personal-newspaper/evals/evals.json", root), "utf8"),
    readFile(new URL("skills/personal-newspaper/assets/edition-template.json", root), "utf8"),
    readFile(new URL("DESIGN.md", root), "utf8"),
  ]);

  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const compatibility = frontmatter.match(/^compatibility:\s*(.+)$/m)?.[1]?.trim() ?? "";
  assert.equal(name, "personal-newspaper");
  assert.match(name, /^(?!-)(?!.*--)[a-z0-9-]+(?<!-)$/);
  assert.ok(description.length > 0 && description.length <= 1024);
  assert.match(description, /publish|publishing/i);
  assert.match(description, /Use when/i);
  assert.ok(compatibility.length > 0 && compatibility.length <= 500);
  assert.ok(skill.split("\n").length < 500);
  assert.match(skill, /references\/pipeline\.md/);
  assert.match(skill, /references\/edition-contract\.md/);
  assert.match(skill, /references\/base-design\.md/);
  assert.match(skill, /pnpm edition:prepare/);
  assert.match(skill, /pnpm edition:validate/);
  assert.match(skill, /pnpm edition:publish/);
  assert.match(skill, /## Daily automation prompt/);
  assert.doesNotMatch(skill, /BASE_DESIGN\.md/);
  assert.doesNotMatch(skill, /追蹤主題/);

  assert.match(pipeline, /latent preference brief/i);
  assert.match(pipeline, /evidence ledger/i);
  assert.match(pipeline, /preferenceMemory/);
  assert.match(pipeline, /contextRevision/);
  assert.match(pipeline, /generation\.reactions/);
  assert.match(pipeline, /generation\.contextVersion/);
  assert.match(pipeline, /expected-current/);
  assert.match(pipeline, /love.*less|喜歡.*不喜歡/is);
  assert.match(pipeline, /repeated signals/i);
  assert.match(pipeline, /sensitive traits/i);
  assert.match(pipeline, /preferenceTags/);
  assert.match(pipeline, /publish.*verify/is);
  assert.match(pipeline, /edition:restore/);
  assert.match(pipeline, /atomically restore/i);

  assert.match(contract, /data-claim-id/);
  assert.match(contract, /summaryHtml.*bodyHtml/is);
  assert.match(contract, /same thesis.*facts/is);
  assert.match(contract, /source.*links.*detail/is);
  assert.match(contract, /claim.*source/is);
  assert.match(contract, /generation\.contextRevision/);

  assert.match(baseDesign, /empty.*article.*data-story-id/is);
  assert.match(baseDesign, /no visible text|no visible prose/i);
  assert.match(baseDesign, /summaryHtml/);
  assert.match(baseDesign, /alt text.*caption.*credit/is);
  assert.match(baseDesign, /explanatory|evidence-bearing/i);
  assert.match(baseDesign, /source links.*detailed reader/is);
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
  assert.doesNotMatch(baseDesign, /追蹤主題/);
  assert.match(design, /newsprint.*deep press red/is);
  assert.doesNotMatch(design, /blue-gray|brass/);

  const parsedEvals = JSON.parse(evals);
  assert.equal(parsedEvals.skill_name, "personal-newspaper");
  assert.ok(parsedEvals.evals.length >= 4);
  for (const evaluation of parsedEvals.evals) {
    assert.ok(Number.isSafeInteger(evaluation.id));
    assert.ok(evaluation.prompt.length > 20);
    assert.ok(evaluation.expected_output.length > 20);
    assert.ok(evaluation.expectations.length >= 3);
  }

  const parsedTemplate = JSON.parse(template);
  assert.equal("generation" in parsedTemplate, false);
  assert.doesNotMatch(template, /ctx_0{64}/);
  for (const page of parsedTemplate.pages) {
    assert.match(page.css, /@media\(max-width:479px\)/, `${page.id} needs a phone-only single-column breakpoint`);
    assert.doesNotMatch(page.css, /@media\(max-width:559px\)/, `${page.id} must preserve mixed paths at 560px`);
  }
});
