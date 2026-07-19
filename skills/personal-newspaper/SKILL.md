---
name: personal-newspaper
description: Produces, publishes, verifies, restores, and schedules this project's evidence-backed personalized newspaper. Use when setting up its owner profile, generating or refreshing an edition, learning from love/less reactions, changing sections or print layout, checking publication status, recovering a failed edition, or managing its daily Codex Automation.
compatibility: Requires this personal-newspaper repository, pnpm, HTTPS web and browser access, PAPER_URL, and a secret AUTOMATION_TOKEN.
metadata:
  author: personal-newspaper
  version: "1.0.0"
---

# Personal Newspaper

Produce an immutable newspaper edition that is already useful on the printed page and becomes more detailed when opened. Use model judgment for research and editing; use the bundled commands for snapshot, validation, publication, and recovery because those state transitions must be deterministic.

Keep `AUTOMATION_TOKEN` secret. Send it only as a bearer token to `PAPER_URL`; never print it, place it in an edition, or commit temporary context files.

## Route the task

- **Setup or profile update:** Read [the publication pipeline](references/pipeline.md), then confirm only missing or changed profile fields. Save the full profile and run **Publish now**. Maintain exactly one daily automation.
- **Publish now:** Read [the publication pipeline](references/pipeline.md), [the edition contract](references/edition-contract.md), and [the newspaper base design](references/base-design.md) completely. Execute every gate in order.
- **Status:** Fetch agent context and report masthead, language, timezone, publication time, current edition id/date/status, and pending reaction count. Never reveal raw reactions.
- **Layout-only work:** Read [the newspaper base design](references/base-design.md). Do not change the editorial or security contract.

## Publish now

Work from the `personal-newspaper` project directory. Use a private temporary directory for the context snapshot, draft, and prepared bundle.

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

6. Remove the private temporary directory after verified publication or verified restoration.

Stop on uncertain evidence, failed image provenance, validation failure, browser failure, or stale-context `409`. A stale snapshot means the content no longer represents the complete feedback set: capture new context and regenerate under a new edition id. Never weaken validation, hand-edit `generation`, publish a fallback, or consume feedback that did not shape the edition.

## Daily automation prompt

Use this exact prompt for the single daily Codex Automation:

```text
From the project root, read personal-newspaper/skills/personal-newspaper/SKILL.md completely and execute its Publish now workflow for today's confirmed local date. Use personal-newspaper as the working directory after reading the skill. Load PAPER_URL and AUTOMATION_TOKEN from .env.local without printing or persisting the token. Read every reference required by the workflow, use the bundled pnpm commands for context capture, preparation, validation, publication, and recovery, and complete source, image, security, desktop, exactly-560px, phone, complete-sheet silhouette, left/right edge hover/focus and touch page-turn, reduced-motion, whole-article opening, drop-cap, live-reader, and post-publication context verification. Derive each page composition from today's story count, importance, copy measure, evidence imagery, and section relationships. Inspect the current live edition's silhouette first; do not copy its composition or the template CSS. When content permits, change at least two structural dimensions per corresponding page: lead position, dominant span, visual position, brief axis, or module count. Balance independent lanes so alignment cavities and neighboring lane-ending differences stay within four body lines when enough verified copy exists; merge a thin subject rather than padding it. If the same silhouette is editorially necessary, record the evidence-based reason in the private layout brief; variation must never be random decoration. The printed sheet must be dense and asymmetric, with no navbar, top tabs, giant hero, fixed blank field, vertical article stack, or read-more button; original-source actions appear only inside the opened detail. Do not modify the site, schema, skill, or automation; do not omit or hand-edit the reaction snapshot; do not weaken a gate, reuse an edition id, create a fallback, or claim success from the POST response alone. On stale context, regenerate from a new snapshot and new id. On failed live verification, atomically restore only the failed edition's direct predecessor while the failed edition is still current, then verify the restoration.
```

## Skill self-check

After editing this skill, run `pnpm skill:validate`, the official Agent Skills validator, the eval cases in `evals/evals.json`, and the application test suite before deployment.
