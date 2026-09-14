/**
 * Types shared between the Express API and the React frontend.
 */

export interface VocabularyItem {
  english: string;
  german: string;
}

/** Set metadata, as returned by `GET /api/sets`. */
export interface VocabularySetSummary {
  id: string;
  name: string;
  itemCount: number;
}

/** A full set including its items, as returned by `GET /api/sets/:id`. */
export interface VocabularySet {
  id: string;
  name: string;
  items: VocabularyItem[];
}
