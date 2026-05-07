import type { Message } from '../lib/messages';
import { fetchEmoteSet, normalizeEmoteSet } from '../lib/seventv';
import {
  DEFAULT_SETTINGS,
  getCachedCatalog,
  getSettings,
  setCachedCatalog,
} from '../lib/storage';
import type { EmoteCatalog } from '../lib/types';

let memCatalog: EmoteCatalog | null = null;
let inflight: Promise<EmoteCatalog | null> | null = null;

async function ensureDefaultSettings(): Promise<void> {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (stored[k] === undefined) patch[k] = v;
  }
  if (Object.keys(patch).length > 0) {
    await chrome.storage.local.set(patch);
  }
}

async function loadCatalog(force = false): Promise<EmoteCatalog | null> {
  if (!force && memCatalog) return memCatalog;
  if (inflight) return inflight;

  inflight = (async () => {
    if (!force) {
      const cached = await getCachedCatalog();
      if (cached) {
        memCatalog = cached;
        // Fire-and-forget refresh in the background on warm start.
        void refreshInBackground();
        return cached;
      }
    }
    const { emoteSetId } = await getSettings();
    try {
      const raw = await fetchEmoteSet(emoteSetId);
      const catalog = normalizeEmoteSet(raw);
      memCatalog = catalog;
      await setCachedCatalog(catalog);
      broadcast({ type: 'catalog_updated', catalog });
      if (__DEBUG__) {
        console.debug('[ytce][bg] loaded', catalog.emoteCount, 'emotes from', catalog.setName);
      }
      return catalog;
    } catch (err) {
      console.warn('[ytce][bg] fetch failed', err);
      const cached = await getCachedCatalog();
      if (cached) {
        memCatalog = cached;
        return cached;
      }
      return null;
    }
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

async function refreshInBackground(): Promise<void> {
  try {
    const { emoteSetId } = await getSettings();
    const raw = await fetchEmoteSet(emoteSetId);
    const catalog = normalizeEmoteSet(raw);
    memCatalog = catalog;
    await setCachedCatalog(catalog);
    broadcast({ type: 'catalog_updated', catalog });
    if (__DEBUG__) console.debug('[ytce][bg] background refresh OK');
  } catch (err) {
    if (__DEBUG__) console.debug('[ytce][bg] background refresh failed', err);
  }
}

function broadcast(message: Message): void {
  chrome.tabs.query({ url: '*://www.youtube.com/*' }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          /* tab may not have our content script; ignore */
        });
      }
    }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaultSettings();
  await loadCatalog(true);
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaultSettings();
  await loadCatalog();
});

chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  // Defence in depth: chrome.runtime.onMessage only fires for same-extension
  // senders by default (external messages would need `externally_connectable`
  // in the manifest, which we don't set). Still, reject anything that doesn't
  // come from our own extension to make that contract explicit.
  if (sender.id !== chrome.runtime.id) return false;
  if (msg.type === 'get_catalog') {
    loadCatalog().then((catalog) => sendResponse({ catalog }));
    return true;
  }
  if (msg.type === 'reload_catalog') {
    loadCatalog(true).then((catalog) => sendResponse({ catalog }));
    return true;
  }
  return false;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.emoteSetId) {
    memCatalog = null;
    void loadCatalog(true);
  }
});
