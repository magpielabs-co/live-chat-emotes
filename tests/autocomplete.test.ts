import { describe, expect, it } from 'vitest';
import { matchEmotes } from '../src/content/autocomplete';
import type { EmoteCatalog, EmoteRecord } from '../src/lib/types';

function mkRec(name: string, extra: Partial<EmoteRecord> = {}): EmoteRecord {
  return {
    id: `id-${name}`,
    name,
    nameLower: name.toLowerCase(),
    animated: false,
    zeroWidth: false,
    files: { webp: { '1x': `https://cdn.example/${name}/1x.webp` } },
    ...extra,
  };
}

function mkCatalog(names: (string | EmoteRecord)[]): EmoteCatalog {
  const records = names.map((n) => (typeof n === 'string' ? mkRec(n) : n));
  const byName: Record<string, EmoteRecord> = {};
  const byLower: Record<string, EmoteRecord> = {};
  for (const r of records) {
    byName[r.name] = r;
    if (!byLower[r.nameLower]) byLower[r.nameLower] = r;
  }
  return { setId: 's', setName: 't', emoteCount: records.length, records, byName, byLower };
}

describe('matchEmotes', () => {
  it('returns [] for empty query', () => {
    expect(matchEmotes(mkCatalog(['KEKW']), '')).toEqual([]);
  });

  it('is case-insensitive', () => {
    const c = mkCatalog(['KEKW', 'KEKWait']);
    const results = matchEmotes(c, 'k');
    expect(results.map((r) => r.name).sort()).toEqual(['KEKW', 'KEKWait']);
  });

  it('sorts shorter matches first', () => {
    const c = mkCatalog(['KEKWait', 'KEKW']);
    const results = matchEmotes(c, 'K');
    expect(results.map((r) => r.name)).toEqual(['KEKW', 'KEKWait']);
  });

  it('excludes zero-width emotes from suggestions', () => {
    const c = mkCatalog([mkRec('ZW', { zeroWidth: true }), mkRec('Zoom')]);
    const results = matchEmotes(c, 'z');
    expect(results.map((r) => r.name)).toEqual(['Zoom']);
  });

  it('prefix matches only (does not return substring matches)', () => {
    const c = mkCatalog(['KEKW', 'SuperKEKW']);
    const results = matchEmotes(c, 'KEK');
    expect(results.map((r) => r.name)).toEqual(['KEKW']);
  });

  it('caps results at 8', () => {
    const c = mkCatalog(Array.from({ length: 20 }, (_, i) => `K${i}`));
    expect(matchEmotes(c, 'k')).toHaveLength(8);
  });
});
