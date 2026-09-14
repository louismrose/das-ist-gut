import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { VocabularySet } from "../../shared/types";
import { isAnswerCorrect } from "../../shared/answers";
import { fetchSet } from "./api";
import { buildQuiz, MODE_LABELS, type QuizMode, type QuizQuestion } from "./lib/quiz";

interface QuizScreenProps {
  setId: string;
  mode: QuizMode;
  onExit: () => void;
}

interface QuestionResult {
  question: QuizQuestion;
  entered: string;
  correct: boolean;
}

/** Characters that are awkward to type on a non-German keyboard. */
const GERMAN_CHARS = ["ä", "ö", "ü", "ß"];

export function QuizScreen({ setId, mode, onExit }: QuizScreenProps) {
  const [set, setSet] = useState<VocabularySet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [entered, setEntered] = useState("");
  const [checked, setChecked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSet(setId)
      .then((loaded) => {
        if (cancelled) return;
        setSet(loaded);
        setQuestions(buildQuiz(loaded.items, mode));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [setId, mode]);

  function restart() {
    if (set === null) return;
    setQuestions(buildQuiz(set.items, mode));
    setIndex(0);
    setResults([]);
    setEntered("");
    setChecked(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const question = questions[index];
    if (!question) return;
    if (!checked) {
      setResults((previous) => [
        ...previous,
        { question, entered, correct: isAnswerCorrect(entered, question.expectedAnswer) },
      ]);
      setChecked(true);
    } else {
      setChecked(false);
      setEntered("");
      setIndex((previous) => previous + 1);
      inputRef.current?.focus();
    }
  }

  /** Inserts ä/ö/ü/ß at the caret without losing focus. */
  function insertCharacter(character: string) {
    const input = inputRef.current;
    if (input === null || checked) return;
    const start = input.selectionStart ?? entered.length;
    const end = input.selectionEnd ?? entered.length;
    setEntered(entered.slice(0, start) + character + entered.slice(end));
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + 1, start + 1);
    });
  }

  if (error !== null) {
    return (
      <div className="card">
        <p className="status status-error">Could not load this set: {error}</p>
        <button type="button" onClick={onExit}>
          Back to sets
        </button>
      </div>
    );
  }
  if (set === null || questions.length === 0) {
    return <p className="status">Loading quiz…</p>;
  }

  if (index >= questions.length) {
    return <QuizSummary setName={set.name} results={results} onRetry={restart} onExit={onExit} />;
  }

  const question = questions[index]!;
  const lastResult = checked ? results[results.length - 1] : undefined;
  const promptLanguage = question.direction === "en-to-de" ? "English" : "German";
  const answerLanguage = question.direction === "en-to-de" ? "German" : "English";

  return (
    <div className="card quiz-card">
      <div className="quiz-header">
        <button type="button" className="link-button" onClick={onExit}>
          ← Sets
        </button>
        <span className="quiz-title">
          {set.name} · {MODE_LABELS[mode]}
        </span>
        <span className="progress">
          {index + 1} / {questions.length}
        </span>
      </div>

      <p className="prompt-label">
        Translate this {promptLanguage} word into {answerLanguage}:
      </p>
      <p className="prompt" lang={question.direction === "en-to-de" ? "en" : "de"}>
        {question.prompt}
      </p>

      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="answer-input"
          type="text"
          value={entered}
          onChange={(event) => setEntered(event.target.value)}
          readOnly={checked}
          placeholder={`Type the ${answerLanguage} answer…`}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          lang={question.direction === "en-to-de" ? "de" : "en"}
          aria-label={`${answerLanguage} answer`}
        />

        {!checked && question.direction === "en-to-de" && (
          <div className="char-buttons" aria-label="German characters">
            {GERMAN_CHARS.map((character) => (
              <button key={character} type="button" onClick={() => insertCharacter(character)}>
                {character}
              </button>
            ))}
          </div>
        )}

        {lastResult &&
          (lastResult.correct ? (
            <p className="feedback feedback-correct">✓ Richtig!</p>
          ) : (
            <p className="feedback feedback-incorrect">
              ✗ Not quite. The correct answer is{" "}
              <strong lang={question.direction === "en-to-de" ? "de" : "en"}>
                {question.expectedAnswer}
              </strong>
              .
            </p>
          ))}

        <button type="submit" className="primary submit-button">
          {checked ? (index + 1 < questions.length ? "Next question" : "See results") : "Check"}
        </button>
      </form>
    </div>
  );
}

interface QuizSummaryProps {
  setName: string;
  results: QuestionResult[];
  onRetry: () => void;
  onExit: () => void;
}

function QuizSummary({ setName, results, onRetry, onExit }: QuizSummaryProps) {
  const correct = results.filter((result) => result.correct).length;
  const incorrect = results.filter((result) => !result.correct);
  const percentage = results.length === 0 ? 0 : Math.round((correct / results.length) * 100);

  return (
    <div className="card summary-card">
      <h2>Finished: {setName}</h2>
      <div className="summary-stats">
        <div className="stat">
          <span className="stat-value">{correct}</span>
          <span className="stat-label">correct</span>
        </div>
        <div className="stat">
          <span className="stat-value">{incorrect.length}</span>
          <span className="stat-label">incorrect</span>
        </div>
        <div className="stat">
          <span className="stat-value">{percentage}%</span>
          <span className="stat-label">score</span>
        </div>
      </div>

      {incorrect.length > 0 && (
        <div className="review">
          <h3>Words to review</h3>
          <ul className="review-list">
            {incorrect.map((result, reviewIndex) => (
              <li key={reviewIndex}>
                <span className="review-prompt">{result.question.prompt}</span>
                <span className="review-answer">{result.question.expectedAnswer}</span>
                {result.entered.trim() !== "" && (
                  <span className="review-entered">you wrote: {result.entered}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="summary-buttons">
        <button type="button" className="primary" onClick={onRetry}>
          Try this set again
        </button>
        <button type="button" onClick={onExit}>
          Back to sets
        </button>
      </div>
    </div>
  );
}
