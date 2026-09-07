import { useMemo, useState } from 'react';
import { History } from 'lucide-react';

import changelogSource from '../../CHANGELOG.md?raw';
import {
  orderSections,
  parseChangelog,
  parseInline,
  type ChangelogEntry,
} from '@/utils/changelog';

/**
 * What's new (`/changelog`) — the release history, rendered from CHANGELOG.md.
 *
 * The markdown is imported raw at build time and parsed in `utils/changelog`,
 * so the file stays the single source of truth. Hand-copying entries into a
 * component is how a changelog quietly stops matching the product, and a
 * changelog nobody trusts is worse than not having one.
 *
 * Structured as a timeline because the content genuinely is a chronology — the
 * rail encodes the order rather than decorating it. Recent releases are open;
 * everything older is one click away, since a year of history is a lot of
 * scroll in front of the entry most people came to read.
 */

/** How many releases are expanded before the reader asks for more. */
const INITIAL_VISIBLE = 5;

/**
 * A tint per section, drawn from the app's semantic tokens rather than a new
 * palette. Kept muted: the section label is a signpost, not the content.
 */
const SECTION_TONE: Record<string, string> = {
  Added: 'text-success',
  Fixed: 'text-primary',
  Changed: 'text-foreground/70',
  Removed: 'text-error/80',
  Performance: 'text-warning',
};

function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, i) => {
        if (token.kind === 'strong') {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {token.value}
            </strong>
          );
        }
        if (token.kind === 'code') {
          return (
            <code
              key={i}
              className="rounded bg-background px-1 py-0.5 font-mono text-[0.85em] text-foreground/80"
            >
              {token.value}
            </code>
          );
        }
        return <span key={i}>{token.value}</span>;
      })}
    </>
  );
}

function Release({
  entry,
  isCurrent,
}: {
  entry: ChangelogEntry;
  isCurrent: boolean;
}) {
  return (
    <li className="relative pl-8">
      {/* Timeline node, sitting on the rail drawn by the list below. */}
      <span
        aria-hidden
        className={`absolute left-0 top-2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background ${
          isCurrent ? 'bg-primary' : 'bg-border'
        }`}
      />

      <div className="rounded-2xl border border-border/20 bg-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-heading text-xl text-foreground">
            {entry.version}
          </h2>
          {entry.date && (
            <span className="text-sm text-foreground/60">{entry.date}</span>
          )}
          {isCurrent && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              You&apos;re on this version
            </span>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {orderSections(entry.sections).map((section) => (
            <div key={section.title}>
              <h3
                className={`mb-2 font-heading text-xs uppercase tracking-wide ${
                  SECTION_TONE[section.title] ?? 'text-foreground/70'
                }`}
              >
                {section.title}
              </h3>
              <ul className="flex flex-col gap-2">
                {section.items.map((item, i) => (
                  <li
                    key={i}
                    className="text-sm leading-relaxed text-foreground/70"
                  >
                    <InlineText text={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </li>
  );
}

export default function ChangelogPage() {
  const entries = useMemo(() => parseChangelog(changelogSource), []);
  const [showAll, setShowAll] = useState(false);

  const current = import.meta.env.PACKAGE_VERSION;
  const visible = showAll ? entries : entries.slice(0, INITIAL_VISIBLE);
  const hidden = entries.length - visible.length;

  return (
    <div className="px-4 sm:px-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card">
          <History className="h-5 w-5 text-foreground" />
        </div>
        <div>
          <h1 className="mb-1 font-heading text-2xl text-foreground">
            What&apos;s new
          </h1>
          <p className="text-sm text-foreground/80">
            Every release of the ar.io Console, newest first.
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No release notes available.
        </p>
      ) : (
        <>
          {/* The rail itself — a border on the list, so it spans exactly the
              releases and stops with them. */}
          <ul className="flex flex-col gap-4 border-l border-border/40 pl-0">
            {visible.map((entry) => (
              <Release
                key={entry.version}
                entry={entry}
                isCurrent={entry.version === current}
              />
            ))}
          </ul>

          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/20 bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-primary/5"
            >
              Show {hidden} earlier {hidden === 1 ? 'release' : 'releases'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
