import type { EmoteCatalog } from './types';

// Default emote set loaded on first install. User can override in the popup.
export const DEFAULT_EMOTE_SET_ID = '01JF67B2AKMAFGCW334QYN9P4N';

export interface Settings {
  emoteSetId: string;
  emoteSize: number; // rendered height in px
  autocompleteEnabled: boolean;
  enabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  emoteSetId: DEFAULT_EMOTE_SET_ID,
  emoteSize: 19,
  autocompleteEnabled: true,
  enabled: true,
};

export async function getSettings(): Promise<Settings> {
  const raw = await chrome.storage.local.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>);
  return {
    emoteSetId: String(raw.emoteSetId ?? DEFAULT_SETTINGS.emoteSetId),
    emoteSize: Number(raw.emoteSize ?? DEFAULT_SETTINGS.emoteSize),
    autocompleteEnabled: Boolean(raw.autocompleteEnabled ?? DEFAULT_SETTINGS.autocompleteEnabled),
    enabled: Boolean(raw.enabled ?? DEFAULT_SETTINGS.enabled),
  };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(patch as Record<string, unknown>);
}

const CATALOG_KEY = 'catalog';

export async function getCachedCatalog(): Promise<EmoteCatalog | null> {
  const res = await chrome.storage.local.get(CATALOG_KEY);
  return (res[CATALOG_KEY] as EmoteCatalog | undefined) ?? null;
}

export async function setCachedCatalog(catalog: EmoteCatalog | null): Promise<void> {
  if (catalog === null) {
    await chrome.storage.local.remove(CATALOG_KEY);
  } else {
    await chrome.storage.local.set({ [CATALOG_KEY]: catalog });
  }
}
