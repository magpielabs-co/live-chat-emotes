import type { EmoteCatalog, EmoteRecord } from '../lib/types';
import { getChatInput, insertAtCaret } from './input';
import { pickSrcs } from './renderer';
import { SELECTORS } from './selectors';
import { wrapInputEmotes } from './wrap-input';

const BUTTON_CLASS = 'ytce-picker-button';

export function attachPicker(
  getCatalog: () => EmoteCatalog | null,
  getEmoteSize: () => number,
): () => void {
  let button: HTMLButtonElement | null = null;
  let panel: HTMLDivElement | null = null;
  let outsideHandler: ((e: MouseEvent) => void) | null = null;

  const closePanel = (): void => {
    panel?.remove();
    panel = null;
    if (outsideHandler) {
      document.removeEventListener('mousedown', outsideHandler);
      outsideHandler = null;
    }
  };

  const filterRecords = (records: EmoteRecord[], q: string): EmoteRecord[] => {
    if (!q) return records.filter((r) => !r.zeroWidth);
    const ql = q.toLowerCase();
    return records.filter((r) => !r.zeroWidth && r.nameLower.includes(ql));
  };

  const buildPanel = (catalog: EmoteCatalog): HTMLDivElement => {
    const p = document.createElement('div');
    p.className = 'ytce-picker-panel';

    const searchWrap = document.createElement('div');
    searchWrap.className = 'ytce-picker-search';
    const search = document.createElement('input');
    search.type = 'text';
    search.spellcheck = false;
    search.autocomplete = 'off';
    search.placeholder = 'Search emotes…';
    searchWrap.appendChild(search);
    p.appendChild(searchWrap);

    const grid = document.createElement('div');
    grid.className = 'ytce-picker-grid';
    p.appendChild(grid);

    const renderGrid = (q: string): void => {
      grid.textContent = '';
      const items = filterRecords(catalog.records, q);
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'ytce-picker-empty';
        empty.textContent = q ? 'No matching emotes' : 'No emotes loaded';
        grid.appendChild(empty);
        return;
      }
      for (const rec of items) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'ytce-picker-tile';
        // Show the colon-wrapped form so users know what gets typed.
        tile.title = `:${rec.name}:`;

        const img = document.createElement('img');
        img.referrerPolicy = 'no-referrer';
        const srcs = pickSrcs(rec, false);
        if (srcs) img.src = srcs.src;
        img.alt = rec.name;
        img.loading = 'lazy';
        img.draggable = false;
        tile.appendChild(img);

        tile.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const input = getChatInput();
          if (!input) return;
          insertAtCaret(input, `:${rec.name}: `);
          // Replace the just-inserted `:NAME:` text with a visual emote
          // wrapper so the user sees the image (not just the shortcode) in
          // their input. The wrapper preserves `:NAME:` in textContent so
          // the message that hits chat is unchanged.
          wrapInputEmotes(input, catalog, getEmoteSize());
          closePanel();
        });
        grid.appendChild(tile);
      }
    };

    renderGrid('');
    search.addEventListener('input', () => renderGrid(search.value));
    setTimeout(() => search.focus(), 0);

    return p;
  };

  const togglePanel = (): void => {
    if (panel) {
      closePanel();
      return;
    }
    const catalog = getCatalog();
    if (!catalog) return;

    const p = buildPanel(catalog);
    document.body.appendChild(p);

    if (button) {
      const btnRect = button.getBoundingClientRect();
      const pRect = p.getBoundingClientRect();
      // Prefer opening above the button. Fall back to below if there's no room above.
      const topAbove = btnRect.top - pRect.height - 6;
      const topBelow = btnRect.bottom + 6;
      const useAbove = topAbove >= 4;
      p.style.top = `${useAbove ? topAbove : topBelow}px`;
      const left = Math.max(4, btnRect.right - pRect.width);
      p.style.left = `${left}px`;
    }

    panel = p;

    outsideHandler = (e: MouseEvent) => {
      if (!panel) return;
      if (panel.contains(e.target as Node)) return;
      if (button?.contains(e.target as Node)) return;
      closePanel();
    };
    // Defer to next tick so the opening click doesn't immediately close.
    setTimeout(() => {
      if (outsideHandler) document.addEventListener('mousedown', outsideHandler);
    }, 0);
  };

  const mount = (): boolean => {
    const input = getChatInput();
    if (!input) return false;

    const renderer = input.closest(SELECTORS.messageInputRenderer);
    const bar =
      renderer?.querySelector<HTMLElement>(SELECTORS.inputButtonsContainer) ??
      input.parentElement?.parentElement ??
      null;
    if (!bar) return false;
    if (bar.querySelector(`.${BUTTON_CLASS}`)) {
      button = bar.querySelector<HTMLButtonElement>(`.${BUTTON_CLASS}`);
      return true;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BUTTON_CLASS;
    btn.title = 'Emotes';
    btn.setAttribute('aria-label', 'Open emote picker');
    btn.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"/>' +
      '<circle cx="8.5" cy="10" r="1.5"/>' +
      '<circle cx="15.5" cy="10" r="1.5"/>' +
      '<path d="M8.5 14.5a.75.75 0 0 1 1.06-.06 3.5 3.5 0 0 0 4.88 0 .75.75 0 1 1 1 1.12 5 5 0 0 1-6.88 0 .75.75 0 0 1-.06-1.06Z"/>' +
      '</svg>';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      togglePanel();
    });
    bar.appendChild(btn);
    button = btn;
    if (__DEBUG__) console.debug('[ytce] picker button mounted');
    return true;
  };

  if (!mount()) {
    const obs = new MutationObserver(() => {
      if (mount()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  return () => {
    closePanel();
    button?.remove();
    button = null;
  };
}
