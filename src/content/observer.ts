import { SELECTORS } from './selectors';

export type MessageHandler = (el: HTMLElement) => void;

/**
 * Observe the live-chat message list and invoke `onMessage` for each
 * `yt-live-chat-text-message-renderer` whose body content has changed since
 * we last processed it.
 *
 * Why a fingerprint instead of a `data-processed` flag?
 *   YouTube uses a virtual scroller and recycles message DOM nodes — when a
 *   new message arrives, an existing renderer can have its `#message` body
 *   wholesale-replaced. A simple "processed" attribute leaves the recycled
 *   renderer marked-but-stale, so emotes flash to text as messages scroll.
 *
 * How the fingerprint works:
 *   - `body.textContent` is our source of truth. Before processing, it is the
 *     raw text the user typed (incl. `:NAME:` shortcodes). After processing,
 *     `<img>` nodes have replaced shortcodes — and `<img>` contributes nothing
 *     to `.textContent`, so the post-render textContent differs from the
 *     pre-render one whenever there were emotes.
 *   - We store the post-render fingerprint. The next mutation callback (caused
 *     by our own DOM writes) sees an unchanged fingerprint and skips.
 *   - When YouTube recycles the renderer for a new message, the body content
 *     changes. The fingerprint differs and we re-process. Loop terminated.
 *
 * The iframe often hydrates the message list *after* document_end, so we
 * retry finding the container until it appears.
 */
export function observeChat(onMessage: MessageHandler): () => void {
  let disposed = false;
  let observer: MutationObserver | null = null;
  let bootObserver: MutationObserver | null = null;

  const lastFp = new WeakMap<HTMLElement, string>();

  const processIfChanged = (el: HTMLElement): void => {
    const body = el.querySelector<HTMLElement>(SELECTORS.messageBody);
    if (!body) return;
    const fp = body.textContent ?? '';
    if (lastFp.get(el) === fp) return;

    try {
      onMessage(el);
    } catch (err) {
      if (__DEBUG__) console.debug('[ytce] onMessage threw', err);
    }

    // Update fingerprint to the *post*-processing textContent so the
    // self-triggered mutation that follows is recognised as a no-op.
    lastFp.set(el, body.textContent ?? '');
  };

  /** Find the message renderer ancestor (or self) for any mutation target. */
  const renderersInVicinity = (target: Node): HTMLElement[] => {
    const out: HTMLElement[] = [];
    if (target instanceof Element) {
      const ancestor = target.closest<HTMLElement>(SELECTORS.textMessageRenderer);
      if (ancestor) out.push(ancestor);
    } else if (target.parentElement) {
      const ancestor = target.parentElement.closest<HTMLElement>(SELECTORS.textMessageRenderer);
      if (ancestor) out.push(ancestor);
    }
    return out;
  };

  const start = (): boolean => {
    const list = document.querySelector(SELECTORS.messageList);
    if (!list) return false;

    // Pick up anything already there at mount time.
    list
      .querySelectorAll<HTMLElement>(SELECTORS.textMessageRenderer)
      .forEach(processIfChanged);

    observer = new MutationObserver((mutations) => {
      // Dedupe via a Set so we don't process the same renderer many times
      // per batch of mutations.
      const touched = new Set<HTMLElement>();

      for (const m of mutations) {
        // characterData + subtree childList changes inside an existing renderer
        for (const el of renderersInVicinity(m.target)) touched.add(el);

        // Whole new renderers added to the list (or to a wrapper inside it).
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(SELECTORS.textMessageRenderer)) {
            touched.add(node);
          } else {
            node
              .querySelectorAll<HTMLElement>(SELECTORS.textMessageRenderer)
              .forEach((el) => touched.add(el));
          }
        }
      }

      for (const el of touched) processIfChanged(el);
    });

    observer.observe(list, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    if (__DEBUG__) console.debug('[ytce] chat observer attached');
    return true;
  };

  if (!start()) {
    bootObserver = new MutationObserver(() => {
      if (disposed) return;
      if (start()) {
        bootObserver?.disconnect();
        bootObserver = null;
      }
    });
    bootObserver.observe(document.body, { childList: true, subtree: true });
  }

  return () => {
    disposed = true;
    observer?.disconnect();
    bootObserver?.disconnect();
  };
}
