import express from "express";
import type { NextFunction, Request, Response } from "express";
import type { CurrentSession } from "../shared/types.js";
import { createAuthMiddleware, LOGOUT_PATH, type AuthConfig } from "./auth.js";
import type { VocabularyRepository } from "./vocabularyRepository.js";

/** Creates the Express app with the API routes. Static file serving is wired up in index.ts. */
export function createApp(
  repository: VocabularyRepository,
  authConfig: AuthConfig,
  version = "dev",
): express.Express {
  const app = express();
  app.disable("x-powered-by");

  // Everything below (including the static files added in index.ts) requires a
  // signed-in user, apart from the few public paths listed in auth.ts.
  app.use(createAuthMiddleware(authConfig));

  app.get("/api/version", (_req, res) => {
    res.json({ version });
  });

  app.get("/api/me", (req, res) => {
    const session: CurrentSession = {
      user: req.user!,
      logoutUrl: authConfig.mode === "oidc" ? LOGOUT_PATH : null,
    };
    res.json(session);
  });

  app.get("/api/sets", async (_req, res) => {
    res.json(await repository.getSets());
  });

  app.get("/api/sets/:id", async (req, res) => {
    const set = await repository.getSet(req.params.id);
    if (set === null) {
      res.status(404).json({ error: `Unknown vocabulary set "${req.params.id}"` });
      return;
    }
    res.json(set);
  });

  // Express 5 forwards rejected promises from handlers here automatically.
  app.use(
    (error: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
      // Client errors raised by middleware, e.g. a stale or forged OIDC callback.
      if (error.status !== undefined && error.status >= 400 && error.status < 500) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}
