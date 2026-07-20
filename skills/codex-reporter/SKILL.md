---
name: codex-reporter
description: Use when a user asks Codex to create, publish, refresh, personalize, recover, or schedule a personal newspaper website, including a first run in a new project and unattended daily editions that learn from like and dislike feedback.
---

# Codex Reporter

Create and operate one reader-owned Sites newspaper. The printed page must already explain each report; opening a story adds depth, figures when useful, and original-source links. Use model judgment for research and editing, and the bundled commands for deterministic state transitions.

Never ask the reader to configure deployment settings, enter an environment variable, clone this repository, install pnpm, or reuse the example deployment. First-run setup provisions a new Sites project and generates a private runtime credential for the reader. Never print that credential, put it in an edition, or commit runtime or temporary files.

## Route the task

- **Setup:** Follow **First-run setup** in a new or empty project.
- **Profile update:** Ask only about changed profile fields. Republish only when the reader asks; update the automation only when its schedule changes.
- **Publish now:** Read [the publication pipeline](references/pipeline.md), [the edition contract](references/edition-contract.md), and [the newspaper base design](references/base-design.md) completely. Execute every gate in order.
- **Status:** Fetch agent context and report masthead, language, timezone, publication time, current edition id/date/status, and pending reaction count. Never reveal raw reactions.
- **Layout-only work:** Read [the newspaper base design](references/base-design.md). Do not change the editorial or security contract.

## First-run setup

Read [the first-run installation workflow](references/first-run.md) completely and execute it in order. It creates an isolated site, interviews the reader, publishes and verifies edition one, then creates or repairs exactly one schedule. Never schedule a job that has not already published successfully.

The interview session may end after both the live edition and automation are verified. Profile, reactions, editions, credentials, and schedule are persistent; the daily job must not depend on this conversation remaining open. Report scheduling as installed but do not claim unattended publishing is proven until a successful scheduled run has published and passed live verification.

## Publish now

Work from the generated newspaper project root. Load the Skill-provisioned private runtime values into the process without displaying them. Use a private temporary directory for the context snapshot, draft, and prepared bundle.

1. Capture the exact agent context:

   ```bash
   pnpm edition:context -- --output "$EDITION_CONTEXT" --url "$PAPER_URL"
   ```

2. Follow the research, preference, evidence, editorial, adaptive-layout, canonical-copy, image, and page-composition gates in [the publication pipeline](references/pipeline.md). Write a draft that matches the field structure demonstrated by `assets/edition-template.json`, but never copy its page CSS, module spans, or silhouette; omit `generation`.
3. Bind the draft to the exact snapshot, then validate it locally:

   ```bash
   pnpm edition:prepare -- --draft "$EDITION_DRAFT" --context "$EDITION_CONTEXT" --output "$EDITION_BUNDLE"
   pnpm edition:validate -- --file "$EDITION_BUNDLE"
   ```

4. Complete real desktop, exactly-560px, and phone browser preflight. Publish only after every gate passes:

   ```bash
   pnpm edition:publish -- --file "$EDITION_BUNDLE" --url "$PAPER_URL"
   ```

5. Fetch context again and inspect the live reader. A successful POST is not publication proof. If live verification fails, atomically restore only the direct predecessor named by the failed bundle:

   ```bash
   pnpm edition:restore -- --id "$PREVIOUS_EDITION_ID" --expected-current "$FAILED_EDITION_ID" --url "$PAPER_URL"
   ```

   If restore returns `409`, do not retry or force an older edition current. Capture fresh context, inspect the actual live reader, and end the run as failed with the failed id and evidence-backed current id/status.

6. Remove the private temporary directory on every exit path: verified publication, pre-publication failure, stale-context regeneration, verified restoration, or an unrecoverable restore race.

Stop on uncertain evidence, failed image provenance, validation failure, browser failure, or stale-context `409`. A stale snapshot means the content no longer represents the complete feedback set: capture new context and regenerate under a new edition id. Never weaken validation, hand-edit `generation`, publish a fallback, or consume feedback that did not shape the edition.

## Daily automation prompt

Use this exact prompt for the single daily Codex Automation:

```text
This is an unattended standalone daily run. Do not depend on any prior session context or ask the owner for routine editorial choices. From the project root, read skills/codex-reporter/SKILL.md completely and execute its Publish now workflow for today's confirmed local date. Load .codex-reporter/runtime.env into the process without printing, copying, or changing it. Read every reference required by the workflow, use the bundled pnpm commands for context capture, preparation, validation, publication, and recovery, and complete source, image, security, desktop, exactly-560px, phone, complete-sheet silhouette, left/right edge hover/focus and touch page-turn, reduced-motion, whole-article opening, drop-cap, live-reader, and post-publication context verification. Derive each page composition from today's story count, importance, copy measure, evidence imagery, and section relationships. Inspect the current live edition's silhouette first; do not copy its composition or the template CSS. Before page HTML or CSS, draw a private 12-column page map with each package's band, start, end, occupied span, and internal interruption. Reject a persistent vertical seam that makes the complete page merely left and right columns. A page with four or more packages must use at least three distinct occupied spans, offset a seam between adjacent bands, and include one cross-column or compound internal interruption; a three-package page must use a crossing or offset band plus an unequal band, or a compound lead. When content permits, change at least two structural dimensions per corresponding page: lead position, dominant span, visual position, brief axis, or module count. Balance independent lanes so alignment cavities and neighboring lane-ending differences stay within four body lines when enough verified copy exists; merge a thin subject rather than padding it. In desktop preflight, measure the content-sized sheet and target a height-to-width ratio from 1.30 through 1.55 without fixed height, min-height, spacer modules, filler copy, oversized padding, or empty image wells. Use at most one terse terminal note per package; the trusted reader will place it on the same final rule as like/dislike, so never create a detached metadata or feedback strip. If the same silhouette is editorially necessary, record the evidence-based reason in the private layout brief; variation must never be random decoration. The printed sheet must be dense and asymmetric, with no navbar, top tabs, giant hero, fixed blank field, vertical article stack, or read-more button; original-source actions appear only inside the opened detail. Do not modify the site, schema, skill, or automation; do not omit or hand-edit the reaction snapshot; do not weaken a gate, reuse an edition id, create a fallback, or claim success from the POST response alone. On stale context, regenerate from a new snapshot and new id. On failed live verification, atomically restore only the failed edition's direct predecessor while the failed edition is still current, then verify the restoration.
```

## Skill self-check

After editing this skill, run `pnpm flow:verify-empty`, the official Agent Skills validator, the eval cases in `evals/evals.json`, and the application test suite before deployment.
