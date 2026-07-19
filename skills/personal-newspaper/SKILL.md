---
name: personal-newspaper
description: Use when a user asks to create, configure, publish, refresh, personalize, recover, or schedule this project's daily personal newspaper, including requests to discuss preferences once and let Codex update it automatically afterward.
compatibility: Requires this personal-newspaper repository, pnpm, HTTPS web and browser access, Codex Automation access, PAPER_URL, and a secret AUTOMATION_TOKEN.
metadata:
  author: personal-newspaper
  version: "1.0.0"
---

# Personal Newspaper

Produce an immutable newspaper edition that is already useful on the printed page and becomes more detailed when opened. Use model judgment for research and editing; use the bundled commands for snapshot, validation, publication, and recovery because those state transitions must be deterministic.

Keep `AUTOMATION_TOKEN` secret. Send it only as a bearer token to `PAPER_URL`; never print it, place it in an edition, or commit temporary context files.

## Route the task

- **Setup or profile update:** Follow **First-run setup**. For later changes, ask only about changed fields and update the existing automation only when its schedule must change.
- **Publish now:** Read [the publication pipeline](references/pipeline.md), [the edition contract](references/edition-contract.md), and [the newspaper base design](references/base-design.md) completely. Execute every gate in order.
- **Status:** Fetch agent context and report masthead, language, timezone, publication time, current edition id/date/status, and pending reaction count. Never reveal raw reactions.
- **Layout-only work:** Read [the newspaper base design](references/base-design.md). Do not change the editorial or security contract.

## First-run setup

1. Read [the publication pipeline](references/pipeline.md) and fetch current context. Confirm only these profile fields: owner email when authentication does not supply it, masthead, language, timezone, publication time, interests, and explicit exclusions. Ask one question at a time; never invent extra preference fields, tracking signals, storage, or deployment settings.
2. Save the complete confirmed profile, fetch fresh context, and execute **Publish now**. Verify the live edition before automation setup. If profile save or publication fails, stop and report that setup is incomplete; never schedule a job that cannot publish.
3. After verified publication, use `list_projects` to resolve the unique nearest ancestor project of the repository root: among projects whose path is the repository path or one of its filesystem ancestors, choose the longest path. If no project is an ancestor, stop and report that project resolution is incomplete. If multiple projects share the same nearest ancestor path, stop and ask the owner to resolve the project conflict. Inspect existing Codex automations. Define automation candidates as every automation with the stable automation id, or with both the exact name `Personal Newspaper daily edition` and exact project id. Treat prompt text as configuration to repair, not automation identity. If multiple automation candidates exist, stop and report the conflict; do not select, disable, delete, or create another without owner direction. Otherwise use `automation_update` to update the single candidate and never create a duplicate. Create it only when no candidate exists.
4. Configure one active local cron automation for the confirmed profile time, targeting that project, with the exact prompt below. Keep notifications at failed runs only unless the owner asks otherwise. Verify the automation is active, targets the correct project, shows the expected next local run, and has its entire automation prompt byte-for-byte equal to the prompt below. If Codex Automation access is unavailable, stop after publication and say explicitly that scheduling is incomplete.

The interview session may end after both the live edition and automation are verified. Profile, reactions, editions, credentials, and schedule are persistent; the daily job must not depend on this conversation remaining open. Report scheduling as installed but do not claim unattended publishing is proven until a successful scheduled run has published and passed live verification.

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

6. Remove the private temporary directory on every exit path: verified publication, pre-publication failure, stale-context regeneration, verified restoration, or an unrecoverable restore race.

Stop on uncertain evidence, failed image provenance, validation failure, browser failure, or stale-context `409`. A stale snapshot means the content no longer represents the complete feedback set: capture new context and regenerate under a new edition id. Never weaken validation, hand-edit `generation`, publish a fallback, or consume feedback that did not shape the edition.

## Daily automation prompt

Use this exact prompt for the single daily Codex Automation:

```text
This is an unattended standalone daily run. Do not depend on any prior session context or ask the owner for routine editorial choices; read the persisted profile and exact context. From the project root, read personal-newspaper/skills/personal-newspaper/SKILL.md completely and execute its Publish now workflow for today's confirmed local date. Use personal-newspaper as the working directory after reading the skill. Load PAPER_URL and AUTOMATION_TOKEN from .env.local without printing or persisting the token. Read every reference required by the workflow, use the bundled pnpm commands for context capture, preparation, validation, publication, and recovery, and complete source, image, security, desktop, exactly-560px, phone, complete-sheet silhouette, left/right edge hover/focus and touch page-turn, reduced-motion, whole-article opening, drop-cap, live-reader, and post-publication context verification. Derive each page composition from today's story count, importance, copy measure, evidence imagery, and section relationships. Inspect the current live edition's silhouette first; do not copy its composition or the template CSS. When content permits, change at least two structural dimensions per corresponding page: lead position, dominant span, visual position, brief axis, or module count. Balance independent lanes so alignment cavities and neighboring lane-ending differences stay within four body lines when enough verified copy exists; merge a thin subject rather than padding it. If the same silhouette is editorially necessary, record the evidence-based reason in the private layout brief; variation must never be random decoration. The printed sheet must be dense and asymmetric, with no navbar, top tabs, giant hero, fixed blank field, vertical article stack, or read-more button; original-source actions appear only inside the opened detail. Do not modify the site, schema, skill, or automation; do not omit or hand-edit the reaction snapshot; do not weaken a gate, reuse an edition id, create a fallback, or claim success from the POST response alone. On stale context, regenerate from a new snapshot and new id. On failed live verification, atomically restore only the failed edition's direct predecessor while the failed edition is still current, then verify the restoration.
```

## Skill self-check

After editing this skill, run `pnpm skill:validate`, the official Agent Skills validator, the eval cases in `evals/evals.json`, and the application test suite before deployment.
