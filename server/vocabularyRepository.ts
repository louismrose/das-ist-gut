import type { VocabularySet, VocabularySetSummary } from "../shared/types.js";

/**
 * Abstraction over vocabulary storage.
 *
 * The rest of the application only depends on this interface, so the
 * config-file implementation can later be swapped for e.g. SQLite without
 * touching the API routes or the frontend.
 */
export interface VocabularyRepository {
  getSets(): Promise<VocabularySetSummary[]>;
  getSet(id: string): Promise<VocabularySet | null>;
}
