// Content script for the YouTube live chat iframe.
//
// Wires up: catalog loading (via service worker) → MutationObserver →
// tokenizer/renderer → autocomplete → picker.

import { attachAutocomplete } from './autocomplete';
import { observeChat } from './observer';
import { attachPicker } from './picker';
import { processMessage } from './renderer';
import type { CatalogResponse, Message } from '../lib/messages';
import { DEFAULT_SETTINGS, getSettings, type Settings } from '../lib/storage';
import type { EmoteCatalog } from '../lib/types';
import './chat.css';

let catalog: EmoteCatalog | null = null;
let settings: Settings | null = null;

/**
 * Push the current emote size to the `--ytce-emote-size` CSS variable on the
 * document root. The chat.css `.ytce-emote { height: var(...) }` rule reads
 * from here, so a single write resizes every rendered emote (including
 * in-input wrappers) without touching the DOM.
 */
function applyEmoteSize(sizePx: number): void {
  // Guard against tampered storage — clamp to the same range the popup enforces.
  const safe = Math.max(16, Math.min(48, Math.round(sizePx)));
  document.documentElement.style.setProperty('--ytce-emote-size', `${safe}px`);
}

async function requestCatalog(): Promise<EmoteCatalog | null> {
  try {
    const resp = (await chrome.runtime.sendMessage({ type: 'get_catalog' })) as
      | CatalogResponse
      | undefined;
    return resp?.catalog ?? null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  settings = await getSettings();
  if (!settings.enabled) {
    if (__DEBUG__) console.debug('[ytce] disabled in settings');
    return;
  }
  applyEmoteSize(settings.emoteSize);

  catalog = await requestCatalog();
  if (__DEBUG__) {
    if (catalog) {
      console.debug(`[ytce] catalog ready: ${catalog.setName} (${catalog.emoteCount} emotes)`);
    } else {
      console.debug('[ytce] no catalog yet; messages will render plain until one arrives');
    }
  }

  observeChat((el) => {
    if (!catalog || !settings) return;
    processMessage(el, catalog, settings.emoteSize);
  });

  const getEmoteSize = (): number => settings?.emoteSize ?? DEFAULT_SETTINGS.emoteSize;
  if (settings.autocompleteEnabled) {
    attachAutocomplete(() => catalog, getEmoteSize);
  }
  attachPicker(() => catalog, getEmoteSize);
}

// React to catalog updates broadcast from the service worker.
chrome.runtime.onMessage.addListener((msg: Message, sender) => {
  // Only trust messages from our own extension (i.e. our SW).
  if (sender.id !== chrome.runtime.id) return;
  if (msg.type === 'catalog_updated') {
    catalog = msg.catalog;
    if (__DEBUG__) {
      console.debug(
        '[ytce] catalog updated',
        catalog ? `${catalog.setName} (${catalog.emoteCount})` : 'null',
      );
    }
  }
});

// React to settings changes so the user doesn't have to refresh the tab.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled || changes.emoteSize) {
    settings = await getSettings();
    if (changes.emoteSize) applyEmoteSize(settings.emoteSize);
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void main());
} else {
  void main();
}
