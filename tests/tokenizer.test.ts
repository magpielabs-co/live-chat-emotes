import { describe, expect, it } from 'vitest';
import { tokenize } from '../src/content/tokenizer';
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

function mkCatalog(records: EmoteRecord[]): EmoteCatalog {
  const byName: Record<string, EmoteRecord> = {};
  const byLower: Record<string, EmoteRecord> = {};
  for (const r of records) {
    byName[r.name] = r;
    if (!byLower[r.nameLower]) byLower[r.nameLower] = r;
  }
  return {
    setId: 's',
    setName: 'test',
    emoteCount: records.length,
    records,
    byName,
    byLower,
  };
}

describe('tokenize', () => {
  it('returns [] for empty input', () => {
    const c = mkCatalog([mkRec('KEKW')]);
    expect(tokenize('', c)).toEqual([]);
  });

  it('returns a single text token when no emotes match', () => {
    const c = mkCatalog([mkRec('KEKW')]);
    expect(tokenize('hello world', c)).toEqual([{ type: 'text', value: 'hello world' }]);
  });

  it('returns whitespace-only text unchanged', () => {
    const c = mkCatalog([mkRec('KEKW')]);
    expect(tokenize('   ', c)).toEqual([{ type: 'text', value: '   ' }]);
  });

  it('does NOT match bare names without colons', () => {
    const c = mkCatalog([mkRec('KEKW')]);
    expect(tokenize('KEKW', c)).toEqual([{ type: 'text', value: 'KEKW' }]);
    expect(tokenize('lol KEKW funny', c)).toEqual([{ type: 'text', value: 'lol KEKW funny' }]);
  });

  it('replaces a colon-wrapped emote in the middle of a sentence', () => {
    const c = mkCatalog([mkRec('KEKW')]);
    const t = tokenize('lol :KEKW: funny', c);
    expect(t).toHaveLength(3);
    expect(t[0]).toEqual({ type: 'text', value: 'lol ' });
    expect(t[1]?.type).toBe('emote');
    expect((t[1] as { type: 'emote'; record: EmoteRecord }).record.name).toBe('KEKW');
    expect(t[2]).toEqual({ type: 'text', value: ' funny' });
  });

  it('drops the colons from the emote token (output has no `:`s for the matched emote)', () => {
    const c = mkCatalog([mkRec('KEKW')]);
    const t = tokenize(':KEKW:', c);
    expect(t).toHaveLength(1);
    expect(t[0]?.type).toBe('emote');
  });

  it('matches case-insensitively via byLower', () => {
    const c = mkCatalog([mkRec('KEKW')]);
    const lower = tokenize(':kekw:', c);
    const mixed = tokenize(':Kekw:', c);
    const upper = tokenize(':KEKW:', c);
    for (const t of [lower, mixed, upper]) {
      expect(t).toHaveLength(1);
      expect(t[0]?.type).toBe('emote');
      expect((t[0] as { type: 'emote'; record: EmoteRecord }).record.name).toBe('KEKW');
    }
  });

  it('leaves :unknown: as plain text including the colons', () => {
    const c = mkCatalog([mkRec('KEKW')]);
    expect(tokenize(':unknown:', c)).toEqual([{ type: 'text', value: ':unknown:' }]);
    expect(tokenize('hi :nope: bye', c)).toEqual([{ type: 'text', value: 'hi :nope: bye' }]);
  });

  it('does not match incomplete patterns (missing trailing or leading colon)', () => {
    const c = mkCatalog([mkRec('KEKW')]);
    expect(tokenize(':KEKW', c)).toEqual([{ type: 'text', value: ':KEKW' }]);
    expect(tokenize('KEKW:', c)).toEqual([{ type: 'text', value: 'KEKW:' }]);
  });

  it('replaces multiple emotes with whitespace and unknown tokens preserved', () => {
    const c = mkCatalog([mkRec('KEKW'), mkRec('pepe')]);
    const t = tokenize(':KEKW: :nope: :pepe:', c);
    expect(t).toHaveLength(3);
    expect(t[0]?.type).toBe('emote');
    expect((t[0] as { type: 'emote'; record: EmoteRecord }).record.name).toBe('KEKW');
    expect(t[1]).toEqual({ type: 'text', value: ' :nope: ' });
    expect(t[2]?.type).toBe('emote');
    expect((t[2] as { type: 'emote'; record: EmoteRecord }).record.name).toBe('pepe');
  });

  it('handles back-to-back emotes with no separating text', () => {
    const c = mkCatalog([mkRec('KEKW'), mkRec('pepe')]);
    const t = tokenize(':KEKW::pepe:', c);
    expect(t).toHaveLength(2);
    expect(t[0]?.type).toBe('emote');
    expect((t[0] as { type: 'emote'; record: EmoteRecord }).record.name).toBe('KEKW');
    expect(t[1]?.type).toBe('emote');
    expect((t[1] as { type: 'emote'; record: EmoteRecord }).record.name).toBe('pepe');
  });

  it('skips zero-width emotes (left as text)', () => {
    const c = mkCatalog([mkRec('ZW', { zeroWidth: true })]);
    expect(tokenize(':ZW:', c)).toEqual([{ type: 'text', value: ':ZW:' }]);
  });

  it('preserves surrounding whitespace exactly', () => {
    const c = mkCatalog([mkRec('K')]);
    const t = tokenize('  :K:   :K:  ', c);
    // "  " + emote + "   " + emote + "  "
    expect(t).toHaveLength(5);
    expect(t.map((x) => x.type)).toEqual(['text', 'emote', 'text', 'emote', 'text']);
    expect((t[0] as { type: 'text'; value: string }).value).toBe('  ');
    expect((t[2] as { type: 'text'; value: string }).value).toBe('   ');
    expect((t[4] as { type: 'text'; value: string }).value).toBe('  ');
  });

  it('matches names containing underscores and hyphens', () => {
    const c = mkCatalog([mkRec('foo_bar'), mkRec('hyper-pog')]);
    const t = tokenize(':foo_bar: :hyper-pog:', c);
    expect(t.filter((tok) => tok.type === 'emote')).toHaveLength(2);
  });
});
