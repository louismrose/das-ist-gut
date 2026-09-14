# Das ist gut!

A small self-hosted German vocabulary practice app for use on a home network.
Pick a vocabulary set, choose a quiz mode, and type the answers. Scores live
only in the browser session — there is no database, no accounts, and nothing to
maintain.

Four quiz modes:

- **English → German** — type the German translation (articles included);
- **German → English** — type the English translation;
- **Listen → German** — hear the German word and type its spelling;
- **Listen → English** — hear the German word and type the English translation.

The listening modes (and the 🔊 pronunciation buttons) use the browser's
built-in speech synthesis and are hidden on browsers without it.

## How it works

- **Express** serves a tiny JSON API (`/api/sets`, `/api/sets/:id`) and, in
  production, the built React app — one process, one port.
- **React + Vite** provide the quiz UI.
- Vocabulary lives in a single JSON file, `data/vocabulary.json`, read by the
  server on every request — edit the file and refresh the browser, no restart
  needed.

Answers are compared case-insensitively with surrounding whitespace ignored, but
German spelling is otherwise significant: `a` does not match `ä`, and `ss` does
not match `ß`. The rules live in one place, `shared/answers.ts`.

## Running locally (development)

Requires Node.js 22+.

```sh
npm install
npm run dev
```

This starts Express on <http://localhost:3000> and Vite on
<http://localhost:5173> (with `/api` proxied to Express). Open
<http://localhost:5173>.

## Running locally (production build)

```sh
npm run build
npm start
```

Then open <http://localhost:3000>. Set `PORT` to use a different port.

## Running with Docker

```sh
docker compose up --build -d
```

Then open <http://localhost:3000> (or `http://<server-ip>:3000` from other
devices on your network). The compose file mounts `./data` into the container,
so you can edit `data/vocabulary.json` on the host and just refresh the browser.

Without compose:

```sh
docker build -t das-ist-gut .
docker run -d -p 3000:3000 --restart unless-stopped --name das-ist-gut das-ist-gut
```

## Editing vocabulary

Edit `data/vocabulary.json`:

```json
{
  "sets": [
    {
      "id": "animals",
      "name": "Animals",
      "items": [
        { "english": "dog", "german": "der Hund" },
        { "english": "cat", "german": "die Katze" }
      ]
    }
  ]
}
```

Each set needs a unique `id`, a display `name`, and at least one item. Include
articles (`der`/`die`/`das`) in the `german` field if you want them to be part
of the expected answer. The server validates the file and reports a descriptive
error if it is malformed.

## Development commands

| Command             | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | Run Express + Vite together for development                         |
| `npm test`          | Run the test suite (answer matching, quiz building, config parsing) |
| `npm run typecheck` | Type-check the client and server                                    |
| `npm run lint`      | Lint with ESLint                                                    |
| `npm run format`    | Format with Prettier                                                |
| `npm run build`     | Build server (`dist/server`) and client (`dist/client`)             |
| `npm start`         | Run the production build                                            |

## Project layout

```
data/vocabulary.json   Vocabulary configuration
shared/                Types and answer-matching logic shared by client and server
server/                Express API; VocabularyRepository abstraction + config-file implementation
client/                React app (Vite)
```

`server/vocabularyRepository.ts` defines the `VocabularyRepository` interface;
the config-file implementation is the only place that touches the JSON file. A
future SQLite version only needs to implement that interface and swap one line
in `server/index.ts`.
