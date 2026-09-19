import { useEffect, useState } from "react";
import type { CurrentSession } from "../../shared/types";
import { fetchSession, fetchVersion } from "./api";
import { HomeScreen } from "./HomeScreen";
import { QuizScreen } from "./QuizScreen";
import type { QuizMode } from "./lib/quiz";

type Route = { screen: "home" } | { screen: "quiz"; setId: string; mode: QuizMode };

export function App() {
  const [route, setRoute] = useState<Route>({ screen: "home" });
  const [version, setVersion] = useState<string | null>(null);
  const [session, setSession] = useState<CurrentSession | null>(null);

  // Purely informational; stay quiet if the endpoints are unreachable.
  useEffect(() => {
    fetchVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
    fetchSession()
      .then(setSession)
      .catch(() => setSession(null));
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
      <footer className="app-footer">
        {session !== null && (
          <p>
            Signed in as {session.user.name}
            {session.logoutUrl !== null && (
              <>
                {" · "}
                <a href={session.logoutUrl}>Log out</a>
              </>
            )}
          </p>
        )}
        {version !== null && <p>version {version}</p>}
      </footer>
    </div>
  );
}
