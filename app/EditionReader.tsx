"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { escapeHtml, renderStorySummary, type EditionBundle, type EditionPage, type EditionStory } from "@/lib/edition";
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

export function EditionReader({ bundle, owner = false }: EditionReaderProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const pageFrameRef = useRef<HTMLIFrameElement>(null);
  const articleFrameRef = useRef<HTMLIFrameElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const page = bundle.pages[pageIndex];
  const activeStory = bundle.stories.find((story) => story.id === activeStoryId) ?? null;

  useEffect(() => {
    if (!owner) return;
    void loadShares().then(setShares).catch(() => undefined);
  }, [owner]);

  useEffect(() => {
    if (!activeStory) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveStoryId(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [activeStory]);

  const react = useCallback(async (action: ReactionAction, storyId: string) => {
    setPending(`${action}:${storyId}`);
    try {
      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, storyId, editionId: bundle.id }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      setMessage(result.message ?? result.error ?? "Unable to save this response.");
    } catch {
      setMessage("Unable to save this response.");
    } finally {
      setPending(null);
    }
  }, [bundle.id]);

  useEffect(() => {
    const storyIds = new Set(bundle.stories.map((story) => story.id));
    const receiveReaderMessage = (event: MessageEvent) => {
      const pageWindow = pageFrameRef.current?.contentWindow;
      const articleWindow = articleFrameRef.current?.contentWindow;
      if (event.source !== pageWindow && event.source !== articleWindow) return;

      try {
        const readerMessage = parseReaderMessage(event.data, storyIds);
        const story = bundle.stories.find((candidate) => candidate.id === readerMessage.storyId);
        if (!story) return;
        if (event.source === pageWindow && story.pageId !== page.id) return;
        if (event.source === articleWindow && story.id !== activeStoryId) return;
        if (readerMessage.type === "open") {
          setActiveStoryId(readerMessage.storyId);
        } else if (owner) {
          void react(readerMessage.action, readerMessage.storyId);
        }
      } catch {
        // Sandboxed edition messages are untrusted and ignored unless fully valid.
      }
    };
    window.addEventListener("message", receiveReaderMessage);
    return () => window.removeEventListener("message", receiveReaderMessage);
  }, [activeStoryId, bundle.stories, owner, page.id, react]);

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
        setMessage(result.error ?? "Unable to create a share link.");
        return;
      }
      setShareUrl(result.url);
      setShares(await loadShares());
      try {
        await navigator.clipboard?.writeText(result.url);
        setMessage("Share link copied. It shows this edition only.");
      } catch {
        setMessage("Share link is ready below. It shows this edition only.");
      }
    } catch {
      setMessage("Unable to create a share link.");
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
      if (response.ok) setShares(await loadShares());
      setMessage(result.message ?? result.error ?? "Unable to revoke the share link.");
    } catch {
      setMessage("Unable to revoke the share link.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="edition-reader" aria-label={`${bundle.masthead}, ${bundle.date}`}>
      {owner ? (
        <header className="owner-toolbar">
          <div>
            <p className="toolbar-name">{bundle.masthead}</p>
            <p className="toolbar-date">{formatDate(bundle.date, bundle.language)}</p>
          </div>
          <div className="toolbar-actions">
            <button className="quiet-button" type="button" onClick={share} disabled={pending === "share"}>
              {pending === "share" ? "Preparing…" : "Share edition"}
            </button>
            {shareUrl ? <a className="quiet-button share-link" href={shareUrl} rel="noreferrer" target="_blank">Open link</a> : null}
          </div>
          <ShareList shares={shares} editionId={bundle.id} pending={pending} onRevoke={revokeShare} />
        </header>
      ) : null}

      <nav className="edition-pages" aria-label="Edition pages">
        {bundle.pages.map((candidate, index) => (
          <button
            aria-current={index === pageIndex ? "page" : undefined}
            className={index === pageIndex ? "page-tab is-current" : "page-tab"}
            key={candidate.id}
            onClick={() => {
              setPageIndex(index);
              setActiveStoryId(null);
            }}
            type="button"
          >
            <span>{candidate.section}</span>
            <small>{index + 1}</small>
          </button>
        ))}
      </nav>

      <div className="edition-spread">
        <iframe
          className="edition-frame"
          key={page.id}
          ref={pageFrameRef}
          sandbox="allow-scripts"
          srcDoc={pageDocument(page, bundle, owner)}
          title={`${bundle.masthead}: ${page.section}`}
        />
        <p aria-live="polite" className="reader-message">{message}</p>
      </div>

      {activeStory ? (
        <StoryDialog
          bundle={bundle}
          closeButtonRef={closeButtonRef}
          frameRef={articleFrameRef}
          owner={owner}
          story={activeStory}
          onClose={() => setActiveStoryId(null)}
        />
      ) : null}
    </section>
  );
}

