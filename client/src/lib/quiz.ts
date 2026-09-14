import type { VocabularyItem } from "../../../shared/types";

export type QuizDirection = "en-to-de" | "de-to-en";
export type QuizMode = QuizDirection | "mixed";

export interface QuizQuestion {
  prompt: string;
  expectedAnswer: string;
  direction: QuizDirection;
}

export const MODE_LABELS: Record<QuizMode, string> = {
  "en-to-de": "English → German",
  "de-to-en": "German → English",
  mixed: "Mixed",
};

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

/** Builds a shuffled quiz over all items. In mixed mode each question gets a random direction. */
export function buildQuiz(
  items: readonly VocabularyItem[],
  mode: QuizMode,
  random: () => number = Math.random,
): QuizQuestion[] {
  return shuffle(items, random).map((item) => {
    const direction: QuizDirection =
      mode === "mixed" ? (random() < 0.5 ? "en-to-de" : "de-to-en") : mode;
    return direction === "en-to-de"
      ? { prompt: item.english, expectedAnswer: item.german, direction }
      : { prompt: item.german, expectedAnswer: item.english, direction };
  });
}
