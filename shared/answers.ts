/**
 * Answer comparison for quiz responses.
 *
 * Kept deliberately isolated so the matching rules can be changed in one place
 * (e.g. accepting answers with or without articles, or tolerating punctuation).
 *
 * Current rules:
 * - leading/trailing whitespace is ignored;
 * - runs of internal whitespace collapse to a single space;
 * - comparison is case-insensitive;
 * - German spelling is otherwise significant: "a" does not match "ä",
 *   and "ss" does not match "ß";
 * - an answer that is entirely a number may be written as digits or as the
 *   number word in the answer's language ("8" ↔ "eight", or "8" ↔ "acht"
 *   for German answers). Covers 0–20, the tens, and 100 — deliberately a
 *   lookup table, not a numeral parser.
 */

export type AnswerLanguage = "en" | "de";

export function normalizeAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

const NUMBER_WORDS: Record<AnswerLanguage, Record<string, number>> = {
  en: {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
    hundred: 100,
    "one hundred": 100,
    "a hundred": 100,
  },
  de: {
    null: 0,
    eins: 1,
    zwei: 2,
    drei: 3,
    vier: 4,
    fünf: 5,
    sechs: 6,
    sieben: 7,
    acht: 8,
    neun: 9,
    zehn: 10,
    elf: 11,
    zwölf: 12,
    dreizehn: 13,
    vierzehn: 14,
    fünfzehn: 15,
    sechzehn: 16,
    siebzehn: 17,
    achtzehn: 18,
    neunzehn: 19,
    zwanzig: 20,
    dreißig: 30,
    vierzig: 40,
    fünfzig: 50,
    sechzig: 60,
    siebzig: 70,
    achtzig: 80,
    neunzig: 90,
    hundert: 100,
    einhundert: 100,
  },
};

/** Numeric value of a whole normalized answer written as digits or a number word, else null. */
function numericValue(normalized: string, language: AnswerLanguage): number | null {
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return NUMBER_WORDS[language][normalized] ?? null;
}

/**
 * Whether an entered answer matches the expected one. When `language` (the
 * language the answer should be in) is given, digits and number words of that
 * language are interchangeable; without it, only literal matching applies.
 */
export function isAnswerCorrect(
  entered: string,
  expected: string,
  language?: AnswerLanguage,
): boolean {
  const normalizedEntered = normalizeAnswer(entered);
  const normalizedExpected = normalizeAnswer(expected);
  if (normalizedEntered === normalizedExpected) return true;
  if (language === undefined) return false;
  const enteredNumber = numericValue(normalizedEntered, language);
  const expectedNumber = numericValue(normalizedExpected, language);
  return enteredNumber !== null && enteredNumber === expectedNumber;
}
