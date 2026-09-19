import type { CurrentSession, VocabularySet, VocabularySetSummary } from "../../shared/types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (response.status === 401) {
    // The session has expired. Only a full page load can be redirected to the
    // identity provider, so reload and let the server send us through login.
    window.location.reload();
  }
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchSets(): Promise<VocabularySetSummary[]> {
  return fetchJson<VocabularySetSummary[]>("/api/sets");
}

export function fetchSet(id: string): Promise<VocabularySet> {
  return fetchJson<VocabularySet>(`/api/sets/${encodeURIComponent(id)}`);
}

/** Who is signed in, and how to log out. */
export function fetchSession(): Promise<CurrentSession> {
  return fetchJson<CurrentSession>("/api/me");
}

/** The deployed version (git commit SHA, or "dev" outside Docker). */
export async function fetchVersion(): Promise<string> {
  const { version } = await fetchJson<{ version: string }>("/api/version");
  return version;
}
