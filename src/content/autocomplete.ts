import type { EmoteCatalog, EmoteRecord } from '../lib/types';
import { getChatInput, getWordAtCaret, replaceWordAtCaret } from './input';
import { pickSrcs } from './renderer';
import { wrapInputEmotes } from './wrap-input';

const MAX_RESULTS = 8;

/**
 * Case-insensitive prefix match against `query` (the text after `:`).
 * Sorted by shortcode length ascending so `:K` surfaces `KEKW` before `KEKWait`.
 * Zero-width emotes are excluded (can't be typed into chat usefully).
 *
 * Exported for testing.
 */
export function matchEmotes(catalog: EmoteCatalog, query: string): EmoteRecord[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const hits: EmoteRecord[] = [];
  for (const rec of catalog.records) {
    if (rec.zeroWidth) continue;
    if (rec.nameLower.startsWith(q)) hits.push(rec);
    if (hits.length >= MAX_RESULTS * 4) break; // bound work, we'll slice after sort
  }
  hits.sort((a, b) => a.nameLower.length - b.nameLower.length);
  return hits.slice(0, MAX_RESULTS);
}

export function attachAutocomplete(
  getCatalog: () => EmoteCatalog | null,
  getEmoteSize: () => number,
): () => void {
  let panel: HTMLDivElement | null = null;
  let items: HTMLDivElement[] = [];
  let selectedIdx = 0;
  let currentMatches: EmoteRecord[] = [];

  const close = (): void => {
    panel?.remove();
    panel = null;
    items = [];
    currentMatches = [];
    selectedIdx = 0;
  };

  const updateSelection = (): void => {
    items.forEach((el, i) => el.classList.toggle('ytce-selected', i === selectedIdx));
    items[selectedIdx]?.scrollIntoView({ block: 'nearest' });
  };

  const insertSelected = (): void => {
    if (!currentMatches[selectedIdx]) return;
    const rec = currentMatches[selectedIdx]!;

    // Re-fetch the caret at THIS moment instead of using the reference we
    // captured in onInput. YouTube's Polymer-backed input rebuilds text
    // nodes on every keystroke, so the cached `currentCaret.textNode` can
    // already be detached by the time Tab / click fires — the range we
    // build from it resolves to an empty selection and execCommand silently
    // inserts nothing.
    const input = getChatInput();
    if (!input) return;
    const caret = getWordAtCaret(input);
    if (!caret) return;

    // Wrap in colons so the tokenizer matches it (and prevents accidental
    // tokenisation of normal English words). Trailing space lets the user
    // keep typing without thinking about spacing.
    replaceWordAtCaret(caret, `:${rec.name}: `);
    const catalog = getCatalog();
    if (catalog) wrapInputEmotes(input, catalog, getEmoteSize());
    close();
  };

  const render = (input: HTMLElement, matches: EmoteRecord[]): void => {
    close();
    if (matches.length === 0) return;

    const p = document.createElement('div');
    p.className = 'ytce-autocomplete';

    matches.forEach((rec, i) => {
      const item = document.createElement('div');
      item.className = 'ytce-autocomplete-item';

      const img = document.createElement('img');
      img.referrerPolicy = 'no-referrer';
      const srcs = pickSrcs(rec, false); // small preview — webp is fine
      if (srcs) img.src = srcs.src;
      img.alt = rec.name;
      img.loading = 'lazy';
      img.draggable = false;

      const label = document.createElement('span');
      label.className = 'ytce-autocomplete-label';
      label.textContent = rec.name;

      item.append(img, label);
      item.addEventListener('mousedown', (e) => {
        // mousedown (not click) to beat the input's blur.
        e.preventDefault();
        selectedIdx = i;
        insertSelected();
      });
      p.appendChild(item);
      items.push(item);
    });

    document.body.appendChild(p);

    // Position above the input. Use viewport coords (panel is position: fixed).
    const rect = input.getBoundingClientRect();
    p.style.left = `${Math.max(4, rect.left)}px`;
    // Position, then measure height, then adjust top so it sits above the input.
    const pRect = p.getBoundingClientRect();
    const top = rect.top - pRect.height - 4;
    p.style.top = `${Math.max(4, top)}px`;

    panel = p;
    currentMatches = matches;
    selectedIdx = 0;
    updateSelection();
  };

  const onInput = (): void => {
    const input = getChatInput();
    if (!input) return;
    const catalog = getCatalog();
    if (!catalog) return close();

    const caret = getWordAtCaret(input);
    if (!caret) return close();
    const { word } = caret;
    if (!word.startsWith(':') || word.length < 2) return close();
    // Ignore completed forms like `:pog:` — that's a literal text colon pair.
    const rest = word.slice(1);
    if (rest.includes(':')) return close();

    const matches = matchEmotes(catalog, rest);
    if (matches.length === 0) return close();
    render(input, matches);
  };

  const onKeydown = (e: KeyboardEvent): void => {
    if (!panel || currentMatches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = (selectedIdx + 1) % currentMatches.length;
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = (selectedIdx - 1 + currentMatches.length) % currentMatches.length;
      updateSelection();
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      insertSelected();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  let boundInput: HTMLElement | null = null;
  const onBlur = (): void => {
    // Close on next tick so that mousedown-selecting an item still fires.
    setTimeout(close, 150);
  };

  const bind = (): boolean => {
    const input = getChatInput();
    if (!input || boundInput === input) return !!boundInput;
    boundInput = input;
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeydown, true);
    input.addEventListener('blur', onBlur);
    return true;
  };

  const boot = (): void => {
    if (bind()) return;
    const obs = new MutationObserver(() => {
      if (bind()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  };
  boot();

  return () => {
    close();
    if (boundInput) {
      boundInput.removeEventListener('input', onInput);
      boundInput.removeEventListener('keydown', onKeydown, true);
      boundInput.removeEventListener('blur', onBlur);
      boundInput = null;
    }
  };
}
