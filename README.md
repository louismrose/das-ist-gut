# Das ist gut!

A small self-hosted German vocabulary practice app for use on a home network.
Pick a vocabulary set, choose a quiz mode, and type the answers. Scores live
only in the browser session — there is no database and nothing to maintain.
Sign-in is delegated to an OpenID Connect provider ([Pocket ID](https://pocket-id.org));
see [Authentication](#authentication).

Four quiz modes:

- **English → German** — type the German translation (articles included);
- **German → English** — type the English translation;
- **Listen → German** — hear the German word and type its spelling;
- **Listen → English** — hear the German word and type the English translation.

The listening modes (and the 🔊 pronunciation buttons) use the browser's
built-in speech synthesis and are hidden on browsers without it.

## How it works

- **Express** serves a tiny JSON API (`/api/sets`, `/api/sets/:id`, `/api/me`)
  and, in production, the built React app — one process, one port. It is also
  the OIDC client: it signs users in and keeps their session in a cookie.
- **React + Vite** provide the quiz UI.
- Vocabulary lives in a single JSON file, `data/vocabulary.json`, read by the
  server on every request — edit the file and refresh the browser, no restart
  needed.

Answers are compared case-insensitively with surrounding whitespace ignored, but
German spelling is otherwise significant: `a` does not match `ä`, and `ss` does
not match `ß`. An answer that is entirely a number may be written as digits or
as the number word in the answer's language (`8` ↔ `eight`, or `8` ↔ `acht`
when the answer should be German), covering 0–20, the tens, and 100. The rules
live in one place, `shared/answers.ts`.

## Running locally (development)

Requires Node.js 22+.

```sh
npm install
npm run dev
```

This starts Express on <http://localhost:3000> and Vite on
<http://localhost:5173> (with `/api` proxied to Express). Open
<http://localhost:5173>.

No identity provider is needed: the `dev:server` script sets
`AUTH_DISABLED=true`, so every request is treated as a fixed "Dev User" (see
[Authentication](#authentication)).

## Running locally (production build)

```sh
npm run build
AUTH_DISABLED=true npm start
```

Then open <http://localhost:3000>. Set `PORT` to use a different port. To
exercise real sign-in instead, leave out `AUTH_DISABLED` and set the
[OIDC environment variables](#environment-variables) with
`BASE_URL=http://localhost:3000` (and register
`http://localhost:3000/callback` as a callback URL in Pocket ID).

## Running with Docker

The image always runs with `NODE_ENV=production`, so authentication cannot be
turned off and the OIDC settings are required. Copy `.env.example` to `.env`,
fill it in, then:

```sh
docker compose up --build -d
```

Then open <http://localhost:3000> (or `http://<server-ip>:3000` from other
devices on your network). The compose file mounts `./data` into the container,
so you can edit `data/vocabulary.json` on the host and just refresh the browser.

Without compose:

```sh
docker build -t das-ist-gut .
docker run -d -p 3000:3000 --env-file .env --restart unless-stopped --name das-ist-gut das-ist-gut
```

## Authentication

Express is the OIDC client (a confidential client using the Authorization Code
flow), via [`express-openid-connect`](https://github.com/auth0/express-openid-connect).
The library handles `state`, `nonce` and PKCE, validates the ID token, and
keeps the session in an encrypted, `HttpOnly`, `SameSite=Lax` cookie that is
also `Secure` whenever `BASE_URL` is https. There is no server-side session
store, so restarts and redeploys do not sign anyone out. The React app never
sees tokens or the client secret; it only calls `GET /api/me`.

| Route           | What it does                                                         |
| --------------- | -------------------------------------------------------------------- |
| `GET /login`    | Starts a sign-in at Pocket ID                                        |
| `GET /callback` | The OIDC redirect URI; completes sign-in and sets the session cookie |
| `GET /logout`   | Clears the session, then signs out of Pocket ID too                  |
| `GET /api/me`   | `{ user: { id, name, email }, logoutUrl }` for the signed-in user    |

Without a session, page loads are redirected to Pocket ID and `/api/*` requests
get a `401` (the frontend reacts by reloading, which triggers the redirect).
Only `/api/version` (handy for health probes) and the web manifest and icons
are public. Server code finds the signed-in user on `req.user` (`id` is the
OIDC `sub` claim).

### Pocket ID configuration

In the Pocket ID admin UI, create an OIDC client with:

| Setting              | Value                                     |
| -------------------- | ----------------------------------------- |
| Callback URLs        | `https://das-ist-gut.roses.casa/callback` |
| Logout Callback URLs | `https://das-ist-gut.roses.casa`          |
| Public client        | Off (the server holds a client secret)    |
| PKCE                 | On (the app always sends a challenge)     |

The app authenticates to the token endpoint with `client_secret_basic`, the
OIDC default. This needs Pocket ID **v2.3.0 or newer**: earlier versions did not
form-decode Basic credentials (RFC 6749 §2.3.1, fixed in pocket-id#1263), so
the hyphens in a client ID failed to match and sign-in ended in an
`invalid_client` error.

Then copy the generated client ID and client secret into the environment
variables below. If you restrict the client to user groups, only those users
can sign in. For sign-in against a local production build, additionally add
`http://localhost:3000/callback` and `http://localhost:3000`.

### Environment variables

| Variable             | Required        | Description                                                                                                         |
| -------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------- |
| `OIDC_ISSUER_URL`    | unless disabled | The provider's issuer URL, `https://id.roses.casa`                                                                  |
| `OIDC_CLIENT_ID`     | unless disabled | Client ID from Pocket ID                                                                                            |
| `OIDC_CLIENT_SECRET` | unless disabled | Client secret from Pocket ID                                                                                        |
| `BASE_URL`           | unless disabled | Public URL of the app, `https://das-ist-gut.roses.casa`; the callback is `${BASE_URL}/callback`                     |
| `SESSION_SECRET`     | unless disabled | At least 32 characters, used to encrypt the session cookie (`openssl rand -hex 32`). Changing it signs everyone out |
| `AUTH_DISABLED`      | no              | `true` turns authentication off. Rejected when `NODE_ENV=production`                                                |
| `PORT`               | no              | Port to listen on (default `3000`)                                                                                  |
| `VOCABULARY_FILE`    | no              | Path to the vocabulary file (default `data/vocabulary.json`)                                                        |

### Development and tests versus production

- **Authentication is on by default.** If the OIDC variables are missing, the
  server refuses to start rather than running unprotected.
- **Development:** `npm run dev` sets `AUTH_DISABLED=true` explicitly. Every
  request is then the fixed user `dev-user` ("Dev User"), no login happens, and
  the UI hides the "Log out" link. The server logs a warning at startup.
- **Production:** `AUTH_DISABLED=true` together with `NODE_ENV=production` is a
  startup error, and the Docker image bakes in `NODE_ENV=production`. So a
  deployed container either enforces sign-in or does not start.
- **Tests:** `npm test` needs no network. The auth tests run the real
  middleware against an in-process mock provider
  ([`oauth2-mock-server`](https://github.com/axa-group/oauth2-mock-server)),
  covering the redirect, the full code flow, cookie flags, logout, and the
  configuration rules above.

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

| Command             | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `npm run dev`       | Run Express + Vite together for development                       |
| `npm test`          | Run the test suite (answers, quiz building, config parsing, auth) |
| `npm run typecheck` | Type-check the client and server                                  |
| `npm run lint`      | Lint with ESLint                                                  |
| `npm run format`    | Format with Prettier                                              |
| `npm run build`     | Build server (`dist/server`) and client (`dist/client`)           |
| `npm start`         | Run the production build                                          |

## Project layout

```
data/vocabulary.json   Vocabulary configuration
shared/                Types and answer-matching logic shared by client and server
server/                Express API; VocabularyRepository abstraction + config-file implementation
server/auth.ts         Authentication: env config, OIDC middleware, dev bypass
client/                React app (Vite)
```

`server/vocabularyRepository.ts` defines the `VocabularyRepository` interface;
the config-file implementation is the only place that touches the JSON file. A
future SQLite version only needs to implement that interface and swap one line
in `server/index.ts`.
