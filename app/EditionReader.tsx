"use client";

import { useEffect, useState } from "react";
import type { EditionBundle, EditionPage, EditionStory } from "@/lib/edition";
import type { ReactionAction } from "@/lib/reader";

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
  const page = bundle.pages[pageIndex];

  useEffect(() => {
    if (!owner) return;
    void loadShares().then(setShares).catch(() => undefined);
  }, [owner]);

  async function react(action: ReactionAction, storyId: string) {
    setPending(`${action}:${storyId}`);
    try {
      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, storyId }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      setMessage(result.message ?? result.error ?? "Unable to save this response.");
    } catch {
      setMessage("Unable to save this response.");
    } finally {
      setPending(null);
    }
  }

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
      if (response.ok) {
        setShares(await loadShares());
      }
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
            onClick={() => setPageIndex(index)}
            type="button"
          >
            {index + 1}
          </button>
        ))}
      </nav>

      <div className="edition-layout">
        <iframe
          className="edition-frame"
          key={page.id}
          sandbox=""
          srcDoc={pageDocument(page, bundle)}
          title={`${bundle.masthead}: page ${pageIndex + 1}`}
        />
        <aside className="reading-rail" aria-label="Story notes and sources">
          <p className="rail-heading">Reader’s margin</p>
          {bundle.stories.map((story) => (
            <StoryRail
              key={story.id}
              owner={owner}
              pending={pending}
              sources={bundle.sources}
              story={story}
              onReact={react}
            />
          ))}
          <p aria-live="polite" className="reader-message">{message}</p>
        </aside>
      </div>
    </section>
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

function StoryRail({
  owner,
  pending,
  sources,
  story,
  onReact,
}: {
  owner: boolean;
  pending: string | null;
  sources: EditionBundle["sources"];
  story: EditionStory;
  onReact: (action: ReactionAction, storyId: string) => Promise<void>;
}) {
  const storySources = story.sourceIds
    .map((sourceId) => sources.find((source) => source.id === sourceId))
    .filter((source): source is EditionBundle["sources"][number] => Boolean(source));
  const headline = story.headline ?? story.id.replaceAll(/[-_]/g, " ");

  return (
    <article className="rail-story">
      <div className="story-label" data-label={story.label}>
        {story.label === "fact" ? "Fact" : "Inference"}
      </div>
      <h2>{headline}</h2>
      <div className="story-sources">
        <span>Sources</span>
        {storySources.map((source) => (
          <a href={source.url} key={source.id} rel="noreferrer" target="_blank">
            {source.id}
          </a>
        ))}
      </div>
      {owner ? (
        <div className="reaction-actions" aria-label={`Feedback for ${headline}`}>
          <ReactionButton action="love" label="Love" pending={pending} storyId={story.id} onReact={onReact} />
          <ReactionButton action="less" label="Less" pending={pending} storyId={story.id} onReact={onReact} />
          <ReactionButton action="follow" label="Follow" pending={pending} storyId={story.id} onReact={onReact} />
        </div>
      ) : null}
    </article>
  );
}

function ReactionButton({
  action,
  label,
  pending,
  storyId,
  onReact,
}: {
  action: ReactionAction;
  label: string;
  pending: string | null;
  storyId: string;
  onReact: (action: ReactionAction, storyId: string) => Promise<void>;
}) {
  return (
    <button disabled={pending !== null} onClick={() => onReact(action, storyId)} type="button">
      {pending === `${action}:${storyId}` ? "Saved" : label}
    </button>
  );
}

function pageDocument(page: EditionPage, bundle: EditionBundle): string {
  return `<!doctype html><html lang="${escapeAttribute(bundle.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    :root { color: oklch(16% 0.01 260); background: oklch(100% 0 0); font-family: "Noto Serif TC", "Source Han Serif TC", Georgia, serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; padding: clamp(1.25rem, 3vw, 3.5rem); overflow-wrap: anywhere; }
    img, svg, video { max-width: 100%; height: auto; }
    a { color: inherit; }
    ${page.css ?? ""}
  </style></head><body>${page.html}</body></html>`;
}

function formatDate(date: string, language: string): string {
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}
