/**
 * Parse `CHANGELOG.md` into something renderable.
 *
 * The file is the single source of truth and stays that way: the page imports
 * it raw at build time and derives everything here. A hand-written second copy
 * in a component is how a changelog quietly stops matching the product — and a
 * changelog nobody trusts is worse than none.
 *
 * Deliberately a tiny parser rather than a markdown library. The file is one
 * shape we control (`## [x.y.z] - date`, `### Section`, `- item`), and pulling
 * in a renderer to read our own release notes would ship a parser for
 * everything markdown can do in order to display four things.
 */

/** Section names the changelog actually uses, in the order they should read. */
export const SECTION_ORDER = [
  'Added',
  'Changed',
  'Fixed',
  'Removed',
  'Performance',
] as const;

export interface ChangelogSection {
  /** "Added", "Fixed", … */
  title: string;
  /** One entry per bullet, with soft-wrapped lines rejoined. */
  items: string[];
}

export interface ChangelogEntry {
  /** "4.7.0" */
  version: string;
  /** "2026-09-01", or undefined for an entry with no date yet. */
  date?: string;
  sections: ChangelogSection[];
}

const VERSION_RE = /^##\s+\[([^\]]+)\]\s*(?:-\s*(.+))?$/;
const SECTION_RE = /^###\s+(.+?)\s*$/;
const ITEM_RE = /^-\s+(.*)$/;

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let entry: ChangelogEntry | undefined;
  let section: ChangelogSection | undefined;

  for (const raw of markdown.split('\n')) {
    const line = raw.replace(/\s+$/, '');

    const version = VERSION_RE.exec(line);
    if (version) {
      entry = { version: version[1], date: version[2]?.trim(), sections: [] };
      entries.push(entry);
      section = undefined;
      continue;
    }
    if (!entry) continue; // Preamble above the first release.

    const heading = SECTION_RE.exec(line);
    if (heading) {
      section = { title: heading[1], items: [] };
      entry.sections.push(section);
      continue;
    }

    const item = ITEM_RE.exec(line);
    if (item) {
      // A bullet with no section still belongs somewhere — losing it silently
      // is the one failure a changelog cannot afford.
      if (!section) {
        section = { title: 'Changes', items: [] };
        entry.sections.push(section);
      }
      section.items.push(item[1].trim());
      continue;
    }

    /*
      A continuation of the previous bullet. Entries are hard-wrapped at ~78
      columns in the source, so without rejoining them every sentence would
      render as a fragment.
    */
    const continuation = line.trim();
    if (continuation && section && section.items.length > 0) {
      section.items[section.items.length - 1] += ` ${continuation}`;
    }
  }

  // An entry whose heading parsed but which carried nothing is noise.
  return entries.filter((e) => e.sections.some((s) => s.items.length > 0));
}

/** Sort a version's sections into a consistent reading order. */
export function orderSections(sections: ChangelogSection[]): ChangelogSection[] {
  const rank = (title: string) => {
    const i = (SECTION_ORDER as readonly string[]).indexOf(title);
    // Unknown sections sort last rather than vanishing — the file may grow one.
    return i === -1 ? SECTION_ORDER.length : i;
  };
  return [...sections].sort((a, b) => rank(a.title) - rank(b.title));
}

/**
 * Split one bullet into plain text, `**bold**` and `` `code` `` runs.
 *
 * Enough markdown for what the file actually contains, and nothing more. Every
 * entry leads with a bold sentence, which is what makes the list scannable, so
 * dropping the emphasis would lose real structure rather than decoration.
 */
export type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; value: string }
  | { kind: 'code'; value: string };

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ kind: 'text', value: text.slice(last, m.index) });
    }
    tokens.push(
      m[1] !== undefined
        ? { kind: 'strong', value: m[1] }
        : { kind: 'code', value: m[2] },
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    tokens.push({ kind: 'text', value: text.slice(last) });
  }
  return tokens;
}
