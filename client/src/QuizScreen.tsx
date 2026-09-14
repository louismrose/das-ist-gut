import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { flushSync } from "react-dom";
import type { VocabularySet } from "../../shared/types";
import { isAnswerCorrect } from "../../shared/answers";
import { fetchSet } from "./api";
import {
  answerLanguage,
  buildQuiz,
  isAudioMode,
  MODE_LABELS,
  type QuizMode,
  type QuizQuestion,
} from "./lib/quiz";
import { speakGerman, speechSupported } from "./lib/speech";

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

type AnswerPhase = "answering" | "correct" | "incorrect";

/** Short German praise shown for a correct answer. */
const PRAISE = [
  "Richtig!",
  "Super!",
  "Toll!",
  "Prima!",
  "Klasse!",
  "Spitze!",
  "Genau!",
  "Wunderbar!",
  "Sehr gut!",
];
const PRAISE_EMOJI = ["🎉", "⭐", "🌟", "🎊", "✨", "🚀", "💪"];

/** How long the celebration shows before auto-advancing to the next question. */
const CELEBRATION_MS = 1200;

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)]!;
}

const PROMPT_LABELS: Record<QuizMode, string> = {
  "en-to-de": "Translate this English word into German:",
  "de-to-en": "Translate this German word into English:",
  "audio-to-de": "Listen, then type the German word you hear:",
  "audio-to-en": "Listen, then type the English translation:",
};

export function QuizScreen({ setId, mode, onExit }: QuizScreenProps) {
  const [set, setSet] = useState<VocabularySet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [entered, setEntered] = useState("");
  const [phase, setPhase] = useState<AnswerPhase>("answering");
  const [praise, setPraise] = useState("");
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

  // Speak each new audio question. Browsers may block the very first
  // utterance outside a tap; the play button below always works.
  useEffect(() => {
    const current = questions[index];
    if (current && isAudioMode(current.mode)) {
      speakGerman(current.prompt);
    }
  }, [questions, index]);

  // Auto-advance once the celebration for a correct answer has played. The
  // input stays editable and focused throughout, so the mobile keyboard
  // survives the transition without any focus tricks.
  useEffect(() => {
    if (phase !== "correct") return;
    const timer = setTimeout(() => {
      setEntered("");
      setIndex((previous) => previous + 1);
      setPhase("answering");
    }, CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  function restart() {
    if (set === null) return;
    setQuestions(buildQuiz(set.items, mode));
    setIndex(0);
    setResults([]);
    setEntered("");
    setPhase("answering");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const question = questions[index];
    if (!question) return;
    if (phase === "answering") {
      // `required` on the input blocks empty submissions; this also blocks
      // whitespace-only ones.
      if (entered.trim() === "") return;
      const correct = isAnswerCorrect(
        entered,
        question.expectedAnswer,
        answerLanguage(question.mode),
      );
      setResults((previous) => [...previous, { question, entered, correct }]);
      if (correct) {
        setPraise(`${pick(PRAISE_EMOJI)} ${pick(PRAISE)}`);
        setPhase("correct");
      } else {
        setPhase("incorrect");
      }
    } else if (phase === "correct") {
      // Enter (or the button) skips the celebration delay.
      setEntered("");
      setIndex((previous) => previous + 1);
      setPhase("answering");
    } else {
      // Flush synchronously so readOnly is removed from the DOM before the
      // focus call below — iOS only shows the keyboard when an editable input
      // is focused inside the user gesture. The blur forces a fresh focus
      // event even if the input never lost DOM focus.
      flushSync(() => {
        setEntered("");
        setIndex((previous) => previous + 1);
        setPhase("answering");
      });
      const input = inputRef.current;
      if (input) {
        input.blur();
        input.focus();
      }
    }
  }

  /** Inserts ä/ö/ü/ß at the caret without losing focus. */
  function insertCharacter(character: string) {
    const input = inputRef.current;
    if (input === null || phase !== "answering") return;
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
  const answerLang = answerLanguage(question.mode);
  const answerLanguageName = answerLang === "de" ? "German" : "English";

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

      <p className="prompt-label">{PROMPT_LABELS[question.mode]}</p>
      {isAudioMode(question.mode) ? (
        <div className="audio-prompt">
          <button
            type="button"
            className="play-button"
            onClick={() => speakGerman(question.prompt)}
          >
            🔊 Play word
          </button>
        </div>
      ) : (
        <p className="prompt" lang={question.mode === "en-to-de" ? "en" : "de"}>
          {question.prompt}
          {question.mode === "de-to-en" && <SpeakerButton text={question.prompt} />}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="answer-input"
          type="text"
          value={entered}
          onChange={(event) => setEntered(event.target.value)}
          readOnly={phase === "incorrect"}
          required={phase === "answering"}
          placeholder={`Type the ${answerLanguageName} answer…`}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          lang={answerLang}
          aria-label={`${answerLanguageName} answer`}
        />

        {phase === "answering" && answerLang === "de" && (
          <div className="char-buttons" aria-label="German characters">
            {GERMAN_CHARS.map((character) => (
              <button key={character} type="button" onClick={() => insertCharacter(character)}>
                {character}
              </button>
            ))}
          </div>
        )}

        {phase !== "answering" && question.mode === "audio-to-en" && (
          <p className="feedback feedback-neutral">
            You heard: <strong lang="de">{question.prompt}</strong>
            <SpeakerButton text={question.prompt} />
          </p>
        )}

        {phase === "correct" && (
          <p className="feedback feedback-correct celebration" aria-live="polite">
            {praise}
          </p>
        )}
        {phase === "incorrect" && (
          <p className="feedback feedback-incorrect">
            ✗ Not quite. The correct answer is{" "}
            <strong lang={answerLang}>{question.expectedAnswer}</strong>.
            {answerLang === "de" && <SpeakerButton text={question.expectedAnswer} />}
          </p>
        )}

        <button type="submit" className="primary submit-button">
          {phase === "answering"
            ? "Check"
            : index + 1 < questions.length
              ? "Next question"
              : "See results"}
        </button>
      </form>
    </div>
  );
}

/** Speaks a German word aloud. Renders nothing if the browser has no speech support. */
function SpeakerButton({ text }: { text: string }) {
  if (!speechSupported()) return null;
  return (
    <button
      type="button"
      className="speaker-button"
      onClick={() => speakGerman(text)}
      aria-label={`Pronounce “${text}”`}
      title="Pronounce"
    >
      🔊
    </button>
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
            {incorrect.map((result, reviewIndex) => {
              const question = result.question;
              return (
                <li key={reviewIndex}>
                  {question.mode === "audio-to-de" ? (
                    // Prompt and answer are the same German word; show it once.
                    <span className="review-prompt" lang="de">
                      {question.expectedAnswer}
                      <SpeakerButton text={question.expectedAnswer} />
                    </span>
                  ) : (
                    <>
                      <span
                        className="review-prompt"
                        lang={question.mode === "en-to-de" ? "en" : "de"}
                      >
                        {question.prompt}
                        {question.mode !== "en-to-de" && <SpeakerButton text={question.prompt} />}
                      </span>
                      <span className="review-answer" lang={answerLanguage(question.mode)}>
                        {question.expectedAnswer}
                        {question.mode === "en-to-de" && (
                          <SpeakerButton text={question.expectedAnswer} />
                        )}
                      </span>
                    </>
                  )}
                  {result.entered.trim() !== "" && (
                    <span className="review-entered">you wrote: {result.entered}</span>
                  )}
                </li>
              );
            })}
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
