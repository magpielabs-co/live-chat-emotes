// Raw 7TV API response shapes (partial — only fields we read).
// Docs: https://7tv.io/v3/docs

export interface SevenTVEmoteFile {
  name: string; // e.g. "1x.webp"
  format: 'WEBP' | 'AVIF' | 'GIF' | 'PNG';
  width: number;
  height: number;
}

export interface SevenTVEmoteHost {
  url: string; // e.g. "//cdn.7tv.app/emote/{id}"
  files: SevenTVEmoteFile[];
}

export interface SevenTVEmoteData {
  id: string;
  name: string;
  flags: number; // bit 1 (value 1) = zero-width
  animated: boolean;
  host: SevenTVEmoteHost;
}

export interface SevenTVActiveEmote {
  id: string;
  name: string; // the shortcode as it appears in chat
  flags: number;
  timestamp: number;
  data: SevenTVEmoteData;
}

export interface SevenTVEmoteSet {
  id: string;
  name: string;
  capacity: number;
  emote_count: number;
  emotes: SevenTVActiveEmote[];
}

// Normalized internal form used by the content script.

export type EmoteScale = '1x' | '2x' | '3x' | '4x';
export type EmoteFormat = 'avif' | 'webp';

export type EmoteSrcMap = Partial<Record<EmoteScale, string>>;

export interface EmoteRecord {
  id: string;
  name: string; // exact-case shortcode (what we match for rendering)
  nameLower: string; // for autocomplete / picker search
  animated: boolean;
  zeroWidth: boolean;
  files: Partial<Record<EmoteFormat, EmoteSrcMap>>;
}

export interface EmoteCatalog {
  setId: string;
  setName: string;
  emoteCount: number;
  records: EmoteRecord[]; // iteration order (picker grid)
  byName: Record<string, EmoteRecord>; // exact-case lookup (rendering)
  byLower: Record<string, EmoteRecord>; // lowercased lookup (autocomplete)
}
