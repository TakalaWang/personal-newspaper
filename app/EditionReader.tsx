"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { escapeHtml, renderStoryDetail, renderStorySummary, type EditionBundle, type EditionPage, type EditionStory } from "@/lib/edition";
import { parseReaderMessage, type ReactionAction } from "@/lib/reader";

type EditionReaderProps = {
  bundle: EditionBundle;
  owner?: boolean;
};

type Share = {
  id: number;
  editionId: string;
  createdAt: string | null;
  revokedAt: string | null;
};

const THEMES = [
  { id: "classic", label: "經典新聞紙", description: "暖灰新聞紙、炭黑正文與暗紅套色" },
  { id: "salmon", label: "鮭色財經", description: "飽和鮭色紙、深酒紅正文與套色" },
  { id: "modern", label: "現代白報", description: "冷白紙、深藍正文與靛藍規則線" },
] as const;
const ENGLISH_THEMES = [
  { id: "classic", label: "Classic newsprint", description: "Warm grey paper, charcoal ink, dark red spot color" },
  { id: "salmon", label: "Salmon financial", description: "Saturated salmon paper with deep wine ink" },
  { id: "modern", label: "Modern white", description: "Cool white paper, navy ink, indigo rules" },
] as const;

type NewspaperTheme = (typeof THEMES)[number]["id"];
type ReaderCopy = {
  themes: ReadonlyArray<{ id: NewspaperTheme; label: string; description: string }>;
  previousPage: string;
  nextPage: string;
  feedbackSaved: string;
  feedbackFailed: string;
  shareFailed: string;
  shareCopied: string;
  shareFallback: string;
  shareRevoked: string;
  shareRevokeFailed: string;
  paperTheme: string;
  sharing: string;
  shareAction: string;
  openShare: string;
  themeTitle: string;
  themeDescription: string;
  completeReport: string;
  completeAnalysis: string;
  closeArticle: string;
  originalSources: string;
  activeShares: string;
  shareLink: string;
  revoking: string;
  revoke: string;
  report: string;
  analysis: string;
  desk: string;
  personalDaily: string;
  frontTagline: string;
  feedbackLabel: string;
  like: string;
  less: string;
  openReport: string;
  saving: string;
  loved: string;
  disliked: string;
  saved: string;
  saveFailed: string;
  pageCount(current: number, total: number): string;
};
type PageTurnDirection = "previous" | "next";
type ReactionResult = { ok: boolean; message: string };
const THEME_STORAGE_KEY = "codex-reporter-theme";

