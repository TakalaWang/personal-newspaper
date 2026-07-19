# Base design

This is a print grammar, not a fixed template. Picture one reader scanning a full broadsheet at a desk in daylight: importance must be visible through scale, position, column width, imagery, and rules before the text is read.

## Identity

- Palette: newsprint `oklch(94.5% 0.012 82)`, ink `oklch(18% 0.012 52)`, muted ink `oklch(38% 0.014 52)`, rule `oklch(48% 0.012 52)`, deep press red `oklch(38% 0.13 27)`. Red is the sole spot color and stays below 10% of the sheet.
- No gradients, tinted cards, blue accents, brass, glass, or decorative shadows inside the sheet.
- Songti/STSong/PMingLiU-style serif carries headlines and copy. Kaiti/STKaiti is limited to the masthead or one editorial accent. PingFang-style sans carries folios, captions, bylines, labels, and controls.
- Masthead maximum `82px`, lead headline `64px`, other headlines `36px`; letter spacing never tighter than `-0.035em`.

## Composition

- Build every desktop page on a 6–12 column modular grid with shared horizontal and vertical alignments. Use hairlines, not boxes. Body copy is `15–18px` with `1.55–1.75` line height in readable narrow columns.
- Front page: a central lead or off-centre lead with narrow side reports, plus a horizontal skyline, brief row, verified visual, quote, or data strip. Aim for 4–7 verified story packages; reduce page count before shipping a sparse page.
- Section page: choose an L-shaped lead with a two-row side column, image-led grid with briefs beneath, 9/3 feature with an internal 8/4 split, or dense brief grid anchored by one dominant package. A 9/3 feature is not a wide hero plus sidebar: the lead needs an internal cross-column visual, quote, or module, and the narrow zone needs two packages; otherwise combine sections.
- Editorial coherence outranks density. Combine adjacent low-count sections as a labelled multi-section page or briefs on the front; never add filler merely to reach a count.
- Do not repeat the same composition on adjacent pages. Change at least two of: lead position, dominant span, visual position, brief axis, or module count.
- At exactly 560px and above, tablets keep mixed paths and at least two distinct article roots share a row. Text columns alone do not count. Only screens narrower than 560px may become one reading column; recompose modules instead of shrinking desktop type.

## News packages

- Each article is one coherent package: section label, headline, substantive dek, essential facts, optional verified visual and caption, byline/source note, then reader-injected controls.
- Put `data-story-id` on the article root. If it is a grid, make `reader-controls` span all columns. Never reproduce `閱讀全文`, `喜歡`, `不喜歡`, or `追蹤主題` in bundle HTML.
- Images require verified HTTPS provenance, useful alt text, caption, and credit. Never use decorative stock imagery to fill space.
- Avoid identical tag–headline–paragraph cards and repeated tiny uppercase tracked eyebrows. Same-sized modules with four-sided borders and equal padding are cards even when their border is a `1px` hairline.

## Refusals

No card grid, dashboard rail, detached feedback/source sidebar, giant landing-page hero, full-page vertical stack, rounded rectangles, decorative motion, or one story per page except a genuine long-form insert.

## Preflight

Run a silhouette check at desktop and tablet widths: blurred or squinted, the lead, secondary packages, visual, and multiple reading paths must remain distinct. Adjacent pages must have visibly different silhouettes. At phone width, confirm no headline or control overflows. WCAG 2.2 AA, semantic structure, keyboard access, visible focus, useful alt text, and non-color cues are mandatory.
