# Newspaper base design

This is a print grammar, not a fixed template. Picture one reader scanning one complete broadsheet at a desk in daylight: importance must be visible through scale, position, column width, imagery, and rules before the text is read. The result must first read as a newspaper sheet, never as a news website wearing serif type.

## Identity

- The trusted reader owns the selected press palette. It offers warm grey newsprint with charcoal body ink and dark red spot ink, saturated salmon financial paper with wine body and spot ink, and cool white paper with navy body and indigo spot ink. Paper, body ink, rules, and spot ink must all change together so no two themes read as near-identical white variants. All three keep body contrast above WCAG AA and spot color below 10% of the sheet.
- Generated layout rules consume the semantic variables `--paper`, `--ink`, `--muted`, `--hair`, and `--red`. The trusted reader applies their final values after edition CSS, so bundle fallback declarations are never authoritative. `--red` is the historical spot-ink variable and may resolve to black, wine, or green.
- No gradients, tinted cards, extra accent hues, brass, glass, or decorative shadows inside the sheet.
- Songti/STSong/PMingLiU-style serif carries headlines and copy. Kaiti/STKaiti is limited to the masthead or one editorial accent. PingFang-style sans carries folios, captions, bylines, labels, and controls.
- Masthead maximum `62px`, lead headline `48px`, other headlines `32px`; letter spacing never tighter than `-0.035em`. A headline may grow only when its news value and occupied measure justify it; it must not manufacture importance by surrounding itself with empty paper.

## Stable reader shell

- Present exactly one complete sheet at a time. The newspaper is the dominant surface; it is not placed beneath a website navbar, section tabs, duplicated masthead, dashboard header, or app card.
- Move between subject pages with full-height left and right edge targets labelled `上一頁` and `下一頁` plus `ArrowLeft`/`ArrowRight`. Each pointer target is at least 64px wide on desktop and grows through the outer gutter on wide screens; it must remain large enough when the sheet nearly fills the viewport. Reveal an unboxed desktop page-turn chevron on hover or focus; never place the glyph in a bordered button, card, or floating panel. Keep a visible compact unboxed affordance for touch. Never move page controls below the paper. A compact folio below the sheet may identify section, date, and page count. Never place a tab bar above the masthead.
- Keep the trusted masthead concise. Never add a redundant section and story-count strap when the folio or page title already communicates that information.
- Use one restrained 200–300ms paper-turn transition to explain direction. Animate only transform and opacity, and disable the transition under `prefers-reduced-motion`.
- Size the sheet to its content so the complete page belongs to the outer document. Do not leave a fixed empty viewport under short pages or create a nested scrolling newspaper under long pages.
- The trusted reader, not generated page HTML, owns page turning, sharing, dialog behavior, article opening, feedback, and source links.

## Adaptive composition

- The fixed part is the reader contract, never a page silhouette. Page count, section grouping, lead position, dominant span, image position, brief direction, headline measure, and module count are decisions made anew from the day's evidence and editorial relationships.
- Before composing, inventory story importance, copy measure, evidence imagery, comparisons, and chronology, then inspect the corresponding current live page. When content permits, change at least two structural dimensions from that page. Repeating a silhouette requires an evidence-based reason in the private layout brief.
- `assets/edition-template.json` is a data-contract sample and local smoke-test fixture only. Never reuse its page CSS, wrapper structure, spans, or article order as a publication starting point.
- Do not maintain named front-page or section-page templates for the agent to rotate through. Variation must explain the news: it may expose a comparison, isolate a short urgent brief, align a chronology, or give verified imagery appropriate weight. Random rearrangement and cosmetic class renaming do not count.
- Page-specific CSS and structural wrappers should be regenerated for every publication. The safe empty-article contract still applies, so expressive composition never creates a new trust or fetch surface.

## Composition

