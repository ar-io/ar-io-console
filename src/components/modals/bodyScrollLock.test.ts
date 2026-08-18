import { beforeEach, describe, expect, it } from 'vitest';

import {
  __resetBodyScrollLock,
  bodyScrollLockDepth,
  lockBodyScroll,
  releaseBodyScroll,
  type ScrollLockTarget,
} from './bodyScrollLock';

const makeTarget = (overflow = ''): ScrollLockTarget => ({ style: { overflow } });

describe('body scroll lock', () => {
  beforeEach(() => __resetBodyScrollLock());

  it('locks on open and restores on close', () => {
    const body = makeTarget();
    const a = Symbol('a');
    lockBodyScroll(a, body);
    expect(body.style.overflow).toBe('hidden');
    releaseBodyScroll(a, body);
    expect(body.style.overflow).toBe('');
  });

  it('keeps the lock while an outer modal is still open', () => {
    const body = makeTarget();
    const outer = Symbol('outer');
    const inner = Symbol('inner');
    lockBodyScroll(outer, body);
    lockBodyScroll(inner, body);
    releaseBodyScroll(inner, body);
    expect(body.style.overflow).toBe('hidden');
    releaseBodyScroll(outer, body);
    expect(body.style.overflow).toBe('');
  });

  it('restores scrolling when the INNER modal is the last one out', () => {
    // The reported bug. React cleans a parent up before the child it renders, so
    // when WalletSelectionModal and its BlockingMessageModal unmount together
    // the inner modal releases last. Saving the pre-lock value per instance made
    // it restore 'hidden' here, leaving the whole app unscrollable until reload.
    const body = makeTarget();
    const outer = Symbol('outer');
    const inner = Symbol('inner');
    lockBodyScroll(outer, body);
    lockBodyScroll(inner, body);
    releaseBodyScroll(outer, body);
    releaseBodyScroll(inner, body);
    expect(body.style.overflow).toBe('');
  });

  it('preserves a pre-existing overflow value set by the page', () => {
    const body = makeTarget('clip');
    const a = Symbol('a');
    lockBodyScroll(a, body);
    releaseBodyScroll(a, body);
    expect(body.style.overflow).toBe('clip');
  });

  it('ignores a double release', () => {
    const body = makeTarget();
    const a = Symbol('a');
    const b = Symbol('b');
    lockBodyScroll(a, body);
    lockBodyScroll(b, body);
    releaseBodyScroll(a, body);
    releaseBodyScroll(a, body); // StrictMode / repeated cleanup
    expect(bodyScrollLockDepth()).toBe(1);
    expect(body.style.overflow).toBe('hidden');
    releaseBodyScroll(b, body);
    expect(body.style.overflow).toBe('');
  });

  it('survives three levels closing in an arbitrary order', () => {
    const body = makeTarget();
    const ids = [Symbol('a'), Symbol('b'), Symbol('c')];
    ids.forEach((id) => lockBodyScroll(id, body));
    [ids[1], ids[0], ids[2]].forEach((id) => releaseBodyScroll(id, body));
    expect(body.style.overflow).toBe('');
  });
});
