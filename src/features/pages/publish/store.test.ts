import { beforeEach, describe, it, expect } from 'vitest';
import { useStore, type PageVersion } from '@/store/useStore';
import { validatePageDef, type PageDef } from '../schema';

const state = () => useStore.getState();

function makeDef(id: string, title = 'Test Page'): PageDef {
  return validatePageDef({
    template: 'grid-system',
    id,
    title,
    profile: { displayName: title },
    blocks: [],
  });
}

function version(n: number, txId: string, defHash = `hash-${n}`): PageVersion {
  return { version: n, txId, size: 1234, defHash, timestamp: Date.now() };
}

beforeEach(() => {
  useStore.setState({ pages: [] });
});

describe('pages store — drafts', () => {
  it('upsertPageDraft creates an unpublished draft', () => {
    state().upsertPageDraft('p1', makeDef('p1', 'Draft One'));
    const page = state().getPage('p1');
    expect(page).toBeDefined();
    expect(page?.currentVersion).toBe(0);
    expect(page?.latestTxId).toBe('');
    expect(page?.versions).toHaveLength(0);
    expect(page?.title).toBe('Draft One');
  });

  it('upsertPageDraft updates the def in place (no new record)', () => {
    state().upsertPageDraft('p1', makeDef('p1', 'Draft One'));
    state().upsertPageDraft('p1', makeDef('p1', 'Draft One Edited'));
    expect(state().pages).toHaveLength(1);
    expect(state().getPage('p1')?.title).toBe('Draft One Edited');
  });

  it('orders newest-first', () => {
    state().upsertPageDraft('p1', makeDef('p1'));
    state().upsertPageDraft('p2', makeDef('p2'));
    expect(state().pages.map((p) => p.id)).toEqual(['p2', 'p1']);
  });
});

describe('pages store — versions', () => {
  it('addPageVersion bumps currentVersion / latestTxId and prepends the version', () => {
    state().upsertPageDraft('p1', makeDef('p1'));
    state().addPageVersion('p1', version(1, 'tx-1'), makeDef('p1'));
    let page = state().getPage('p1')!;
    expect(page.currentVersion).toBe(1);
    expect(page.latestTxId).toBe('tx-1');
    expect(page.versions).toHaveLength(1);

    state().addPageVersion('p1', version(2, 'tx-2'), makeDef('p1'));
    page = state().getPage('p1')!;
    expect(page.currentVersion).toBe(2);
    expect(page.latestTxId).toBe('tx-2');
    expect(page.versions.map((v) => v.version)).toEqual([2, 1]); // newest-first
  });

  it('addPageVersion creates the page if no draft exists', () => {
    state().addPageVersion('p9', version(1, 'tx-9'), makeDef('p9', 'Fresh'));
    const page = state().getPage('p9')!;
    expect(page.currentVersion).toBe(1);
    expect(page.title).toBe('Fresh');
  });

  it('addPageVersion is idempotent by version number (replaces in place)', () => {
    state().addPageVersion('p1', version(1, 'tx-1'), makeDef('p1'));
    state().addPageVersion(
      'p1',
      { ...version(1, 'tx-1'), arnsRepointTxId: 'arns-tx' },
      makeDef('p1'),
    );
    const page = state().getPage('p1')!;
    expect(page.versions).toHaveLength(1);
    expect(page.versions[0].arnsRepointTxId).toBe('arns-tx');
    expect(page.currentVersion).toBe(1);
  });
});

describe('pages store — arns + labels', () => {
  it('updatePageArNS stores the domain assignment', () => {
    state().upsertPageDraft('p1', makeDef('p1'));
    state().updatePageArNS('p1', {
      name: 'myname',
      undername: 'links',
      targetTxId: 'tx-1',
      arnsTxId: 'arns-1',
    });
    expect(state().getPage('p1')?.arns).toEqual({
      name: 'myname',
      undername: 'links',
      targetTxId: 'tx-1',
      arnsTxId: 'arns-1',
    });
  });

  it('setPageLabels replaces the label list', () => {
    state().upsertPageDraft('p1', makeDef('p1'));
    state().setPageLabels('p1', ['personal', 'wip']);
    expect(state().getPage('p1')?.labels).toEqual(['personal', 'wip']);
  });
});

describe('pages store — duplicate + delete + save', () => {
  it('duplicatePage returns a new id and branches a fresh, unpublished copy', () => {
    state().addPageVersion('p1', version(1, 'tx-1'), makeDef('p1', 'Original'));
    state().updatePageArNS('p1', { name: 'myname', targetTxId: 'tx-1' });

    const newId = state().duplicatePage('p1');
    expect(newId).toBeTruthy();
    expect(newId).not.toBe('p1');

    const copy = state().getPage(newId)!;
    expect(copy.title).toBe('Original (copy)');
    expect(copy.currentVersion).toBe(0);
    expect(copy.versions).toHaveLength(0);
    expect(copy.latestTxId).toBe('');
    expect(copy.arns).toBeUndefined(); // domain is not inherited
    expect(copy.def.id).toBe(newId); // def id matches the new page id

    // Independence: the duplicate deep-clones the def — no shared nested refs, so
    // editing the copy in place never mutates the source (and vice-versa).
    const orig = state().getPage('p1')!;
    expect(copy.def).not.toBe(orig.def);
    expect(copy.def.blocks).not.toBe(orig.def.blocks);
    expect(copy.def.profile).not.toBe(orig.def.profile);
    copy.def.profile.displayName = 'MUTATED';
    expect(state().getPage('p1')!.def.profile.displayName).not.toBe('MUTATED');
  });

  it('deletePage removes the local record', () => {
    state().upsertPageDraft('p1', makeDef('p1'));
    state().upsertPageDraft('p2', makeDef('p2'));
    state().deletePage('p1');
    expect(state().getPage('p1')).toBeUndefined();
    expect(state().pages.map((p) => p.id)).toEqual(['p2']);
  });

  it('savePage inserts a new page and updates an existing one', () => {
    const page = {
      id: 'p1',
      title: 'Saved',
      template: 'grid-system' as const,
      currentVersion: 0,
      latestTxId: '',
      versions: [],
      def: makeDef('p1', 'Saved'),
      labels: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state().savePage(page);
    expect(state().pages).toHaveLength(1);

    state().savePage({ ...page, title: 'Saved Again' });
    expect(state().pages).toHaveLength(1);
    expect(state().getPage('p1')?.title).toBe('Saved Again');
  });
});
