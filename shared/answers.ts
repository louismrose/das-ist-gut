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
 *   and "ss" does not match "ß".
 */

export function normalizeAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

export function isAnswerCorrect(entered: string, expected: string): boolean {
  return normalizeAnswer(entered) === normalizeAnswer(expected);
}