function StoryDialog({
  bundle,
  closeButtonRef,
  frameRef,
  owner,
  story,
  onClose,
}: {
  bundle: EditionBundle;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  frameRef: React.RefObject<HTMLIFrameElement | null>;
  owner: boolean;
  story: EditionStory;
  onClose: () => void;
}) {
  const sources = story.sourceIds
    .map((sourceId) => bundle.sources.find((source) => source.id === sourceId))
    .filter((source): source is EditionBundle["sources"][number] => Boolean(source));

  return (
    <div className="story-dialog" role="dialog" aria-modal="true" aria-labelledby="story-dialog-title" onClick={onClose}>
      <div className="story-dialog-shell" onClick={(event) => event.stopPropagation()}>
        <header className="story-dialog-header">
          <div>
            <p>{story.label === "fact" ? "報導" : "分析"}</p>
            <h2 id="story-dialog-title">{story.headline}</h2>
          </div>
          <button ref={closeButtonRef} className="story-dialog-close" type="button" onClick={onClose} aria-label="關閉文章">
            關閉 ×
          </button>
        </header>
        <iframe
          className="story-dialog-frame"
          ref={frameRef}
          sandbox="allow-scripts"
          srcDoc={articleDocument(story, bundle, owner)}
          title={story.headline}
        />
        <footer className="story-dialog-sources">
          <span>核對來源</span>
          {sources.map((source, index) => (
            <a href={source.url} key={source.id} rel="noreferrer" target="_blank">來源 {index + 1} ↗</a>
          ))}
        </footer>
      </div>
    </div>
  );
}

