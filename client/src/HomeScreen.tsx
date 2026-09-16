import { useEffect, useState } from "react";
import type { VocabularySetSummary } from "../../shared/types";
import { fetchSets } from "./api";
import { isAudioMode, MODE_ICONS, MODE_LABELS, type QuizMode } from "./lib/quiz";
import { speechSupported } from "./lib/speech";

interface HomeScreenProps {
  onStart: (setId: string, mode: QuizMode) => void;
}

const MODES: QuizMode[] = ["en-to-de", "de-to-en", "audio-to-de", "audio-to-en"];

export function HomeScreen({ onStart }: HomeScreenProps) {
  const [sets, setSets] = useState<VocabularySetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Listening modes need the Web Speech API; hide them where it is missing.
  const modes = speechSupported() ? MODES : MODES.filter((mode) => !isAudioMode(mode));

  useEffect(() => {
    fetchSets()
      .then(setSets)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error !== null) {
    return <p className="status status-error">Could not load vocabulary sets: {error}</p>;
  }
  if (sets === null) {
    return <p className="status">Loading vocabulary sets…</p>;
  }
  if (sets.length === 0) {
    return <p className="status">No vocabulary sets are configured yet.</p>;
  }

  return (
    <div className="set-list">
      <p className="intro">Pick a set and a direction to start a quiz.</p>
      {sets.map((set) => (
        <section key={set.id} className="card set-card">
          <h2>{set.name}</h2>
          <p className="set-meta">
            {set.itemCount} {set.itemCount === 1 ? "word" : "words"}
          </p>
          <div className="mode-buttons">
            {modes.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onStart(set.id, mode)}
                aria-label={MODE_LABELS[mode]}
                title={MODE_LABELS[mode]}
              >
                {MODE_ICONS[mode]}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
