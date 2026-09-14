import { describe, expect, it } from "vitest";
import { isAnswerCorrect, normalizeAnswer } from "./answers";

describe("normalizeAnswer", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeAnswer("  der Hund  ")).toBe("der hund");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeAnswer("der   Hund")).toBe("der hund");
  });

  it("lower-cases the answer", () => {
    expect(normalizeAnswer("Der HUND")).toBe("der hund");
  });

  it("keeps diacritics and ß intact", () => {
    expect(normalizeAnswer("Fußball")).toBe("fußball");
    expect(normalizeAnswer("Grün")).toBe("grün");
  });
});

describe("isAnswerCorrect", () => {
  it("accepts an exact match", () => {
    expect(isAnswerCorrect("der Hund", "der Hund")).toBe(true);
  });

  it("ignores case", () => {
    expect(isAnswerCorrect("DER HUND", "der Hund")).toBe(true);
    expect(isAnswerCorrect("fußball", "Fußball")).toBe(true);
  });

  it("ignores leading/trailing whitespace", () => {
    expect(isAnswerCorrect("  die Katze ", "die Katze")).toBe(true);
  });

  it("ignores extra internal whitespace", () => {
    expect(isAnswerCorrect("die   Katze", "die Katze")).toBe(true);
  });

  it("rejects a plain wrong answer", () => {
    expect(isAnswerCorrect("die Katze", "der Hund")).toBe(false);
  });

  it("does not treat 'a' as 'ä'", () => {
    expect(isAnswerCorrect("grun", "grün")).toBe(false);
    expect(isAnswerCorrect("Bar", "Bär")).toBe(false);
  });

  it("does not treat 'ss' as 'ß'", () => {
    expect(isAnswerCorrect("Fussball", "Fußball")).toBe(false);
    expect(isAnswerCorrect("weiss", "weiß")).toBe(false);
  });

  it("does not treat 'ue' as 'ü'", () => {
    expect(isAnswerCorrect("gruen", "grün")).toBe(false);
  });

  it("requires the article when one is configured", () => {
    expect(isAnswerCorrect("Hund", "der Hund")).toBe(false);
  });

  it("handles multi-word phrases", () => {
    expect(isAnswerCorrect("the toilets", "the toilets")).toBe(true);
    expect(isAnswerCorrect("toilets", "the toilets")).toBe(false);
  });
});
