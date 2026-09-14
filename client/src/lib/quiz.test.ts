import { describe, expect, it } from "vitest";
import type { VocabularyItem } from "../../../shared/types";
import { buildQuiz, shuffle } from "./quiz";

const items: VocabularyItem[] = [
  { english: "dog", german: "der Hund" },
  { english: "cat", german: "die Katze" },
  { english: "red", german: "rot" },
  { english: "green", german: "grün" },
];

/** Deterministic stand-in for Math.random. */
function fakeRandom(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("shuffle", () => {
  it("returns a permutation of the input", () => {
    const shuffled = shuffle(items);
    expect(shuffled).toHaveLength(items.length);
    expect(new Set(shuffled)).toEqual(new Set(items));
  });

  it("does not mutate the input", () => {
    const copy = [...items];
    shuffle(items);
    expect(items).toEqual(copy);
  });

  it("is deterministic for a fixed random source", () => {
    const a = shuffle(items, fakeRandom([0.1, 0.5, 0.9]));
    const b = shuffle(items, fakeRandom([0.1, 0.5, 0.9]));
    expect(a).toEqual(b);
  });
});

describe("buildQuiz", () => {
  it("asks every item exactly once", () => {
    const quiz = buildQuiz(items, "en-to-de");
    expect(quiz).toHaveLength(items.length);
    expect(new Set(quiz.map((q) => q.prompt))).toEqual(new Set(items.map((i) => i.english)));
  });

  it("prompts in English and expects German for en-to-de", () => {
    for (const question of buildQuiz(items, "en-to-de")) {
      const item = items.find((i) => i.english === question.prompt);
      expect(item).toBeDefined();
      expect(question.expectedAnswer).toBe(item?.german);
      expect(question.direction).toBe("en-to-de");
    }
  });

  it("prompts in German and expects English for de-to-en", () => {
    for (const question of buildQuiz(items, "de-to-en")) {
      const item = items.find((i) => i.german === question.prompt);
      expect(item).toBeDefined();
      expect(question.expectedAnswer).toBe(item?.english);
      expect(question.direction).toBe("de-to-en");
    }
  });

  it("uses both directions in mixed mode", () => {
    // 0.9 → j stays put during shuffle; alternating direction draws below/above 0.5.
    const quiz = buildQuiz(items, "mixed", fakeRandom([0.9, 0.1, 0.9, 0.6]));
    const directions = new Set(quiz.map((q) => q.direction));
    expect(directions).toEqual(new Set(["en-to-de", "de-to-en"]));
    for (const question of quiz) {
      const pair =
        question.direction === "en-to-de"
          ? items.find((i) => i.english === question.prompt)?.german
          : items.find((i) => i.german === question.prompt)?.english;
      expect(question.expectedAnswer).toBe(pair);
    }
  });
});
