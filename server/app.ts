import express from "express";
import type { NextFunction, Request, Response } from "express";
import type { VocabularyRepository } from "./vocabularyRepository.js";

/** Creates the Express app with the API routes. Static file serving is wired up in index.ts. */
export function createApp(repository: VocabularyRepository, version = "dev"): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.get("/api/version", (_req, res) => {
    res.json({ version });
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
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
