# Adaptive A4 Newspaper Implementation Plan

**Goal:** Make both the Skill and the live demonstration produce dense portrait newspaper sheets whose editorial geometry cannot collapse into one persistent two-column split.

**Architecture:** Keep the trusted reader, canonical story injection, evidence contract, and immutable publication flow unchanged. Strengthen the layout brief with measurable topology and portrait-density gates, update the data-contract fixture to demonstrate a stepped 12-column mosaic, narrow the trusted sheet to a portrait reading measure, and repair the existing automation prompt in place.

**Stack:** TypeScript, React, CSS Grid, pnpm, Node test runner, Codex Automations, OpenAI Sites.

---

## 1. Encode the failure before changing the design

- Update `tests/skill-design.test.mjs` so the fixture and references must reject a page-wide persistent two-column seam.
- Require a private 12-column page map, stepped seams, three occupied spans on pages with four or more packages, and an A-series portrait visual check without fixed-height filler.
- Add an eval where a four-story front page must be recomposed after failing the geometry gate.

## 2. Strengthen the reusable Skill

- Replace named layout archetypes in `references/base-design.md` with content-derived topology constraints.
- Add a page-map and geometry gate to `references/pipeline.md` before any HTML/CSS is written.
- Mirror the same non-negotiable checks in the canonical daily automation prompt in `SKILL.md`.
- Keep responsive behavior: mixed paths at exactly 560px; a single path only below 560px.

## 3. Redesign the demonstration newspaper

- Recompose the front page on a 12-column stepped mosaic with four distinct spans and no continuous vertical split.
- Recompose the technology page as a full-width compound lead followed by an unequal lower band.
- Preserve the methods page as a contrasting editorial page with an internal floating module.
- Change the trusted desktop sheet from broad 80rem presentation to a 64rem portrait measure; update full-height page-turn gutters consistently.

## 4. Verify and publish

- Run the targeted failure test, Skill validator, official validator, full pnpm tests, lint, and typecheck.
- Inspect desktop, exactly 560px, and phone layouts in a real browser, including opening articles and page turning.
- Deploy the reader through the configured Sites project.
- Bind the redesigned edition to a fresh private context snapshot, publish it as a new immutable revision, and verify live context and interaction.
- Update the existing `Personal Newspaper daily edition` automation by id, changing only its prompt, and verify exactly one active automation remains.
