import type {
  EmoteCatalog,
  EmoteFormat,
  EmoteRecord,
  EmoteScale,
  EmoteSrcMap,
  SevenTVEmoteSet,
} from './types';

const SEVENTV_API = 'https://7tv.io/v3';

/** Hard timeout for the catalog fetch. The SW is short-lived; don't wedge it. */
const FETCH_TIMEOUT_MS = 10_000;

/** Reject responses claiming a body larger than this. Real catalogs are well under 1 MB. */
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function fetchEmoteSet(setId: string): Promise<SevenTVEmoteSet> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SEVENTV_API}/emote-sets/${encodeURIComponent(setId)}`, {
      signal: ctrl.signal,
      // Cross-origin fetch with no credentials. Default for cross-origin is
      // already 'same-origin' (= no creds sent), but state it explicitly so
      // the contract is visible.
      credentials: 'omit',
      // We don't need to follow redirects to a different host.
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new Error(`7TV API ${res.status} ${res.statusText}`);
    }
    const lenHeader = res.headers.get('content-length');
    if (lenHeader && Number(lenHeader) > MAX_RESPONSE_BYTES) {
      throw new Error(`7TV API response too large: ${lenHeader} bytes`);
    }
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.toLowerCase().includes('application/json')) {
      throw new Error(`7TV API returned unexpected content-type: ${ct}`);
    }
    return (await res.json()) as SevenTVEmoteSet;
  } finally {
    clearTimeout(timer);
  }
}

const FILE_NAME_RE = /^([1-4])x\.(webp|avif|gif|png)$/i;

/**
 * Hosts we are willing to load emote images from. The 7TV API is an upstream
 * trust boundary: it tells us where the images live, but we don't blindly
 * trust the URLs — a compromised or spoofed response could otherwise inject
 * arbitrary outbound requests from the chat origin (referrer leak, IP probe,
 * mixed-content downgrade).
 */
const ALLOWED_CDN_HOSTS = new Set(['cdn.7tv.app']);

/**
 * Normalise a URL fragment from the 7TV API to a fully-qualified https URL,
 * or return null if it doesn't resolve to an allowed CDN host. Accepts the
 * `//cdn.7tv.app/...` protocol-relative form the API often uses.
 */
function safeHostUrl(raw: string): string | null {
  let candidate = raw;
  if (candidate.startsWith('//')) candidate = `https:${candidate}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!ALLOWED_CDN_HOSTS.has(url.host)) return null;
  // Strip trailing slash for predictable concatenation downstream.
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export function normalizeEmoteSet(set: SevenTVEmoteSet): EmoteCatalog {
  const records: EmoteRecord[] = [];

  for (const active of set.emotes ?? []) {
    const data = active.data;
    if (!data?.host?.files?.length) continue;

    const hostUrl = safeHostUrl(data.host.url);
    if (!hostUrl) continue;

    const files: Partial<Record<EmoteFormat, EmoteSrcMap>> = {};
    for (const f of data.host.files) {
      const m = FILE_NAME_RE.exec(f.name);
      if (!m) continue;
      const scale = `${m[1]}x` as EmoteScale;
      const fmt = m[2]!.toLowerCase() as 'webp' | 'avif' | 'gif' | 'png';
      if (fmt !== 'webp' && fmt !== 'avif') continue;
      const bucket = (files[fmt] ??= {});
      bucket[scale] = `${hostUrl}/${f.name}`;
    }

    if (!files.webp && !files.avif) continue;

    const name = active.name;
    records.push({
      id: active.id,
      name,
      nameLower: name.toLowerCase(),
      animated: !!data.animated,
      // 7TV flag bit with value 1 means zero-width.
      zeroWidth: (data.flags & 1) === 1,
      files,
    });
  }

  const byName: Record<string, EmoteRecord> = {};
  const byLower: Record<string, EmoteRecord> = {};
  for (const r of records) {
    byName[r.name] = r;
    // First occurrence wins on lowercase collision (extremely rare in one set).
    if (!byLower[r.nameLower]) byLower[r.nameLower] = r;
  }

  return {
    setId: set.id,
    setName: set.name,
    emoteCount: records.length,
    records,
    byName,
    byLower,
  };
}
