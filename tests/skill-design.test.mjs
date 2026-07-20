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
  assert.ok(description.startsWith("Use when "), "description must expose trigger conditions before workflow details");
  assert.match(description, /publish|publishing/i);
  assert.ok(compatibility.length > 0 && compatibility.length <= 500);
  assert.ok(skill.split("\n").length < 500);
  assert.match(skill, /references\/pipeline\.md/);
  assert.match(skill, /references\/edition-contract\.md/);
  assert.match(skill, /references\/base-design\.md/);
  assert.match(skill, /pnpm edition:prepare/);
  assert.match(skill, /pnpm edition:validate/);
  assert.match(skill, /pnpm edition:publish/);
  assert.match(skill, /## Daily automation prompt/);
  assert.match(skill, /## First-run setup/);
  assert.match(skill, /automation_update/);
  assert.match(skill, /list_projects/);
  assert.match(skill, /verify.*automation/is);
  assert.match(skill, /update.*existing.*automation.*never.*duplicate/is);
  assert.match(skill, /publish.*before.*automation/is);
  assert.match(skill, /unattended standalone daily run/i);
  assert.match(skill, /do not depend on.*prior session/i);
  assert.match(skill, /remove.*private temporary directory.*every exit path/is);
  assert.match(skill, /multiple automation candidates.*stop.*report.*conflict/is);
  assert.match(skill, /automation candidates.*stable automation id.*or.*exact name.*exact project/is);
  assert.match(skill, /unique nearest ancestor.*repository root/is);
  assert.match(skill, /no project.*ancestor.*stop.*report.*incomplete/is);
  assert.match(skill, /multiple projects.*same nearest ancestor.*stop.*ask.*owner/is);
  assert.match(skill, /entire automation prompt.*byte-for-byte equal/is);
  assert.match(skill, /do not claim.*unattended.*proven.*successful scheduled run/is);
  assert.match(skill, /do not copy its composition or the template CSS/i);
  assert.match(skill, /change at least two structural dimensions/i);
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
  assert.match(pipeline, /adaptive layout brief/i);
  assert.match(pipeline, /current live edition.*silhouette/is);
  assert.match(pipeline, /Do not begin from the template CSS/i);
  assert.match(pipeline, /variation.*never be random|random variation/is);
  assert.match(pipeline, /12-column page map/i);
  assert.match(pipeline, /persistent vertical seam/i);
  assert.match(pipeline, /three distinct occupied spans/i);
  assert.match(pipeline, /1\.30.*1\.55/is);

  assert.match(contract, /data-claim-id/);
  assert.match(contract, /summaryHtml.*bodyHtml/is);
  assert.match(contract, /same thesis.*facts/is);
  assert.match(contract, /source.*links.*detail/is);
  assert.match(contract, /claim.*source/is);
  assert.match(contract, /generation\.contextRevision/);
  assert.match(contract, /Never copy its page CSS/i);

  assert.match(baseDesign, /empty.*article.*data-story-id/is);
  assert.match(baseDesign, /no visible text|no visible prose/i);
  assert.match(baseDesign, /summaryHtml/);
  assert.match(baseDesign, /alt text.*caption.*credit/is);
  assert.match(baseDesign, /explanatory|evidence-bearing/i);
  assert.match(baseDesign, /source links.*detailed reader/is);
  assert.match(baseDesign, /6–12 column/);
  assert.match(baseDesign, /stepped seam/i);
  assert.match(baseDesign, /three distinct module widths/i);
  assert.match(baseDesign, /persistent vertical split/i);
  assert.match(baseDesign, /A-series portrait/i);
  assert.match(baseDesign, /Only screens narrower than 560px/);
  assert.match(baseDesign, /silhouette/i);
  assert.match(baseDesign, /Do not repeat the same composition on adjacent pages/);
  assert.match(baseDesign, /Text columns alone do not count/);
  assert.match(baseDesign, /at least two of/i);
  assert.match(baseDesign, /same-sized.*four-sided/is);
  assert.match(baseDesign, /at least 64px.*desktop/is);
  assert.match(baseDesign, /unboxed.*page-turn/is);
  assert.match(baseDesign, /redundant.*section.*story-count/is);
  assert.match(baseDesign, /Editorial coherence.*density/is);
  assert.match(baseDesign, /At exactly 560px/);
  assert.match(baseDesign, /data-contract sample/i);
  assert.match(baseDesign, /consecutive editions/i);
  assert.match(baseDesign, /current live edition/i);
  assert.match(baseDesign, /Random rearrangement/i);
  assert.match(baseDesign, /independent vertical lanes/i);
  assert.match(baseDesign, /column-fill: balance/i);
  assert.match(baseDesign, /semantic variables/i);
  assert.doesNotMatch(baseDesign, /追蹤主題/);
  assert.match(design, /newsprint.*salmon.*modern white/is);
  assert.match(design, /independent vertical lanes/i);
  assert.doesNotMatch(design, /brass/);

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
  assert.equal(parsedTemplate.pages.length, 2, "the smoke fixture must combine its thin two-story section");
  const fixtureStoryCounts = Object.groupBy(parsedTemplate.stories, (story) => story.pageId);
  assert.equal(fixtureStoryCounts.front?.length, 5);
  assert.equal(fixtureStoryCounts.technology?.length, 4);
  for (const page of parsedTemplate.pages) {
    assert.match(page.css, /@media\(max-width:479px\)/, `${page.id} needs a phone-only single-column breakpoint`);
    assert.doesNotMatch(page.css, /@media\(max-width:559px\)/, `${page.id} must preserve mixed paths at 560px`);
  }
  assert.match(parsedTemplate.pages[0].html, /front-mosaic/);
  assert.match(parsedTemplate.pages[0].css, /repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(parsedTemplate.pages[0].css, /grid-column:1\/9/);
  assert.match(parsedTemplate.pages[0].css, /grid-column:9\/13/);
  assert.match(parsedTemplate.pages[0].css, /grid-column:1\/6/);
  assert.match(parsedTemplate.pages[0].css, /grid-column:6\/13/);
  assert.match(parsedTemplate.pages[0].css, /analysis-wide.*grid-column:1\/13/);
  assert.match(parsedTemplate.pages[0].css, /@media\(max-width:880px\).*\.lead\{grid-column:1\/8\}\.brief\{grid-column:8\/13\}/);
  assert.doesNotMatch(parsedTemplate.pages[0].css, /5fr\).*3fr/);
  assert.match(parsedTemplate.pages[0].css, /column-fill:balance/);
  assert.match(parsedTemplate.pages[1].html, /technology-mosaic/);
  assert.match(parsedTemplate.pages[1].css, /grid-column:1\/13/);
  assert.match(parsedTemplate.pages[1].css, /grid-column:1\/6/);
  assert.match(parsedTemplate.pages[1].css, /grid-column:6\/13/);
  assert.match(parsedTemplate.pages[1].css, /tomorrow-story.*grid-column:1\/13/);
  assert.doesNotMatch(parsedTemplate.pages[1].css, /2fr\).*1fr/);
  assert.match(baseDesign, /lane endings.*four body lines/is);
  assert.match(baseDesign, /preserve.*original color/is);
  assert.doesNotMatch(template, /grayscale\(/i);
});