export function EditionReader({ bundle, owner = false }: EditionReaderProps) {
  const copy = readerCopy(bundle.language);
  const themeOptions = copy.themes;
  const [pageIndex, setPageIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [theme, setTheme] = useState<NewspaperTheme>("classic");
  const [pageTurn, setPageTurn] = useState<PageTurnDirection | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const pageFrameRef = useRef<HTMLIFrameElement>(null);
  const pendingPageHeightRef = useRef<number | null>(null);
  const articleFrameRef = useRef<HTMLIFrameElement>(null);
  const reactionSelectionsRef = useRef<Record<string, ReactionAction>>({});
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const themeDialogRef = useRef<HTMLDialogElement>(null);
  const page = bundle.pages[pageIndex];
  const activeStory = bundle.stories.find((story) => story.id === activeStoryId) ?? null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setFrameReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const turnPage = useCallback((direction: -1 | 1) => {
    const nextPageIndex = Math.min(Math.max(pageIndex + direction, 0), bundle.pages.length - 1);
    if (nextPageIndex === pageIndex) return;
    pendingPageHeightRef.current = null;
    setPageTurn(direction === -1 ? "previous" : "next");
    setPageIndex(nextPageIndex);
    setActiveStoryId(null);
  }, [bundle.pages.length, pageIndex]);

  const syncReactions = useCallback((target?: Window | null) => {
    if (!owner) return;
    const message = { type: "reaction-sync", selections: reactionSelectionsRef.current };
    if (target) target.postMessage(message, "*");
    else {
      pageFrameRef.current?.contentWindow?.postMessage(message, "*");
      articleFrameRef.current?.contentWindow?.postMessage(message, "*");
    }
  }, [owner]);

  useEffect(() => {
    if (!owner) return;
    void loadShares().then(setShares).catch(() => undefined);
  }, [owner]);

  useEffect(() => {
    if (!owner) return;
    let current = true;
    void loadReactions(bundle.id).then((selections) => {
      if (!current) return;
      reactionSelectionsRef.current = selections;
      syncReactions();
    }).catch(() => undefined);
    return () => { current = false; };
  }, [bundle.id, owner, syncReactions]);

  useEffect(() => {
    if (!owner) return;
    let savedTheme: NewspaperTheme | undefined;
    try {
      savedTheme = themeOptions.find(({ id }) => id === localStorage.getItem(THEME_STORAGE_KEY))?.id;
    } catch {}
    if (!savedTheme) {
      if (!themeDialogRef.current?.open) themeDialogRef.current?.showModal();
      return;
    }
    const frame = requestAnimationFrame(() => setTheme(savedTheme));
    return () => cancelAnimationFrame(frame);
  }, [owner, themeOptions]);

  useEffect(() => {
    if (!activeStory) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveStoryId(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [activeStory]);

  useEffect(() => {
    if (activeStory) return;
    const turnWithKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("a, button, input, textarea, select")) return;
      event.preventDefault();
      turnPage(event.key === "ArrowLeft" ? -1 : 1);
    };
    document.addEventListener("keydown", turnWithKeyboard);
    return () => document.removeEventListener("keydown", turnWithKeyboard);
  }, [activeStory, turnPage]);

  const react = useCallback(async (action: ReactionAction, storyId: string): Promise<ReactionResult> => {
    setPending(`${action}:${storyId}`);
    try {
      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, storyId, editionId: bundle.id }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      const responseMessage = response.ok ? copy.feedbackSaved : (result.error ?? copy.feedbackFailed);
      if (response.ok) reactionSelectionsRef.current = { ...reactionSelectionsRef.current, [storyId]: action };
      setMessage(responseMessage);
      return { ok: response.ok, message: responseMessage };
    } catch {
      const responseMessage = copy.feedbackFailed;
      setMessage(responseMessage);
      return { ok: false, message: responseMessage };
    } finally {
      setPending(null);
    }
  }, [bundle.id, copy]);

  useEffect(() => {
    const storyIds = new Set(bundle.stories.map((story) => story.id));
    const receiveReaderMessage = (event: MessageEvent) => {
      if (event.source !== pageFrameRef.current?.contentWindow && event.source !== articleFrameRef.current?.contentWindow) return;

      try {
        const readerMessage = parseReaderMessage(event.data, storyIds);
        if (readerMessage.type === "page-resize") {
          if (event.source === pageFrameRef.current?.contentWindow) {
            if (pageTurn) pendingPageHeightRef.current = readerMessage.height;
            else setPageHeight(readerMessage.height);
          }
          return;
        }
        const story = bundle.stories.find((candidate) => candidate.id === readerMessage.storyId);
        if (!story) return;
        if (event.source === pageFrameRef.current?.contentWindow && story.pageId !== page.id) return;
        if (event.source === articleFrameRef.current?.contentWindow && story.id !== activeStoryId) return;
        if (readerMessage.type === "open") {
          setActiveStoryId(readerMessage.storyId);
        } else if (owner) {
          const source = event.source as Window;
          void react(readerMessage.action, readerMessage.storyId).then((result) => {
            if (result.ok) syncReactions();
            source.postMessage({ type: "reaction-result", storyId: readerMessage.storyId, action: readerMessage.action, ...result }, "*");
          });
        }
      } catch {
        // Sandboxed edition messages are untrusted and ignored unless fully valid.
      }
    };
    window.addEventListener("message", receiveReaderMessage);
    pageFrameRef.current?.contentWindow?.postMessage({ type: "measure-page" }, "*");
    return () => window.removeEventListener("message", receiveReaderMessage);
  }, [activeStoryId, bundle.stories, owner, page.id, pageTurn, react, syncReactions]);

  async function share() {
    setPending("share");
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ editionId: bundle.id }),
      });
      const result = (await response.json()) as { token?: string; url?: string; error?: string };
      if (!response.ok || !result.token || !result.url) {
        setMessage(result.error ?? copy.shareFailed);
        return;
      }
      setShares(await loadShares());
      try {
        await navigator.clipboard?.writeText(result.url);
        setShareUrl(null);
        setMessage(copy.shareCopied);
      } catch {
        setShareUrl(result.url);
        setMessage(copy.shareFallback);
      }
    } catch {
      setMessage(copy.shareFailed);
    } finally {
      setPending(null);
    }
  }

  async function revokeShare(shareId: number) {
    setPending(`revoke:${shareId}`);
    try {
      const response = await fetch("/api/shares", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shareId }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (response.ok) {
        setShares(await loadShares());
        setShareUrl(null);
      }
      setMessage(response.ok ? copy.shareRevoked : (result.error ?? copy.shareRevokeFailed));
    } catch {
      setMessage(copy.shareRevokeFailed);
    } finally {
      setPending(null);
    }
  }

  function chooseTheme(value: string) {
    const selected = themeOptions.find(({ id }) => id === value)?.id;
    if (!selected) return;
    setTheme(selected);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, selected);
    } catch {}
    themeDialogRef.current?.close();
  }

  return (
    <section className="edition-reader" data-theme={theme} aria-label={`${bundle.masthead}, ${bundle.date}`}>
      <div className="edition-stage">
        <button
          aria-label={copy.previousPage}
          className="page-turn page-turn-previous"
          disabled={pageIndex === 0}
          onClick={() => turnPage(-1)}
          type="button"
        >
          <span className="page-turn-control" aria-hidden="true">‹</span>
        </button>
        <div
          className="edition-sheet"
          data-turn={pageTurn ?? undefined}
          key={page.id}
          onAnimationEnd={() => {
            setPageTurn(null);
            if (pendingPageHeightRef.current !== null) setPageHeight(pendingPageHeightRef.current);
            pendingPageHeightRef.current = null;
          }}
        >
          <iframe
            className="edition-frame"
            key={`${page.id}:${theme}:${frameReady ? "ready" : "server"}`}
            ref={pageFrameRef}
            sandbox="allow-scripts"
            onLoad={() => {
              const target = pageFrameRef.current?.contentWindow;
              target?.postMessage({ type: "measure-page" }, "*");
              syncReactions(target);
            }}
            srcDoc={pageDocument(page, bundle, owner, theme)}
            style={pageHeight === null ? undefined : { height: `${pageHeight}px` }}
            title={`${bundle.masthead}: ${page.section}`}
          />
        </div>
        <button
          aria-label={copy.nextPage}
          className="page-turn page-turn-next"
          disabled={pageIndex === bundle.pages.length - 1}
          onClick={() => turnPage(1)}
          type="button"
        >
          <span className="page-turn-control" aria-hidden="true">›</span>
        </button>
      </div>
      {owner ? (
        <footer className="reader-furniture">
          <div className="reader-utilities">
            <label className="theme-picker">
              <span>{copy.paperTheme}</span>
              <select value={theme} onChange={(event) => chooseTheme(event.target.value)}>
                {themeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <button className="share-action" type="button" onClick={share} disabled={pending === "share"}>
              {pending === "share" ? copy.sharing : copy.shareAction}
            </button>
            {shareUrl ? <a className="share-link" href={shareUrl} rel="noreferrer" target="_blank">{copy.openShare} ↗</a> : null}
          </div>
          <ShareList copy={copy} shares={shares} editionId={bundle.id} pending={pending} onRevoke={revokeShare} />
        </footer>
      ) : null}
      {message ? <p aria-live="polite" className="reader-message">{message}</p> : null}

      {activeStory ? (
        <StoryDialog
          bundle={bundle}
          copy={copy}
          closeButtonRef={closeButtonRef}
          frameRef={articleFrameRef}
          owner={owner}
          story={activeStory}
          theme={theme}
          onClose={() => setActiveStoryId(null)}
          onFrameLoad={() => syncReactions(articleFrameRef.current?.contentWindow)}
        />
      ) : null}
      {owner ? (
        <dialog className="theme-dialog" ref={themeDialogRef} aria-labelledby="theme-dialog-title">
          <form method="dialog">
            <p>{copy.paperTheme}</p>
            <h2 id="theme-dialog-title">{copy.themeTitle}</h2>
            <span>{copy.themeDescription}</span>
            <div className="theme-options">
              {themeOptions.map((option) => (
                <button data-theme-option={option.id} key={option.id} onClick={() => chooseTheme(option.id)} type="button">
                  <i aria-hidden="true" />
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
          </form>
        </dialog>
      ) : null}
    </section>
  );
}

function StoryDialog({
  bundle,
  copy,
  closeButtonRef,
  frameRef,
  owner,
  story,
  theme,
  onClose,
  onFrameLoad,
}: {
  bundle: EditionBundle;
  copy: ReaderCopy;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  frameRef: React.RefObject<HTMLIFrameElement | null>;
  owner: boolean;
  story: EditionStory;
  theme: NewspaperTheme;
  onClose: () => void;
  onFrameLoad: () => void;
}) {
  const sources = story.sourceIds
    .map((sourceId) => bundle.sources.find((source) => source.id === sourceId))
    .filter((source): source is EditionBundle["sources"][number] => Boolean(source));

  return (
    <div className="story-dialog" role="dialog" aria-modal="true" aria-label={story.headline} onClick={onClose}>
      <div className="story-dialog-shell" onClick={(event) => event.stopPropagation()}>
        <header className="story-dialog-header">
          <p>{story.kicker}・{story.label === "fact" ? copy.completeReport : copy.completeAnalysis}</p>
          <button ref={closeButtonRef} className="story-dialog-close" type="button" onClick={onClose} aria-label={copy.closeArticle}>
            ×
          </button>
        </header>
        <iframe
          className="story-dialog-frame"
          ref={frameRef}
          sandbox="allow-scripts"
          srcDoc={articleDocument(story, bundle, owner, theme)}
          title={story.headline}
          onLoad={onFrameLoad}
        />
        <footer className="story-dialog-sources">
          <span>{copy.originalSources}</span>
          {sources.map((source) => (
            <a href={source.url} key={source.id} rel="noreferrer" target="_blank">
              {source.publisher}：{source.title} ↗
            </a>
          ))}
        </footer>
      </div>
    </div>
  );
}

function ShareList({
  copy,
  shares,
  editionId,
  pending,
  onRevoke,
}: {
  copy: ReaderCopy;
  shares: Share[];
  editionId: string;
  pending: string | null;
  onRevoke: (shareId: number) => Promise<void>;
}) {
  const editionShares = shares.filter((share) => share.editionId === editionId && !share.revokedAt);
  if (editionShares.length === 0) return null;

  return (
    <ul className="share-list" aria-label={copy.activeShares}>
      {editionShares.map((share, index) => (
        <li key={share.id}>
          <span>{copy.shareLink} {index + 1}</span>
          <button className="share-revoke" disabled={pending === `revoke:${share.id}`} onClick={() => onRevoke(share.id)} type="button">
            {pending === `revoke:${share.id}` ? copy.revoking : copy.revoke}
          </button>
        </li>
      ))}
    </ul>
  );
}

async function loadShares(): Promise<Share[]> {
  const response = await fetch("/api/shares");
  if (!response.ok) throw new Error("Unable to load share links");
  const result = (await response.json()) as { shares?: Share[] };
  return result.shares ?? [];
}

async function loadReactions(editionId: string): Promise<Record<string, ReactionAction>> {
  const response = await fetch("/api/reactions");
  if (!response.ok) throw new Error("Unable to load reactions");
  const result = (await response.json()) as {
    editionId?: string;
    reactions?: Array<{ storyId?: string; action?: string }>;
  };
  if (result.editionId !== editionId) return {};
  return Object.fromEntries((result.reactions ?? []).flatMap(({ storyId, action }) =>
    storyId && (action === "love" || action === "less") ? [[storyId, action]] : [],
  ));
}

function pageDocument(page: EditionPage, bundle: EditionBundle, owner: boolean, theme: NewspaperTheme): string {
  return `<!doctype html><html lang="${escapeAttribute(bundle.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    :root { --paper: oklch(96% 0 0); --ink: oklch(16% 0 0); --muted: oklch(34% 0 0); --red: oklch(24% 0 0); --hair: oklch(49% 0 0); color: var(--ink); background: var(--paper); font-family: "Songti TC", "STSong", "PMingLiU", "Noto Serif TC", serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: clamp(1rem, 3vw, 3rem); overflow-wrap: break-word; word-break: normal; }
    img, svg, video { max-width: 100%; height: auto; }
    a { color: inherit; }
    ${trustedPageHeaderCss()}
    ${page.css ?? ""}
    ${themeCss(theme)}
    ${readerBridgeCss()}
  </style></head><body><main class="paper">${trustedPageHeader(page, bundle)}${page.html}</main>${trustedReaderBridge(owner, bundle.stories, true, bundle.language)}${trustedPageResizeBridge()}</body></html>`;
}

function articleDocument(story: EditionStory, bundle: EditionBundle, owner: boolean, theme: NewspaperTheme): string {
  const copy = readerCopy(bundle.language);
  return `<!doctype html><html lang="${escapeAttribute(bundle.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    :root { --paper: oklch(96% 0 0); --ink: oklch(16% 0 0); --muted: oklch(34% 0 0); --red: oklch(24% 0 0); --hair: oklch(49% 0 0); color: var(--ink); background: var(--paper); font-family: "Songti TC", "STSong", "PMingLiU", "Noto Serif TC", serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: clamp(1.25rem, 4vw, 3.5rem); overflow-wrap: break-word; }
    .full-story { max-width: 60rem; margin: 0 auto; cursor: default; }
    .article-head { display: grid; grid-template-columns: repeat(12,minmax(0,1fr)); gap: .75rem 1rem; border-top: 4px solid var(--ink); border-bottom: 3px double var(--ink); padding: .5rem 0 1rem; }
    .full-story .section { grid-column: 1/-1; margin: 0; border-bottom: 1px solid var(--hair); padding: 0 0 .4rem; color: var(--red); font: 700 .75rem/1.3 "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif; letter-spacing: .06em; }
    .article-title { grid-column: 1/9; }
    .full-story h1 { max-width: 18ch; margin: 0; font-size: clamp(2.25rem, 5vw, 3.75rem); letter-spacing: -.03em; line-height: .98; text-wrap: balance; }
    .article-standfirst { grid-column: 9/-1; align-self: end; border-top: 1px solid var(--ink); padding-top: .5rem; }
    .full-story .dek { margin: 0 0 .75rem; color: var(--muted); font-size: 1.05rem; font-weight: 700; line-height: 1.48; text-wrap: pretty; }
    .full-story .byline { margin: 0; font: 700 .75rem/1.4 "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif; letter-spacing: .04em; }
    .full-story .body { margin-top: 1.25rem; columns: 2; column-gap: 2rem; column-rule: 1px solid var(--hair); column-fill: balance; font-size: 1.0625rem; line-height: 1.68; text-align: justify; }
    .full-story .body p { margin: 0 0 1.35em; text-wrap: pretty; }
    .full-story .body p:first-of-type::first-letter { float: left; margin: .08em .22em .12em 0; font-size: 3.7em; font-weight: 700; line-height: .78; }
    .full-story .body h2 { column-span: all; break-after: avoid; margin: 1.5em 0 .6em; border-top: 1px solid var(--ink); padding-top: .45em; color: var(--red); font-size: 1.35em; line-height: 1.1; }
    .full-story .body blockquote { column-span: all; margin: 1.6em 0; border-top: 3px solid var(--red); border-bottom: 3px double var(--ink); padding: .8em 0; font-size: 1.3em; font-weight: 700; line-height: 1.28; text-align: left; }
    .full-story .body figure { column-span: all; break-inside: avoid; margin: 1.5rem 0; border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink); padding: .5rem 0; text-align: left; }
    .full-story .body figure img { display: block; width: 100%; max-height: 34rem; object-fit: contain; background: color-mix(in oklch,var(--paper) 94%,var(--ink)); }
    .full-story .body figcaption { margin-top: .45rem; color: var(--muted); font: 700 .75rem/1.45 "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif; }
    .full-story .body ul, .full-story .body ol { break-inside: avoid; margin: 0 0 1.35em; padding-inline-start: 1.25em; text-align: left; }
    .full-story .body table { display: block; column-span: all; width: 100%; overflow-x: auto; border-collapse: collapse; text-align: left; }
    .full-story .body th, .full-story .body td { border-bottom: 1px solid var(--hair); padding: .4rem .5rem; }
    @media (max-width: 46rem) { .article-title,.article-standfirst { grid-column: 1/-1; } .article-standfirst { margin-top: .25rem; } .full-story .body { columns: 1; text-align: left; } }
    ${themeCss(theme)}
    ${readerBridgeCss()}
  </style></head><body><article class="full-story" data-story-id="${escapeAttribute(story.id)}"><header class="article-head"><p class="section">${story.label === "fact" ? copy.report : copy.analysis}・${story.label === "fact" ? copy.completeReport : copy.completeAnalysis}</p><div class="article-title"><h1>${escapeHtml(story.headline)}</h1></div><div class="article-standfirst"><p class="dek">${escapeHtml(story.dek)}</p><p class="byline">${escapeHtml(bundle.masthead)} ${escapeHtml(copy.desk)}・${escapeHtml(formatDate(bundle.date, bundle.language))}</p></div></header><div class="body">${renderStoryDetail(story)}</div></article>${trustedReaderBridge(owner, [story], false, bundle.language)}</body></html>`;
}

function readerBridgeCss(): string {
  return `.reader-story { cursor: pointer; position: relative; transition: background-color 120ms ease; }
    .reader-story:hover { background-color: color-mix(in oklch, var(--paper) 91%, var(--red)); }
    .reader-story:focus-visible { outline: 3px solid var(--red); outline-offset: -3px; }
    .reader-story-footer { display: grid !important; clear: both !important; grid-template-columns: minmax(0, 1fr) auto !important; align-items: stretch !important; gap: 8px !important; min-height: 44px !important; margin-top: 8px !important; border-top: 1px solid var(--ink) !important; border-bottom: 1px solid var(--ink) !important; }
    .reader-story-note { display: flex !important; min-width: 0 !important; align-items: center !important; gap: 4px !important; color: var(--muted) !important; font: 700 .6875rem/1.35 "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif !important; }
    .reader-story-note > * { min-width: 0 !important; margin: 0 !important; overflow: hidden !important; border: 0 !important; padding: 4px 0 !important; color: inherit !important; font: inherit !important; letter-spacing: .02em !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
    reader-controls { display: block !important; min-width: max-content !important; margin: 0 !important; align-self: stretch !important; }
    .full-story > reader-controls { margin-top: 12px !important; border-top: 1px solid var(--ink) !important; border-bottom: 1px solid var(--ink) !important; }
    @media (prefers-reduced-motion: reduce) { .reader-story { transition-duration: .01ms; } }`;
}

function themeCss(theme: NewspaperTheme): string {
  const palette = {
    classic: "--paper:oklch(91.5% .014 82);--ink:oklch(19% .018 60);--muted:oklch(35% .026 60);--red:oklch(34% .11 25);--hair:oklch(49% .025 55)",
    salmon: "--paper:oklch(86.5% .075 38);--ink:oklch(20% .055 18);--muted:oklch(35% .055 18);--red:oklch(30% .11 12);--hair:oklch(47% .06 18)",
    modern: "--paper:oklch(98.5% .006 250);--ink:oklch(18% .05 255);--muted:oklch(35% .045 255);--red:oklch(32% .105 250);--hair:oklch(50% .055 250)",
  }[theme];
  return `:root{${palette};color:var(--ink);background:var(--paper)}`;
}

function trustedPageHeader(page: EditionPage, bundle: EditionBundle): string {
  const copy = readerCopy(bundle.language);
  const pageNumber = bundle.pages.findIndex((candidate) => candidate.id === page.id) + 1;
  const title = pageNumber === 1 ? bundle.masthead : page.section;
  return `<header class="publication-header${pageNumber === 1 ? " is-front" : ""}"><div class="publication-folio"><span>${escapeHtml(bundle.masthead)}・${escapeHtml(copy.personalDaily)}</span><span>${escapeHtml(formatDate(bundle.date, bundle.language))}・${escapeHtml(copy.pageCount(pageNumber, bundle.pages.length))}</span></div><div class="publication-name"><h1>${escapeHtml(title)}</h1><p>${pageNumber === 1 ? escapeHtml(copy.frontTagline) : escapeHtml(bundle.masthead)}</p></div></header>`;
}

function trustedPageHeaderCss(): string {
  return `.publication-header{border-top:4px solid var(--ink);border-bottom:3px double var(--ink)}
    .publication-folio{display:flex;justify-content:space-between;gap:16px;padding:4px 0;font:700 .75rem/1.3 "PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;letter-spacing:.04em}
    .publication-folio{border-bottom:1px solid var(--ink)}
    .publication-name{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:16px;padding:8px 0 4px}
    .publication-name h1{margin:0;color:var(--red);font-family:"Kaiti TC","STKaiti","BiauKai","DFKai-SB","Songti TC",serif;font-size:clamp(2.125rem,4.4vw,3.375rem);font-weight:700;letter-spacing:-.03em;line-height:.95}
    .publication-name p{margin:0 0 4px;font:700 .75rem/1.3 "PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif}
    .publication-header.is-front .publication-name h1{font-size:clamp(2.75rem,5.4vw,3.875rem)}
    @media(max-width:559px){.publication-folio{flex-wrap:wrap}.publication-name{grid-template-columns:1fr}.publication-name p{display:none}.publication-header.is-front .publication-name h1{font-size:3rem}}`;
}

function trustedReaderBridge(owner: boolean, stories: EditionStory[], openable: boolean, language: string): string {
  const copy = readerCopy(language);
  const summaries = Object.fromEntries(stories.map((story) => [story.id, renderStorySummary(story)]));
  const controlsMarkup = `<style>:host{all:initial;display:block;height:100%;font-family:"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;color:var(--ink)}.bar{display:flex;height:100%;align-items:center;justify-content:flex-end;gap:6px}.status{min-width:3.5em;color:var(--muted);font:700 .6875rem/1.3 "PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;text-align:right}.actions{display:flex;gap:2px}.action{min-height:44px;appearance:none;border:0;background:transparent;color:var(--ink);cursor:pointer;font:700 .75rem/1.3 "PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;padding:6px}.action:hover{color:var(--red)}.action[aria-pressed="true"]{background:var(--ink);color:var(--paper)}.action:disabled{cursor:wait;opacity:.58}.action:focus-visible{outline:2px solid var(--red);outline-offset:-2px}</style><div class="bar"><span class="status" data-status aria-live="polite"></span><div class="actions" aria-label="${escapeAttribute(copy.feedbackLabel)}"><button class="action" data-action="love" aria-pressed="false" type="button">♡ ${escapeHtml(copy.like)}</button><button class="action" data-action="less" aria-pressed="false" type="button">⊘ ${escapeHtml(copy.less)}</button></div></div>`;
  const labels = {
    openReport: copy.openReport,
    saving: copy.saving,
    loved: copy.loved,
    disliked: copy.disliked,
    saved: copy.saved,
    saveFailed: copy.saveFailed,
  };
  return `<script>(() => {
    const owner = ${owner ? "true" : "false"};
    const openable = ${openable ? "true" : "false"};
    const summaries = ${inlineScriptJson(summaries)};
    const labels = ${inlineScriptJson(labels)};
    const send = (message) => window.parent.postMessage(message, "*");
    const controls = new Map();
    const controlsMarkup = ${inlineScriptJson(controlsMarkup)};
    document.querySelectorAll('[data-story-id]').forEach((article) => {
      const storyId = article.getAttribute('data-story-id');
      if (!storyId || article.dataset.readerEnhanced) return;
      article.dataset.readerEnhanced = 'true';
      if (openable) {
        article.classList.add('reader-story');
        article.tabIndex = 0;
      }
      if (article.childElementCount === 0) {
        const summary = summaries[storyId];
        if (!summary) throw new Error('Missing canonical story summary');
        article.insertAdjacentHTML('afterbegin', summary);
      }
      if (openable) {
        const headline = article.querySelector('h1,h2,h3')?.textContent?.trim();
        article.setAttribute('aria-label', headline ? labels.openReport + ': ' + headline : labels.openReport);
      }
      if (owner) {
        const host = document.createElement('reader-controls');
        host.style.setProperty('display', 'block', 'important');
        if (openable) {
          const footer = document.createElement('footer');
          footer.className = 'reader-story-footer';
          const note = document.createElement('div');
          note.className = 'reader-story-note';
          article.querySelectorAll(':scope > .byline, :scope > .source, :scope > .tomorrow').forEach((item) => note.append(item));
          footer.append(note);
          footer.append(host);
          article.append(footer);
        } else {
          article.append(host);
        }
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = controlsMarkup;
        const buttons = [...root.querySelectorAll('[data-action]')];
        const status = root.querySelector('[data-status]');
        controls.set(storyId, { buttons, status });
        buttons.forEach((button) => {
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            if (button.disabled) return;
            buttons.forEach((item) => { item.disabled = true; });
            status.textContent = labels.saving;
            send({ type: 'react', storyId, action: button.getAttribute('data-action') });
          });
        });
      }
      if (openable) {
        article.addEventListener('click', (event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('a,button,reader-controls')) return;
          send({ type: 'open', storyId });
        });
        article.addEventListener('keydown', (event) => {
          if (event.target !== article || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          send({ type: 'open', storyId });
        });
      }
    });
    const showSelection = (storyId, action, statusText) => {
      const control = controls.get(storyId);
      if (!control || (action !== 'love' && action !== 'less')) return;
      control.buttons.forEach((button) => {
        button.disabled = false;
        button.setAttribute('aria-pressed', String(button.getAttribute('data-action') === action));
      });
      control.status.textContent = statusText;
    };
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent || !event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'reaction-sync' && event.data.selections && typeof event.data.selections === 'object') {
        Object.entries(event.data.selections).forEach(([storyId, action]) => showSelection(storyId, action, action === 'love' ? labels.loved : labels.disliked));
      }
      if (event.data.type === 'reaction-result') {
        if (event.data.ok) showSelection(event.data.storyId, event.data.action, labels.saved);
        else {
          const control = controls.get(event.data.storyId);
          if (!control) return;
          control.buttons.forEach((button) => { button.disabled = false; });
          control.status.textContent = labels.saveFailed;
        }
      }
    });
  })();</script>`;
}

function trustedPageResizeBridge(): string {
  return `<script>(() => {
    const publishHeight = () => window.parent.postMessage({ type: 'page-resize', height: Math.ceil(document.body.getBoundingClientRect().height) }, '*');
    window.addEventListener('message', (event) => {
      if (event.source === window.parent && event.data?.type === 'measure-page') publishHeight();
    });
    new ResizeObserver(publishHeight).observe(document.body);
    requestAnimationFrame(publishHeight);
  })();</script>`;
}

function readerCopy(language: string): ReaderCopy {
  if (language.toLowerCase().startsWith("en")) {
    return {
      themes: ENGLISH_THEMES,
      previousPage: "Previous page",
      nextPage: "Next page",
      feedbackSaved: "Saved. The next edition will reflect this signal.",
      feedbackFailed: "Unable to save this response. Please try again.",
      shareFailed: "Unable to share this edition.",
      shareCopied: "Edition link copied. It opens only this issue.",
      shareFallback: "Copying is unavailable. Open the share page below.",
      shareRevoked: "Edition link revoked.",
      shareRevokeFailed: "Unable to revoke the edition link.",
      paperTheme: "Paper theme",
      sharing: "Sharing…",
      shareAction: "Share",
      openShare: "Open share page",
      themeTitle: "Choose the paper you want to open every day",
      themeDescription: "Paper, body ink, and spot color change together. Each edition still composes its own layout.",
      completeReport: "Full report",
      completeAnalysis: "Full analysis",
      closeArticle: "Close article",
      originalSources: "Original sources",
      activeShares: "Active edition links",
      shareLink: "Edition link",
      revoking: "Revoking…",
      revoke: "Revoke",
      report: "Report",
      analysis: "Analysis",
      desk: "desk",
      personalDaily: "personal daily",
      frontTagline: "Only what is worth reading today",
      feedbackLabel: "Shape tomorrow's edition",
      like: "Like",
      less: "Less like this",
      openReport: "Open full report",
      saving: "Saving…",
      loved: "Liked",
      disliked: "Less like this",
      saved: "Saved",
      saveFailed: "Save failed",
      pageCount: (current, total) => `Page ${current} of ${total}`,
    };
  }

  return {
    themes: THEMES,
    previousPage: "上一頁",
    nextPage: "下一頁",
    feedbackSaved: "已儲存，下一期會依這項回饋調整。",
    feedbackFailed: "無法儲存這項回饋，請再試一次。",
    shareFailed: "無法分享本期報紙。",
    shareCopied: "分享連結已複製；只會開啟本期報紙。",
    shareFallback: "無法自動複製；請從下方開啟分享頁。",
    shareRevoked: "分享連結已停止使用。",
    shareRevokeFailed: "無法停止分享連結。",
    paperTheme: "報紙主題",
    sharing: "分享中…",
    shareAction: "分享",
    openShare: "開啟分享頁",
    themeTitle: "先選一份你想每天打開的報紙",
    themeDescription: "紙色、正文油墨與套色會一起改變；版面仍由每天的內容決定。之後可在版尾更換。",
    completeReport: "完整報導",
    completeAnalysis: "完整分析",
    closeArticle: "關閉文章",
    originalSources: "原始資料",
    activeShares: "本期有效分享連結",
    shareLink: "分享連結",
    revoking: "停止中…",
    revoke: "停止分享",
    report: "報導",
    analysis: "分析",
    desk: "編輯台",
    personalDaily: "個人早報",
    frontTagline: "每日只留下值得讀的事",
    feedbackLabel: "調整明日內容",
    like: "喜歡",
    less: "不喜歡",
    openReport: "開啟完整報導",
    saving: "儲存中…",
    loved: "已喜歡",
    disliked: "已不喜歡",
    saved: "已儲存",
    saveFailed: "儲存失敗",
    pageCount: (current, total) => `第 ${current}／${total} 頁`,
  };
}

function formatDate(date: string, language: string): string {
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function inlineScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
