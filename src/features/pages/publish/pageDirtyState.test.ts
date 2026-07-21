/**
 * Backs the "unpublished changes" badge (PageCard, bug #5) and the no-op-autosave
 * skip (PagesPanel, bug #4). Both hinge on one predicate: the working `page.def`
 * hash vs the current published version's stored `defHash`. Exercised through the
 * real store actions so the version bookkeeping is the same code the UI uses.
 */

import { beforeEach, describe, it, expect } from 'vitest';
import { useStore, type PageVersion } from '@/store/useStore';
import { validatePageDef, type PageDef } from '../schema';
import { computeDefHash, isPageDirty } from './pageFile';

const state = () => useStore.getState();

function makeDef(id: string, title = 'Test Page'): PageDef {
  return validatePageDef({
    template: 'grid-system',
    id,
    title,
    profile: { displayName: title },
    blocks: [{ type: 'link', label: 'Site', url: 'https://example.com' }],
  });
}

/** Publish a def as version n, storing the real content hash (as usePagePublish does). */
function publishVersion(pageId: string, n: number, def: PageDef): PageVersion {
  const version: PageVersion = {
    version: n,
    txId: `tx-${n}`,
    size: 1234,
    defHash: computeDefHash(def),
    timestamp: Date.now(),
  };
  state().addPageVersion(pageId, version, def);
  return version;
}

beforeEach(() => {
  useStore.setState({ pages: [] });
});

describe('unpublished-changes / no-op detection', () => {
  it('a freshly-published page is not dirty (working def hash === current version hash)', () => {
    const def = makeDef('p1', 'Live');
    publishVersion('p1', 1, def);
    expect(isPageDirty(state().getPage('p1')!)).toBe(false);
  });

  it('editing a published page marks it dirty', () => {
    const def = makeDef('p1', 'Live');
    publishVersion('p1', 1, def);

    // Autosave persists an edited working def without a new version.
    const edited: PageDef = { ...def, title: 'Live (edited)' };
    state().upsertPageDraft('p1', edited);

    const page = state().getPage('p1')!;
    expect(page.currentVersion).toBe(1); // still on v1 — no republish
    expect(isPageDirty(page)).toBe(true);
  });

  it('re-publishing the edited def clears the dirty flag', () => {
    const def = makeDef('p1', 'Live');
    publishVersion('p1', 1, def);
    const edited: PageDef = { ...def, title: 'Live (edited)' };
    state().upsertPageDraft('p1', edited);
    expect(isPageDirty(state().getPage('p1')!)).toBe(true);

    publishVersion('p1', 2, edited);
    expect(isPageDirty(state().getPage('p1')!)).toBe(false);
  });

  it('a no-op save (identical content, only timestamps differ) is not dirty', () => {
    const def = makeDef('p1', 'Live');
    publishVersion('p1', 1, def);

    // Same content, fresh timestamps — the exact case bug #4 must not re-write/re-sort.
    const touched: PageDef = { ...def, updatedAt: def.updatedAt! + 5000 };
    state().upsertPageDraft('p1', touched);

    expect(isPageDirty(state().getPage('p1')!)).toBe(false);
    expect(computeDefHash(touched)).toBe(computeDefHash(def));
  });

  it('an unpublished draft (no versions) is never dirty', () => {
    state().upsertPageDraft('p1', makeDef('p1'));
    expect(isPageDirty(state().getPage('p1')!)).toBe(false);
  });
});
