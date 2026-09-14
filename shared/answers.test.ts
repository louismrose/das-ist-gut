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

describe("isAnswerCorrect with numbers", () => {
  it("accepts digits for an English number word and vice versa", () => {
    expect(isAnswerCorrect("8", "eight", "en")).toBe(true);
    expect(isAnswerCorrect("thirteen", "13", "en")).toBe(true);
    expect(isAnswerCorrect("Twenty", "20", "en")).toBe(true);
  });

  it("accepts digits for a German number word and vice versa", () => {
    expect(isAnswerCorrect("8", "acht", "de")).toBe(true);
    expect(isAnswerCorrect("fünfzehn", "15", "de")).toBe(true);
    expect(isAnswerCorrect("dreißig", "30", "de")).toBe(true);
  });

  it("does not accept a number word from the wrong language", () => {
    expect(isAnswerCorrect("dreizehn", "13", "en")).toBe(false);
    expect(isAnswerCorrect("acht", "eight", "en")).toBe(false);
    expect(isAnswerCorrect("eight", "acht", "de")).toBe(false);
  });

  it("still requires correct German number spelling", () => {
    expect(isAnswerCorrect("funfzehn", "fünfzehn", "de")).toBe(false);
    expect(isAnswerCorrect("dreissig", "dreißig", "de")).toBe(false);
  });

  it("rejects the wrong number", () => {
    expect(isAnswerCorrect("9", "eight", "en")).toBe(false);
    expect(isAnswerCorrect("nine", "8", "en")).toBe(false);
  });

  it("only applies to whole answers, not numbers inside phrases", () => {
    expect(isAnswerCorrect("8 ball", "eight ball", "en")).toBe(false);
  });

  it("does not apply number equivalence without a language", () => {
    expect(isAnswerCorrect("8", "eight")).toBe(false);
  });
});
