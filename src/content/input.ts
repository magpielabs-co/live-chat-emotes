import { SELECTORS } from './selectors';

/** Return the chat contenteditable input, or null if it isn't mounted yet. */
export function getChatInput(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SELECTORS.chatInput);
}

export interface CaretWord {
  word: string;
  /** Offset within `textNode.nodeValue` where the word starts. */
  start: number;
  /** Offset within `textNode.nodeValue` where the word ends (exclusive). */
  end: number;
  textNode: Text;
}

/**
 * Find the whitespace-delimited word that currently contains the caret.
 * Returns null if the selection isn't inside a text node of the input.
 */
export function getWordAtCaret(input: HTMLElement): CaretWord | null {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!input.contains(range.startContainer)) return null;
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;

  const textNode = node as Text;
  const text = textNode.nodeValue ?? '';
  const offset = range.startOffset;

  let start = offset;
  while (start > 0 && !/\s/.test(text[start - 1]!)) start--;
  let end = offset;
  while (end < text.length && !/\s/.test(text[end]!)) end++;

  return { word: text.slice(start, end), start, end, textNode };
}

/**
 * Replace the word at the caret with `replacement`.
 *
 * Implementation note: YouTube's chat input is a Polymer custom element
 * (`yt-live-chat-text-input-field-renderer`) that owns its own text-tracking
 * state. Mutating `textNode.nodeValue` directly is invisible to it — the
 * tracked length stays at 0 (send button stays disabled) and the visible
 * text gets reverted on the next render tick.
 *
 * The reliable way to integrate with editor-frameworks-on-contenteditable
 * is `document.execCommand('insertText', ...)`. It's deprecated, but it's
 * the only API that fires the proper `beforeinput` / `input` event sequence
 * the framework observes. The modern replacement (EditContext) isn't in
 * Chrome stable yet.
 */
export function replaceWordAtCaret(caret: CaretWord, replacement: string): void {
  const sel = document.getSelection();
  if (!sel) return;

  const range = document.createRange();
  range.setStart(caret.textNode, caret.start);
  range.setEnd(caret.textNode, caret.end);
  sel.removeAllRanges();
  sel.addRange(range);

  // Replaces the selected text and fires beforeinput/input for Polymer.
  document.execCommand('insertText', false, replacement);
}

/**
 * Insert `text` at the current caret position inside `input`. Same rationale
 * as `replaceWordAtCaret` — must go through the browser's editing pipeline.
 */
export function insertAtCaret(input: HTMLElement, text: string): void {
  input.focus();

  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0 || !input.contains(sel.anchorNode)) {
    // No (in-input) selection — point the caret at the end of the input first.
    const range = document.createRange();
    range.selectNodeContents(input);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  document.execCommand('insertText', false, text);
}
