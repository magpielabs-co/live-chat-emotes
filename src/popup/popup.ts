import type { CatalogResponse } from '../lib/messages';
import { DEFAULT_SETTINGS, getSettings, setSettings } from '../lib/storage';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

type StatusKind = 'ok' | 'warn' | 'err' | 'info';

const SIZE_MIN = 16;
const SIZE_MAX = 48;

function setStatus(text: string, kind: StatusKind): void {
  const el = $('status');
  el.textContent = text;
  el.className = `status ${kind}`;
}

function clampSize(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.emoteSize;
  return Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(n)));
}

async function applyCatalogStatus(reloading = false): Promise<void> {
  if (reloading) setStatus('Reloading…', 'info');
  try {
    const resp = (await chrome.runtime.sendMessage(
      reloading ? { type: 'reload_catalog' } : { type: 'get_catalog' },
    )) as CatalogResponse | undefined;
    const catalog = resp?.catalog ?? null;
    if (catalog) {
      setStatus(`Loaded "${catalog.setName}" — ${catalog.emoteCount} emotes`, 'ok');
    } else {
      setStatus('No emotes loaded', 'warn');
    }
  } catch (err) {
    setStatus(`Failed: ${(err as Error).message}`, 'err');
  }
}

/** Reflect a size value across all three UI surfaces (range, number, readout). */
function paintSize(sizePx: number): void {
  $<HTMLInputElement>('size').value = String(sizePx);
  $<HTMLInputElement>('sizeRange').value = String(sizePx);
  $('sizeValue').textContent = String(sizePx);
}

async function render(): Promise<void> {
  const s = await getSettings();
  $<HTMLInputElement>('setId').value = s.emoteSetId;
  paintSize(clampSize(s.emoteSize));
  $<HTMLInputElement>('enabled').checked = s.enabled;
  $<HTMLInputElement>('autocomplete').checked = s.autocompleteEnabled;
  await applyCatalogStatus();
}

// --- Set ID ---

$<HTMLInputElement>('setId').addEventListener('change', async (e) => {
  const value = (e.target as HTMLInputElement).value.trim();
  if (!value) return;
  await setSettings({ emoteSetId: value });
  // Storage listener in the background will refetch; reflect status when it finishes.
  setStatus('Loading new set…', 'info');
  // Poll briefly for the update (background might still be fetching).
  setTimeout(() => void applyCatalogStatus(), 800);
});

// --- Size: number + range stay in sync, save on every change ---

let lastSavedSize = -1;

async function commitSize(raw: number): Promise<void> {
  const n = clampSize(raw);
  paintSize(n);
  if (n === lastSavedSize) return;
  lastSavedSize = n;
  await setSettings({ emoteSize: n });
}

// `input` (not `change`) so the slider drag and each typed digit feels live.
$<HTMLInputElement>('sizeRange').addEventListener('input', (e) => {
  void commitSize(Number((e.target as HTMLInputElement).value));
});

$<HTMLInputElement>('size').addEventListener('input', (e) => {
  // Don't clamp on every keystroke — the user might be mid-typing "32" and
  // pass through "3" first. Just mirror to the slider/readout if the value
  // is currently in range; the final clamp happens on `change` (blur/Enter).
  const v = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(v) && v >= SIZE_MIN && v <= SIZE_MAX) {
    $<HTMLInputElement>('sizeRange').value = String(v);
    $('sizeValue').textContent = String(v);
    void commitSize(v);
  }
});

$<HTMLInputElement>('size').addEventListener('change', (e) => {
  // On blur / Enter, force a clamp so out-of-range values get corrected
  // visibly rather than silently rejected.
  void commitSize(Number((e.target as HTMLInputElement).value));
});

// --- Toggles ---

$<HTMLInputElement>('enabled').addEventListener('change', async (e) => {
  await setSettings({ enabled: (e.target as HTMLInputElement).checked });
});

$<HTMLInputElement>('autocomplete').addEventListener('change', async (e) => {
  await setSettings({ autocompleteEnabled: (e.target as HTMLInputElement).checked });
});

$('reload').addEventListener('click', () => void applyCatalogStatus(true));

void render();
