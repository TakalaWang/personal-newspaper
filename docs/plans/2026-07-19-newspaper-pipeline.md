# Newspaper Pipeline Correctness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce one coherent, source-backed article per story, show a useful précis on the printed page, reveal expanded detail and original-source links only after opening it, and learn latent topic preferences from love/dislike reactions only.

**Architecture:** Make `EditionStory` the single editorial source with canonical `kicker`, `headline`, `dek`, `summaryHtml`, and `bodyHtml`. Edition page HTML becomes layout-only empty article placeholders; the trusted reader injects canonical summary content and two reaction controls. Agent context enriches pending reactions with the reacted story's editorial metadata so the skill can infer non-sensitive latent topic weights.

**Tech Stack:** TypeScript, React, vinext, D1/Drizzle, R2, Node test runner, pnpm, Codex Automation.

---

### Task 1: Retire explicit topic tracking

**Files:**
- Modify: `lib/reader.ts`
- Modify: `app/EditionReader.tsx`
- Modify: `tests/reader-security.test.ts`

1. Add failing tests proving only `love` and `less` are accepted and `follow` is rejected.
2. Run `node --import ./tests/cloudflare-loader.mjs --test tests/reader-security.test.ts`; expect the follow rejection to fail.
3. Remove `follow` from `ReactionAction`, parsers, and injected controls.
4. Re-run the targeted test; expect pass.

### Task 2: Make story content canonical

**Files:**
- Modify: `lib/edition.ts`
- Modify: `app/EditionReader.tsx`
- Modify: `tests/edition.test.ts`

1. Add failing tests requiring `kicker` and substantive `summaryHtml`, rejecting non-empty printed article placeholders and links in summaries.
2. Run the edition test; expect failures because the current contract duplicates printed content.
3. Extend `EditionStory` with `kicker` and `summaryHtml`. Validate safe summary markup, minimum useful content, multi-paragraph detail, empty `<article data-story-id>` placeholders, and no summary links.
4. Pass canonical story markup safely into the trusted iframe bridge; inject kicker, headline, dek, and summary only into empty story roots before adding controls.
5. Re-run edition and reader tests; expect pass.

### Task 3: Supply usable latent-preference context

**Files:**
- Modify: `lib/reader.ts`
- Modify: `app/api/agent/context/route.ts`
- Modify: `tests/reader-security.test.ts`

1. Add a failing pure test that maps each pending love/dislike reaction to headline, dek, section, page, and label from the current bundle and rejects inconsistent story ids.
2. Run the targeted test; expect the helper to be missing.
3. Implement the minimal mapping helper and load the current edition bundle only when pending reactions exist.
4. Return enriched reactions; never return deprecated follow reactions or an uninterpretable raw story id.
5. Re-run targeted tests; expect pass.

### Task 4: Redesign the generation pipeline

**Files:**
- Modify: `skills/codex-reporter/SKILL.md`
- Modify: `skills/codex-reporter/references/base-design.md`
- Modify: `tests/skill-design.test.mjs`

1. Add failing contract assertions for two reactions, latent topic inference, evidence ledger, canonical summary/detail, detail-only source links, image rules, content audit, and visual preflight.
2. Run `node --test tests/skill-design.test.mjs`; expect fail.
3. Rewrite Publish now as: context → latent preference brief → source/evidence ledger → editorial budget → canonical story writing → page composition → content/visual/security preflight → publish → verify.
4. Update the exact daily automation prompt and pressure-test the skill with a separate agent.

### Task 5: Migrate and republish the current edition

**Files:**
- Modify: `skills/codex-reporter/assets/edition-template.json`
- Modify: `tests/edition.test.ts`

1. Move printed prose and visuals into each story's `summaryHtml`; add canonical `kicker`; leave each page article root empty.
2. Remove all explicit follow-topic copy and describe latent preference learning from love/dislike signals.
3. Put the verified sandbox visual in the detailed article where it materially explains the story.
4. Validate the bundle, run the full test suite and lint, and visually test desktop/tablet/phone plus article opening.

### Task 6: Deploy and verify

**Files:**
- Commit all files above after verification.

1. Update the existing `codex-reporter-daily-edition` automation without changing schedule, model, or notification policy.
2. Push the exact commit to the existing Sites source, save and deploy a new version, then publish the migrated edition with a unique id.
3. Verify production authentication, agent context enrichment, edition manifest, two-button UI, printed summary, detail article, source links, and zero browser errors.
