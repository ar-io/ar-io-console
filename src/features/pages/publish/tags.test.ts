import { describe, it, expect } from 'vitest';
import { buildPageTags, mergePageTags, type Tag } from './tags';
import { APP_NAME, APP_VERSION } from '@/constants';
import { validatePageDef, type PageDef } from '../schema';

const def: PageDef = validatePageDef({
  template: 'grid-system',
  id: 'page-abc',
  title: "Ariana's Links",
  profile: { displayName: 'Ariana' },
  blocks: [],
});

const tagMap = (tags: Tag[]): Record<string, string> =>
  Object.fromEntries(tags.map((t) => [t.name, t.value]));

describe('buildPageTags — standardized tags', () => {
  const tags = buildPageTags(def, 3);
  const map = tagMap(tags);

  it('emits the deployment-tool tags with correct values', () => {
    expect(map['Deployed-By']).toBe(APP_NAME);
    expect(map['Deployed-By-Version']).toBe(APP_VERSION);
    expect(map['App-Feature']).toBe('Pages');
  });

  it('emits the page content-type + type markers', () => {
    expect(map['Content-Type']).toBe('text/html');
    expect(map['Type']).toBe('page');
    expect(map['Render-With']).toBe('ario-console-pages@1');
  });

  it('emits the page identity tags from the def + version', () => {
    expect(map['Page-Id']).toBe('page-abc');
    expect(map['Page-Version']).toBe('3');
    expect(map['Page-Title']).toBe("Ariana's Links");
    expect(map['Page-Template']).toBe('grid-system');
  });

  it('has no duplicate tag names', () => {
    const names = tags.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('buildPageTags — custom tag merge', () => {
  it('lets a custom tag override a default of the same name', () => {
    const tags = buildPageTags(def, 1, [{ name: 'Deployed-By', value: 'Custom Tool' }]);
    const map = tagMap(tags);
    expect(map['Deployed-By']).toBe('Custom Tool');
    // still has exactly one Deployed-By
    expect(tags.filter((t) => t.name === 'Deployed-By')).toHaveLength(1);
    // untouched defaults survive
    expect(map['App-Feature']).toBe('Pages');
  });

  it('appends brand-new custom tags', () => {
    const tags = buildPageTags(def, 1, [{ name: 'Topic', value: 'design' }]);
    expect(tagMap(tags)['Topic']).toBe('design');
  });

  it('places custom tags before non-overridden defaults', () => {
    const tags = buildPageTags(def, 1, [{ name: 'Topic', value: 'design' }]);
    expect(tags[0]).toEqual({ name: 'Topic', value: 'design' });
  });
});

describe('mergePageTags', () => {
  it('returns [...custom, ...non-overridden defaults]', () => {
    const merged = mergePageTags(
      [
        { name: 'A', value: 'default-a' },
        { name: 'B', value: 'default-b' },
      ],
      [{ name: 'A', value: 'custom-a' }],
    );
    expect(merged).toEqual([
      { name: 'A', value: 'custom-a' },
      { name: 'B', value: 'default-b' },
    ]);
  });
});
