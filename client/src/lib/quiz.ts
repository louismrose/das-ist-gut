import type { VocabularyItem } from "../../../shared/types";

export type QuizMode = "en-to-de" | "de-to-en" | "audio-to-de" | "audio-to-en";

export interface QuizQuestion {
  mode: QuizMode;
  /** The word shown to the learner — or, in audio modes, spoken aloud (always German there). */
  prompt: string;
  expectedAnswer: string;
}

export const MODE_LABELS: Record<QuizMode, string> = {
  "en-to-de": "English → German",
  "de-to-en": "German → English",
  "audio-to-de": "Listen → German",
  "audio-to-en": "Listen → English",
};

/** Compact emoji version of MODE_LABELS for the mode buttons. */
export const MODE_ICONS: Record<QuizMode, string> = {
  "en-to-de": "🇬🇧 → 🇩🇪",
  "de-to-en": "🇩🇪 → 🇬🇧",
  "audio-to-de": "🔈 → 🇩🇪",
  "audio-to-en": "🔈 → 🇬🇧",
};

/** Audio modes speak the German word aloud instead of showing a written prompt. */
export function isAudioMode(mode: QuizMode): boolean {
  return mode === "audio-to-de" || mode === "audio-to-en";
}

/** The language the learner types their answer in. */
export function answerLanguage(mode: QuizMode): "de" | "en" {
  return mode === "en-to-de" || mode === "audio-to-de" ? "de" : "en";
}

/** Fisher–Yates shuffle. Returns a new array; `random` is injectable for tests. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

/** Builds a shuffled quiz over all items for the given mode. */
export function buildQuiz(
  items: readonly VocabularyItem[],
  mode: QuizMode,
  random: () => number = Math.random,
): QuizQuestion[] {
  return shuffle(items, random).map((item) => ({
    mode,
    prompt: mode === "en-to-de" ? item.english : item.german,
    expectedAnswer: answerLanguage(mode) === "de" ? item.german : item.english,
  }));
}
