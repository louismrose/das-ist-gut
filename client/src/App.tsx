import { useEffect, useState } from "react";
import { fetchVersion } from "./api";
import { HomeScreen } from "./HomeScreen";
import { QuizScreen } from "./QuizScreen";
import type { QuizMode } from "./lib/quiz";

type Route = { screen: "home" } | { screen: "quiz"; setId: string; mode: QuizMode };

export function App() {
  const [route, setRoute] = useState<Route>({ screen: "home" });
  const [version, setVersion] = useState<string | null>(null);

  // Purely informational; stay quiet if the endpoint is unreachable.
  useEffect(() => {
    fetchVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <button
            type="button"
            className="title-button"
            onClick={() => setRoute({ screen: "home" })}
          >
            Das ist gut!
          </button>
        </h1>
        <p className="tagline">German vocabulary practice</p>
      </header>
      <main>
        {route.screen === "home" ? (
          <HomeScreen onStart={(setId, mode) => setRoute({ screen: "quiz", setId, mode })} />
        ) : (
          <QuizScreen
            key={`${route.setId}-${route.mode}`}
            setId={route.setId}
            mode={route.mode}
            onExit={() => setRoute({ screen: "home" })}
          />
        )}
      </main>
      {version !== null && <footer className="app-footer">version {version}</footer>}
    </div>
  );
}
