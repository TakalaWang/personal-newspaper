import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("follows the Agent Skills structure and progressive-disclosure contract", async () => {
  const [skill, firstRun, pipeline, contract, baseDesign, evals, template, design] = await Promise.all([
    readFile(new URL("skills/personal-newspaper/SKILL.md", root), "utf8"),
    readFile(new URL("skills/personal-newspaper/references/first-run.md", root), "utf8"),
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
  const frontmatterKeys = frontmatter
    .split("\n")
    .map((line) => line.match(/^([a-zA-Z][\w-]*):/)?.[1])
    .filter(Boolean);
  assert.equal(name, "personal-newspaper");
  assert.match(name, /^(?!-)(?!.*--)[a-z0-9-]+(?<!-)$/);
  assert.ok(description.length > 0 && description.length <= 1024);
  assert.ok(description.startsWith("Use when "), "description must expose trigger conditions before workflow details");
  assert.match(description, /publish|publishing/i);
  assert.deepEqual(frontmatterKeys, ["name", "description"]);
  assert.ok(skill.split("\n").length < 500);
  assert.match(skill, /references\/pipeline\.md/);
  assert.match(skill, /references\/first-run\.md/);
  assert.match(skill, /references\/edition-contract\.md/);
  assert.match(skill, /references\/base-design\.md/);
  assert.match(skill, /pnpm edition:prepare/);
  assert.match(skill, /pnpm edition:validate/);
  assert.match(skill, /pnpm edition:publish/);
  assert.match(skill, /## Daily automation prompt/);
  assert.match(skill, /## First-run setup/);
  assert.match(firstRun, /automation_update/);
  assert.match(firstRun, /list_projects/);
  assert.match(firstRun, /verify.*automation/is);
  assert.match(firstRun, /update.*one candidate.*create one only/is);
  assert.match(skill, /publish.*before.*automation/is);
  assert.match(skill, /unattended standalone daily run/i);
  assert.match(skill, /do not depend on.*prior session/i);
  assert.match(skill, /remove.*private temporary directory.*every exit path/is);
  assert.match(firstRun, /stop if multiple candidates/is);
  assert.match(firstRun, /candidate.*saved automation id.*or.*exact name.*exact project/is);
  assert.match(firstRun, /unique nearest ancestor project/is);
  assert.match(firstRun, /no match.*ambiguous nearest match/is);
  assert.match(firstRun, /byte-for-byte equal prompt/is);
  assert.match(skill, /do not claim.*unattended.*proven.*successful scheduled run/is);
  assert.match(skill, /do not copy its composition or the template CSS/i);
  assert.match(skill, /change at least two structural dimensions/i);
  assert.doesNotMatch(skill, /BASE_DESIGN\.md/);
  assert.doesNotMatch(skill, /追蹤主題/);
  assert.doesNotMatch(skill, /\.env\.local/);
  assert.match(firstRun, /never reuse.*project_id.*URL.*credential.*D1.*R2/is);
  assert.match(firstRun, /do not ask.*environment variable/is);
  assert.match(firstRun, /Sites:create_site/);
  assert.match(firstRun, /Sites:update_environment_variables/);
  assert.match(firstRun, /pnpm profile:save/);
  assert.match(firstRun, /publish.*verify.*before.*schedule/is);

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
  assert.match(pipeline, /verbatim.*summary|summary.*verbatim/is);
  assert.match(pipeline, /pending.*saved.*error|儲存中.*已儲存.*失敗/is);
  assert.match(pipeline, /image-bearing story/i);

  assert.match(contract, /data-claim-id/);
  assert.match(contract, /summaryHtml.*bodyHtml/is);
  assert.match(contract, /same thesis.*facts/is);
  assert.match(contract, /source.*links.*detail/is);
  assert.match(contract, /claim.*source/is);
  assert.match(contract, /generation\.contextRevision/);
  assert.match(contract, /Never copy its page CSS/i);
  assert.match(contract, /materially expand|new reporting/i);

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
  assert.match(baseDesign, /detail.*figure.*column-span/is);
  assert.match(baseDesign, /duplicate.*headline/is);
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
  assert.equal(parsedTemplate.language, "en-US", "the public fixture must be the neutral English example");
  assert.equal(parsedTemplate.masthead, "The Personal Daily");
  assert.equal(parsedTemplate.pages.length, 2, "the smoke fixture must group stories into subject pages");
  const fixtureStoryCounts = Object.groupBy(parsedTemplate.stories, (story) => story.pageId);
  assert.equal(fixtureStoryCounts.front?.length, 5);
  assert.equal(fixtureStoryCounts.practice?.length, 3);
  for (const page of parsedTemplate.pages) {
    assert.match(page.css, /@media\(max-width:559px\)/, `${page.id} needs a phone-only single-column breakpoint`);
    assert.doesNotMatch(page.css, /@media\(max-width:560px\)/, `${page.id} must preserve mixed paths at exactly 560px`);
  }
  assert.match(parsedTemplate.pages[0].html, /front-grid/);
  assert.match(parsedTemplate.pages[0].css, /repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(parsedTemplate.pages[0].css, /grid-column:1\/10/);
  assert.match(parsedTemplate.pages[0].css, /grid-column:10\/13/);
  assert.match(parsedTemplate.pages[0].css, /grid-column:1\/6/);
  assert.match(parsedTemplate.pages[0].css, /grid-column:6\/13/);
  assert.match(parsedTemplate.pages[0].css, /questions.*grid-column:1\/13/);
  assert.match(parsedTemplate.pages[0].css, /@media\(max-width:880px\).*\.lead\{grid-column:1\/9\}\.dispatch\{grid-column:9\/13\}/);
  assert.doesNotMatch(parsedTemplate.pages[0].css, /5fr\).*3fr/);
  assert.match(parsedTemplate.pages[1].html, /practice-grid/);
  assert.match(parsedTemplate.pages[1].css, /grid-column:1\/13/);
  assert.match(parsedTemplate.pages[1].css, /grid-column:1\/8/);
  assert.match(parsedTemplate.pages[1].css, /grid-column:8\/13/);
  assert.match(parsedTemplate.pages[1].css, /boundary.*grid-column:1\/13/);
  assert.doesNotMatch(parsedTemplate.pages[1].css, /2fr\).*1fr/);
  assert.match(baseDesign, /lane endings.*four body lines/is);
  assert.match(baseDesign, /preserve.*original color/is);
  assert.doesNotMatch(template, /grayscale\(/i);
});
