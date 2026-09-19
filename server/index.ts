import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app.js";
import { loadAuthConfig } from "./auth.js";
import { ConfigVocabularyRepository } from "./configVocabularyRepository.js";

const port = Number(process.env.PORT ?? 3000);
const vocabularyFile = process.env.VOCABULARY_FILE ?? path.resolve("data/vocabulary.json");

// Baked into the Docker image at build time (see Dockerfile's GIT_SHA arg).
const version = process.env.GIT_SHA ?? "dev";

// Throws (and so refuses to start) if the OIDC settings are incomplete.
const authConfig = loadAuthConfig(process.env);
if (authConfig.mode === "disabled") {
  console.warn("WARNING: AUTH_DISABLED=true, so authentication is OFF. Development only!");
}

const repository = new ConfigVocabularyRepository(vocabularyFile);
const app = createApp(repository, authConfig, version);

// In production the built React app lives next to the compiled server (dist/client).
// In development Vite serves the frontend instead, so this block is skipped.
const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client");
if (existsSync(path.join(clientDir, "index.html"))) {
  app.use(express.static(clientDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile(path.join(clientDir, "index.html"));
    } else {
      next();
    }
  });
}

// Fail fast on a malformed vocabulary file rather than at the first request.
const sets = await repository.getSets();
console.log(`Loaded ${sets.length} vocabulary set(s) from ${vocabularyFile}`);

app.listen(port, () => {
  console.log(`Das ist gut! (${version}) Listening on http://localhost:${port}`);
});
