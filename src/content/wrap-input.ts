import type { EmoteCatalog } from '../lib/types';
import { buildEmoteInputWrapper } from './renderer';

const TOKEN_RE = /:([A-Za-z0-9_\-]+):/g;
const WRAPPER_CLASS = 'ytce-input-emote';

/**
 * Scan the chat input's text nodes for `:NAME:` shortcodes and replace each
 * with a visual emote wrapper (image + hidden text — see
 * `buildEmoteInputWrapper`). Idempotent: text already inside an existing
 * wrapper is skipped.
 *
 * Cursor handling: after wrapping, place the cursor at the end of the input.
 * That's correct for the common "type then pick" flow (caret was already at
 * the end of inserted text). Mid-sentence insertion does jump the caret to
 * the end — acceptable for v0.3 and avoids the edge cases of mapping offsets
 * across split text nodes.
 */
export function wrapInputEmotes(
  input: HTMLElement,
  catalog: EmoteCatalog,
  sizePx: number,
): void {
  // Collect first, mutate after — TreeWalker doesn't like the tree changing
  // out from under it.
  const textNodes = collectTextNodes(input);

  let mutated = false;
  for (const node of textNodes) {
    const text = node.nodeValue ?? '';
    if (text.indexOf(':') === -1) continue;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let didMatch = false;

    // Fresh regex per node so /g state stays local.
    const re = new RegExp(TOKEN_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const rec = catalog.byLower[m[1]!.toLowerCase()];
      if (!rec || rec.zeroWidth) continue;

      didMatch = true;
      if (m.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      }
      frag.appendChild(buildEmoteInputWrapper(rec, sizePx));
      lastIndex = m.index + m[0].length;
    }

    if (!didMatch) continue;
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode?.replaceChild(frag, node);
    mutated = true;
  }

  if (mutated) setCaretToEnd(input);
}

/** Collect text nodes inside `root`, skipping anything inside an existing wrapper. */
function collectTextNodes(root: HTMLElement): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      (n as Text).parentElement?.closest(`.${WRAPPER_CLASS}`)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  let cur: Node | null = walker.nextNode();
  while (cur) {
    out.push(cur as Text);
    cur = walker.nextNode();
  }
  return out;
}

function setCaretToEnd(input: HTMLElement): void {
  input.focus();
  const range = document.createRange();
  range.selectNodeContents(input);
  range.collapse(false);
  const sel = document.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
