import type { EmoteCatalog } from './types';

export type Message =
  | { type: 'get_catalog' }
  | { type: 'reload_catalog' }
  | { type: 'catalog_updated'; catalog: EmoteCatalog | null };

export interface CatalogResponse {
  catalog: EmoteCatalog | null;
  error?: string;
}