- Build every desktop page on a 6–12 column modular grid with shared horizontal and vertical alignments. Use hairlines, not boxes. Body copy is at least `16px` with `1.45–1.6` line height in readable narrow columns. Use a 4pt spacing scale; structural gutters are `8px`, `12px`, or `16px`, while `24px+` belongs outside dense news packages.
- Front page: use an off-centre lead, stacked narrow reports, and a horizontal skyline, brief row, evidence-bearing visual, quote, or data strip. Aim for 4–7 verified story packages; reduce page count before shipping a sparse page. Do not use a centred landing-page headline, a single full-width hero, or a large blank field around one story.
- Section page: choose an L-shaped lead with a two-row side column, image-led grid with briefs beneath, 9/3 feature with an internal 8/4 split, or dense brief grid anchored by one dominant package. A 9/3 feature is not a wide hero plus utility sidebar: the lead needs an internal cross-column visual, quote, or module, while the narrow zone carries either one substantive counterpoint or two briefs.
- Editorial coherence outranks density. Combine adjacent low-count sections as a labelled multi-section page or briefs on the front; never add filler merely to reach a count.
- Do not repeat the same composition on adjacent pages or consecutive editions when the content permits a clearer alternative. Change at least two of: lead position, dominant span, visual position, brief axis, or module count; document an editorially necessary exception instead of manufacturing random difference.
- Dense does not mean uniform. Interrupt vertical reading with at least one side-by-side path and one cross-column or stacked module; vary headline measure and article depth instead of repeating equal rectangles.
- Avoid shared fixed grid rows when neighboring packages have materially different copy measures. Prefer independent vertical lanes, then balance story assignments so a following package fills the shorter lane instead of waiting below the taller one.
- Within a wide package, use two or three readable columns with `column-fill: balance`; let headings, verified figures, quotes, and feedback span columns when they need the full measure. Never squeeze body columns below a readable measure merely to eliminate whitespace.
- Estimate headline, dek, paragraph, and image measures in the private layout brief. Reject a composition when a cavity created by row alignment is larger than four lines of neighboring body copy; reassign the next package, change spans, or switch to independent lanes. When sufficient verified copy exists, balance neighboring lane endings to within four body lines.
- No unexplained blank block may be larger than a secondary story package. Empty paper must result from an intentional evidence-bearing image or print feature, not fixed height, oversized padding, or a short teaser.
- At exactly 560px and above, tablets keep mixed paths and at least two distinct article roots share a row. Text columns alone do not count. Only screens narrower than 560px may become one reading column; recompose modules instead of shrinking desktop type.

## Canonical news packages

- Page HTML owns composition only: use structural wrappers and empty `article` placements, with no visible text, CSS-generated text, or remote assets. Every placement carries `data-story-id`. The trusted reader supplies the folio/masthead and injects `kicker`, headline, dek, `summaryHtml`, article opening, and feedback from the canonical story.
- `summaryHtml` must make the news understandable before opening: state what happened or what the argument is, the decisive evidence, why it matters, and material uncertainty. It is a précis, not a teaser. Every summary paragraph has a unique `data-claim-id` and a complete matching claim entry.
- The detailed `bodyHtml` expands the same thesis and facts with mechanism, chronology, evidence, context, limits, and implications. It must not become a different story. For each summary claim, one detailed paragraph repeats the exact printed claim under the same `data-claim-id` before elaboration; `claims` bind both full texts to `sourceIds`.
- Original source links appear only in the detailed reader footer from `sourceIds`. Bundle page, summary, and body HTML contain no links. Page HTML contains no remote assets or duplicate canonical story text.
- Make the entire article root the opening affordance with keyboard equivalence and visible focus. Never render `閱讀全文`, `Read more`, chevrons, or button-like jump lines on the sheet. The printed summary must earn the click through substance, not a teaser CTA.
- Keep feedback within each article package. The reader injects only `喜歡` and `不喜歡` as a compact final rule inside the article; bundle HTML never recreates controls. Original-source actions exist only after the detailed article opens.
- Images must be explanatory or evidence-bearing, not decorative filler. Preserve the original color of every image: never apply grayscale, duotone, tint, blend, contrast, or opacity filters unless the verified source itself is monochrome and color carries no information. Every verified HTTPS image needs a manifest entry with source id, creator, publication date, useful alt text, caption, credit, and usage basis. Put it in `summaryHtml` when needed for scanning and in `bodyHtml` when the detailed explanation depends on it; repeating an essential figure is allowed.
- Avoid identical tag–headline–paragraph cards and repeated tiny uppercase tracked eyebrows. Same-sized modules with four-sided borders and equal padding are cards even when their border is a `1px` hairline.

## Refusals

No navbar, top tab strip, card grid, dashboard rail, detached feedback/source sidebar, giant landing-page hero, fixed-height blank sheet, full-page vertical stack, rounded rectangles, decorative motion, on-sheet read-more button, or one story per page except a genuine long-form insert.

## Preflight

- Content: compare every factual claim to the evidence ledger; verify dates, names, quantities, versions, label, and summary/body agreement. Remove claims that are merely plausible.
- Images: open every asset, confirm provenance and relevance, then read alt text, caption, and credit as a set. Confirm its rendered pixels preserve the verified original color and do not hide color-coded evidence. No broken, filtered, or unverified image ships.
- Silhouette: at desktop and exactly 560px, blur or squint; the lead, secondary packages, evidence-bearing visual, and multiple reading paths remain distinct. Adjacent pages have visibly different silhouettes. Compare against the current live edition and reject an unexplained near-copy. Inspect lane endings and row boundaries; reject any alignment-created cavity larger than four body lines, lane endings that differ by more than four body lines when enough verified copy exists, or any page whose largest feature is empty space.
- Interaction: confirm the sheet has full-height left/right hover and focus targets labelled 上一頁／下一頁, touch affordances, arrow-key page turning, directional paper-turn motion, and a reduced-motion alternative. Confirm there is no top navbar or on-sheet open button. At phone width confirm no headline or control overflows; open every story by clicking the article body and by keyboard; inspect drop-cap clearance; ensure original sources exist only in the detailed reader. WCAG 2.2 AA, semantic structure, keyboard access, visible focus, useful alt text, and non-color cues are mandatory.
