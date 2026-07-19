# Edition contract

Use `assets/edition-template.json` as a structural example, not as current news. The application validator is authoritative. Drafts omit `generation`; `edition:prepare` injects it from the private context snapshot.

## Bundle

- `id`: unique immutable id; never reuse a rejected, failed, restored, or published id.
- `date`: confirmed owner-local `YYYY-MM-DD` date.
- `language`: BCP 47 tag.
- `masthead`: confirmed profile masthead.
- `pages`: nonempty subject pages.
- `stories`: canonical editorial source.
- `sources`: nonempty evidence ledger.
- `generation`: deterministic snapshot fields added only by `edition:prepare`.

## Generation binding

`generation.basedOnEditionId`, `generation.contextVersion`, `generation.contextRevision`, and `generation.reactions` must exactly match the snapshot used for editorial decisions. `contextRevision` is a nonnegative database revision guarded inside the publication transaction. A late profile or reaction change makes the insert fail instead of silently consuming feedback that did not shape the edition.

## Page contract

Each page contains:

- a unique id and useful subject label;
- safe page-scoped CSS with no import, URL, generated prose, executable expression, or remote fetch;
- structural HTML only, with no visible prose or assets;
- exactly one empty `article[data-story-id]` root for every story assigned to it.

The stable trusted reader injects masthead, folio, canonical summaries, article opening, and feedback. Page HTML never recreates them.

## Story contract

Every story has `kicker`, `headline`, a substantive `dek`, `summaryHtml`, `bodyHtml`, `label`, nonempty `sourceIds`, `editorial`, `claims`, and `images`.

- `summaryHtml` explains the news on the outer paper. Every summary paragraph has a unique `data-claim-id`.
- `bodyHtml` expands the same thesis and facts. For each printed claim, one detailed paragraph uses the same `data-claim-id`, contains the exact printed claim, then may elaborate.
- `claims` bind the exact `summaryClaim` and `bodySupport` strings to one or more source ids.
- `label` is `fact` or `inference`; it does not excuse unsupported claims.
- `editorial.topics` is descriptive. `editorial.preferenceTags` uses only the closed non-sensitive taxonomy. Format, depth, style, and importance are required so feedback has interpretable context.
- Summary and body HTML contain no links. Original source links are created only by the trusted detailed reader from `sourceIds`.

The outside and inside are not two articles: the outside is a compact edition of the same report; the inside adds clarity, evidence, and context.

## Source contract

Every source has a unique id, HTTPS URL, title, publisher, publication date or null, event date or null, and retrieval date. Claims may reference only sources already attached to the story. Open the exact source during verification; metadata alone is not evidence.

## Image contract

Every rendered image has exactly one manifest entry containing `src`, source id, creator, publication date, useful alt, caption, credit, and usage basis. The URL must be HTTPS, declared, and verified to return a raster image. Decorative filler, tracking surfaces, SVG responses, inline SVG, `srcset`, picture/video/audio elements, and CSS-fetched images are rejected.

## Security boundary

Bundle markup is untrusted. It cannot include scripts, stylesheets, event attributes, forms, frames, embeds, metadata, remote links, or undeclared fetches. Do not loosen this boundary to accommodate a layout; recompose the layout with accepted structural HTML and CSS.
