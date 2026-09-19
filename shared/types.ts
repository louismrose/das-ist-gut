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

/** The signed-in user. */
export interface CurrentUser {
  /** Stable unique identifier: the OIDC `sub` claim. */
  id: string;
  name: string;
  email?: string;
}

/** The browser's authenticated session, as returned by `GET /api/me`. */
export interface CurrentSession {
  user: CurrentUser;
  /** Where to send the browser to log out, or null when authentication is disabled. */
  logoutUrl: string | null;
}
