import type { EmoteCatalog, EmoteFormat, EmoteRecord, EmoteScale } from '../lib/types';
import { SELECTORS } from './selectors';
import { tokenize } from './tokenizer';

// --- AVIF detection (one-shot, async, doesn't block first renders) ---

let avifSupported = false;
let avifChecked = false;

const AVIF_PROBE =
  'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAPFtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAHmlsb2MAAAAAREAAAQABAAAAAAEVAAEAAAAaAAAAKGlpbmYAAAAAAAEAAAAaaW5mZQIAAAAAAQAAYXYwMUNvbG9yAAAAAGppcHJwAAAASWlwY28AAAAUaXNwZQAAAAAAAAACAAAAAgAAABBwaXhpAAAAAAMICAgAAAAMYXYxQ4EAAAAAAAAVaXBtYQAAAAAAAAABAAEEAQKDBAAAACdtZGF0EgAKCBgABogQEDQgMv8DAAB4AAAArjIgxOMzPz8=';

function detectAvif(): void {
  if (avifChecked) return;
  if (typeof Image === 'undefined') {
    // Non-DOM environment (e.g. unit tests). Leave avifSupported = false.
    avifChecked = true;
    return;
  }
  const img = new Image();
  img.onload = () => {
    avifSupported = img.width > 0 && img.height > 0;
    avifChecked = true;
  };
  img.onerror = () => {
    avifSupported = false;
    avifChecked = true;
  };
  img.src = AVIF_PROBE;
}
detectAvif();

// --- URL helpers ---

export function emoteSrc(
  rec: EmoteRecord,
  format: EmoteFormat,
  scale: EmoteScale,
): string | undefined {
  return rec.files[format]?.[scale];
}

export interface EmoteImageSrcs {
  src: string;
  srcset?: string;
}

export function pickSrcs(rec: EmoteRecord, preferAvif: boolean): EmoteImageSrcs | null {
  const fmt: EmoteFormat = preferAvif && rec.files.avif ? 'avif' : rec.files.webp ? 'webp' : rec.files.avif ? 'avif' : 'webp';
  const s1 = emoteSrc(rec, fmt, '1x');
  if (!s1) return null;
  const s2 = emoteSrc(rec, fmt, '2x');
  const s3 = emoteSrc(rec, fmt, '3x');
  const parts = [s1 ? `${s1} 1x` : null, s2 ? `${s2} 2x` : null, s3 ? `${s3} 3x` : null].filter(
    Boolean,
  ) as string[];
  return { src: s1, srcset: parts.length > 1 ? parts.join(', ') : undefined };
}

// --- Rendering ---

// `_sizePx` is accepted for API stability but ignored — sizing is driven by the
// `--ytce-emote-size` CSS variable on the document root (set in chat.ts and
// kept in sync with the popup setting via the storage onChanged listener).
// Going through CSS rather than inline style means already-rendered emotes
// resize live when the user adjusts the slider, instead of only new ones.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildEmoteImage(rec: EmoteRecord, _sizePx: number): HTMLElement {
  const srcs = pickSrcs(rec, avifSupported);
  if (!srcs) {
    // Shouldn't happen for a well-formed catalog, but be safe.
    const span = document.createElement('span');
    span.textContent = rec.name;
    return span;
  }
  const img = document.createElement('img');
  img.className = 'ytce-emote';
  // No referrer to the 7TV CDN — otherwise every emote fetch leaks the full
  // YouTube watch URL (including video ID and any query params) cross-origin.
  img.referrerPolicy = 'no-referrer';
  img.src = srcs.src;
  if (srcs.srcset) img.srcset = srcs.srcset;
  img.alt = rec.name;
  img.title = rec.name;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.draggable = false;
  return img;
}

/**
 * Wrap an emote for display *inside the chat input* (not in chat output).
 *
 * Returns a `contenteditable=false` span containing the emote image. The
 * image's `alt` attribute holds the colon-wrapped shortcode `:NAME:`, which
 * is what YouTube's send pipeline extracts for the outgoing message — this
 * matches how YouTube renders its own custom emojis (`<img alt=":foo:">`).
 *
 * Earlier v0.3.0 used a visually-hidden text span instead of `alt`, on the
 * assumption that YouTube would read textContent / innerText. It doesn't:
 * sending dropped the emote when it sat between other text. Switching to
 * `alt` makes serialisation match YouTube's own conventions.
 *
 * Visually the user sees only the emote image. The wrapper acts as a single
 * editing unit (Backspace deletes it whole) thanks to ce=false.
 */
export function buildEmoteInputWrapper(rec: EmoteRecord, sizePx: number): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'ytce-input-emote';
  wrapper.contentEditable = 'false';
  wrapper.dataset.name = rec.name;

  const img = buildEmoteImage(rec, sizePx);
  if (img instanceof HTMLImageElement) {
    // YouTube reads img.alt when serialising the input on send, so this is
    // what hits chat. The chat-side renderer then turns `:NAME:` back into
    // an emote image.
    img.alt = `:${rec.name}:`;
  }
  wrapper.appendChild(img);

  return wrapper;
}

/**
 * Walk the message body's text nodes and replace matching shortcodes with
 * <img> elements. Leaves other inline elements (emoji, badges) alone.
 */
export function processMessage(el: HTMLElement, catalog: EmoteCatalog, sizePx: number): void {
  // Super Chats etc. have custom layout — don't touch them in v1.
  if (el.matches(SELECTORS.paidMessageRenderer)) return;

  const body = el.querySelector<HTMLElement>(SELECTORS.messageBody);
  if (!body) return;

  // Collect text nodes first to avoid mutating the tree mid-walk.
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let n: Node | null = walker.nextNode();
  while (n) {
    textNodes.push(n as Text);
    n = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? '';
    if (!text.trim()) continue;

    // Don't tokenize inside auto-linkified URLs (`https://foo.com/:WW:bar`
    // shouldn't render `WW` mid-URL). YouTube renders detected URLs inside
    // <a> elements, so skipping any text node inside an anchor is enough.
    if (textNode.parentElement?.closest('a')) continue;

    const tokens = tokenize(text, catalog);
    if (tokens.length === 1 && tokens[0]!.type === 'text') continue;

    const frag = document.createDocumentFragment();
    for (const tok of tokens) {
      if (tok.type === 'text') {
        frag.appendChild(document.createTextNode(tok.value));
      } else {
        frag.appendChild(buildEmoteImage(tok.record, sizePx));
      }
    }
    textNode.parentNode?.replaceChild(frag, textNode);
  }
}