function ShareList({
  shares,
  editionId,
  pending,
  onRevoke,
}: {
  shares: Share[];
  editionId: string;
  pending: string | null;
  onRevoke: (shareId: number) => Promise<void>;
}) {
  const editionShares = shares.filter((share) => share.editionId === editionId);
  if (editionShares.length === 0) return null;

  return (
    <ul className="share-list" aria-label="Share links for this edition">
      {editionShares.map((share) => (
        <li key={share.id}>
          <span>{share.revokedAt ? "Revoked" : "Active"}</span>
          {share.revokedAt ? null : (
            <button className="quiet-button" disabled={pending === `revoke:${share.id}`} onClick={() => onRevoke(share.id)} type="button">
              {pending === `revoke:${share.id}` ? "Revoking…" : "Revoke"}
            </button>
          )}
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

function pageDocument(page: EditionPage, bundle: EditionBundle, owner: boolean): string {
  return `<!doctype html><html lang="${escapeAttribute(bundle.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    :root { --paper: oklch(94.5% 0.012 82); --ink: oklch(18% 0.012 52); --red: oklch(38% 0.13 27); color: var(--ink); background: var(--paper); font-family: "Songti TC", "STSong", "PMingLiU", Georgia, serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; padding: clamp(1.25rem, 3vw, 3.5rem); overflow-wrap: anywhere; }
    img, svg, video { max-width: 100%; height: auto; }
    a { color: inherit; }
    ${trustedPageHeaderCss()}
    ${page.css ?? ""}
    ${readerBridgeCss()}
  </style></head><body><main class="paper">${trustedPageHeader(page, bundle)}${page.html}</main>${trustedReaderBridge(owner, bundle.stories)}</body></html>`;
}

function articleDocument(story: EditionStory, bundle: EditionBundle, owner: boolean): string {
  return `<!doctype html><html lang="${escapeAttribute(bundle.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    :root { --paper: oklch(94.5% 0.012 82); --ink: oklch(18% 0.012 52); --red: oklch(38% 0.13 27); color: var(--ink); background: var(--paper); font-family: "Songti TC", "STSong", "PMingLiU", Georgia, serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: clamp(20px, 4vw, 52px); }
    .full-story { max-width: 820px; margin: 0 auto; cursor: default; }
    .full-story .section { margin: 0 0 16px; border-top: 4px solid var(--red); border-bottom: 1px solid var(--ink); padding: 7px 0; color: var(--red); font: 800 11px/1.2 "PingFang TC", sans-serif; letter-spacing: .08em; }
    .full-story h1 { max-width: 19ch; margin: 0; font-size: clamp(36px, 7vw, 68px); letter-spacing: -.035em; line-height: 1; text-wrap: balance; }
    .full-story .dek { max-width: 56ch; margin: 16px 0; color: oklch(38% 0.014 52); font-size: clamp(18px, 2.4vw, 23px); font-weight: 700; line-height: 1.45; }
    .full-story .byline { border-top: 1px solid var(--ink); padding: 8px 0 18px; font: 800 10px/1.3 "PingFang TC", sans-serif; letter-spacing: .04em; }
    .full-story .body { columns: 2; column-gap: 32px; column-rule: 1px solid oklch(48% 0.012 52); font-size: clamp(17px, 1.8vw, 20px); line-height: 1.75; text-align: justify; }
    .full-story .body p { margin: 0 0 1.35em; }
    .full-story .body p:first-child::first-letter { float: left; margin: .08em .1em 0 0; font-size: 4.2em; font-weight: 900; line-height: .72; }
    .full-story .body h2 { break-after: avoid; margin: 1.6em 0 .5em; color: var(--red); font-size: 1.35em; line-height: 1.1; }
    .full-story .body blockquote { column-span: all; margin: 1.6em 0; border-top: 3px solid var(--red); border-bottom: 3px double var(--ink); padding: .8em 0; font-size: 1.3em; font-weight: 700; line-height: 1.28; }
    @media (max-width: 620px) { .full-story .body { columns: 1; } }
    ${readerBridgeCss()}
  </style></head><body><article class="full-story" data-story-id="${escapeAttribute(story.id)}"><p class="section">${story.label === "fact" ? "報導" : "分析"}・${escapeHtml(bundle.masthead)}</p><h1>${escapeHtml(story.headline)}</h1><p class="dek">${escapeHtml(story.dek)}</p><p class="byline">光譜日報編輯台・${escapeHtml(formatDate(bundle.date, bundle.language))}</p><div class="body">${story.bodyHtml}</div></article>${trustedReaderBridge(owner, [story])}</body></html>`;
}

function readerBridgeCss(): string {
  return `.reader-story { cursor: pointer; position: relative; transition: background-color 120ms ease; }
    .reader-story:hover { background-color: oklch(91% 0.017 82); }
    .reader-story:focus-visible { outline: 3px solid oklch(38% 0.13 27); outline-offset: -3px; }
    reader-controls { display: block !important; clear: both !important; margin-top: 14px !important; }`;
}

function trustedPageHeader(page: EditionPage, bundle: EditionBundle): string {
  const pageNumber = bundle.pages.findIndex((candidate) => candidate.id === page.id) + 1;
  const storyCount = bundle.stories.filter((story) => story.pageId === page.id).length;
  const title = pageNumber === 1 ? bundle.masthead : page.section;
  return `<header class="publication-header${pageNumber === 1 ? " is-front" : ""}"><div class="publication-folio"><span>${escapeHtml(bundle.masthead)}・${escapeHtml(page.section)}</span><span>第 ${pageNumber} 版・${escapeHtml(formatDate(bundle.date, bundle.language))}</span></div><h1>${escapeHtml(title)}</h1><p><span>${escapeHtml(page.section)}</span><span>${storyCount} 篇・每篇可展開全文</span></p></header>`;
}

function trustedPageHeaderCss(): string {
  return `.publication-header{border-top:4px solid var(--red);border-bottom:3px double var(--ink)}
    .publication-folio,.publication-header>p{display:flex;justify-content:space-between;gap:16px;padding:6px 0;font:800 10px/1.35 "PingFang TC",sans-serif}
    .publication-folio{border-bottom:1px solid var(--ink)}
    .publication-header h1{margin:8px 0 6px;color:var(--red);font-family:"Kaiti TC","STKaiti","Songti TC",serif;font-size:clamp(46px,6vw,76px);font-weight:900;letter-spacing:-.035em;line-height:.92}
    .publication-header>p{margin:0;border-top:3px solid var(--ink)}
    .publication-header.is-front h1{text-align:center;font-size:clamp(54px,7vw,84px)}
    @media(max-width:559px){.publication-folio,.publication-header>p{flex-wrap:wrap}.publication-header h1,.publication-header.is-front h1{font-size:50px}}`;
}

function trustedReaderBridge(owner: boolean, stories: EditionStory[]): string {
  const summaries = Object.fromEntries(stories.map((story) => [story.id, renderStorySummary(story)]));
  return `<script>(() => {
    const owner = ${owner ? "true" : "false"};
    const summaries = ${inlineScriptJson(summaries)};
    const send = (message) => window.parent.postMessage(message, "*");
    const controlsMarkup = '<style>:host{all:initial;display:block;font-family:"PingFang TC",sans-serif;color:#211d19}.bar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;border-top:1px solid #211d19;border-bottom:1px solid #211d19;padding:6px 0}.open,.action{appearance:none;border:0;background:transparent;color:#211d19;cursor:pointer;font:800 11px/1.2 "PingFang TC",sans-serif;letter-spacing:.02em;padding:5px 2px}.open{text-decoration:underline;text-underline-offset:3px}.actions{display:flex;gap:13px}.action:hover,.open:hover{color:#7d1f25}.action:focus-visible,.open:focus-visible{outline:2px solid #7d1f25;outline-offset:2px}</style><div class="bar"><button class="open" type="button">閱讀全文 →</button>' + (owner ? '<div class="actions" aria-label="調整明日內容"><button class="action" data-action="love" type="button">♡ 喜歡</button><button class="action" data-action="less" type="button">⊘ 不喜歡</button></div>' : '') + '</div>';
    document.querySelectorAll('[data-story-id]').forEach((article) => {
      const storyId = article.getAttribute('data-story-id');
      if (!storyId || article.dataset.readerEnhanced) return;
      article.dataset.readerEnhanced = 'true';
      article.classList.add('reader-story');
      article.tabIndex = 0;
      if (article.childElementCount === 0) {
        const summary = summaries[storyId];
        if (!summary) throw new Error('Missing canonical story summary');
        article.insertAdjacentHTML('afterbegin', summary);
      }
      const headline = article.querySelector('h1,h2,h3')?.textContent?.trim();
      article.setAttribute('aria-label', headline ? '閱讀全文：' + headline : '閱讀全文');
      const host = document.createElement('reader-controls');
      host.style.setProperty('display', 'block', 'important');
      article.append(host);
      const root = host.attachShadow({ mode: 'closed' });
      root.innerHTML = controlsMarkup;
      root.querySelector('.open')?.addEventListener('click', (event) => {
        event.stopPropagation();
        send({ type: 'open', storyId });
      });
      root.querySelectorAll('[data-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          send({ type: 'react', storyId, action: button.getAttribute('data-action') });
        });
      });
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
    });
  })();</script>`;
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
