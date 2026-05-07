import type { EmoteCatalog, EmoteRecord } from '../lib/types';

export type TextToken = { type: 'text'; value: string };
export type EmoteToken = { type: 'emote'; record: EmoteRecord };
export type Token = TextToken | EmoteToken;

/**
 * Match `:NAME:` tokens anywhere in `text`. Names are alphanumerics, `_`, `-`.
 * The colons are stripped from the output (the emote replaces the whole token).
 *
 * Lookup is **case-insensitive** via `catalog.byLower` — the surrounding colons
 * already prevent regular English words from accidentally rendering as emotes,
 * so case-sensitivity is no longer needed for disambiguation.
 *
 * Zero-width emotes are left as plain text (rendering them correctly requires
 * stacking — v2 work, see PLAN.md §2). Unknown `:foo:` patterns also pass
 * through as plain text.
 */
const TOKEN_RE = /:([A-Za-z0-9_\-]+):/g;

export function tokenize(text: string, catalog: EmoteCatalog): Token[] {
  if (!text) return [];

  const tokens: Token[] = [];
  let lastIndex = 0;

  // Reset is unnecessary because TOKEN_RE is constructed fresh per scope use,
  // but exec() with /g state requires we use it consistently. Make a local copy
  // to keep this function reentrant.
  const re = new RegExp(TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const name = m[1]!;
    const rec = catalog.byLower[name.toLowerCase()];

    if (!rec || rec.zeroWidth) {
      // Unknown or zero-width — leave the colons in place as text. We don't
      // advance lastIndex past the match yet; we'll fold it into the next
      // text run below by letting the loop continue and the closing colon
      // get re-scanned only if it's also a valid opener (it isn't on its own).
      // To keep this simple, just continue and the unmatched text gets emitted
      // by the trailing slice. We still need the regex to advance, which exec
      // does via lastIndex.
      continue;
    }

    // Emit any text leading up to this match.
    if (m.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    }
    tokens.push({ type: 'emote', record: rec });
    lastIndex = m.index + m[0].length;
  }

  // Trailing text (or the entire string if there were no matches).
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  // Coalesce adjacent text tokens (can happen if an unknown :foo: sits between
  // two emotes — the leading-text slice for the next emote starts after the
  // unknown match, but we never emitted the unknown match itself, so the text
  // run naturally includes it). No-op for the common case.
  return coalesce(tokens);
}

function coalesce(tokens: Token[]): Token[] {
  if (tokens.length < 2) return tokens;
  const out: Token[] = [];
  for (const tok of tokens) {
    const prev = out[out.length - 1];
    if (tok.type === 'text' && prev && prev.type === 'text') {
      prev.value += tok.value;
    } else {
      out.push(tok);
    }
  }
  return out;
}
