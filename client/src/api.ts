import type { VocabularySet, VocabularySetSummary } from "../../shared/types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
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
