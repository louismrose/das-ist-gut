import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Events, OAuth2Server } from "oauth2-mock-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { DEV_USER, loadAuthConfig, type AuthConfig } from "./auth";
import type { VocabularyRepository } from "./vocabularyRepository";

const repository: VocabularyRepository = {
  getSets: async () => [{ id: "animals", name: "Animals", itemCount: 1 }],
  getSet: async () => null,
};

/** The app's public (https) URL; the test browser routes it to the local test server. */
const BASE_URL = "https://das-ist-gut.test";

const oidcEnv = {
  OIDC_ISSUER_URL: "https://id.example.test",
  OIDC_CLIENT_ID: "das-ist-gut",
  OIDC_CLIENT_SECRET: "client-secret",
  BASE_URL,
  SESSION_SECRET: "a-session-secret-that-is-long-enough-for-tests",
};

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });
}

/** Just enough of a browser to walk the OIDC flow: per-origin cookies and redirects. */
class TestBrowser {
  private readonly cookies = new Map<string, Map<string, string>>();
  /** Every Set-Cookie header received, for asserting on cookie attributes. */
  readonly setCookieHeaders: string[] = [];

  constructor(private readonly appAddress: string) {}

  async get(url: string, { followRedirects = true } = {}): Promise<Response> {
    let target = new URL(url, BASE_URL);
    for (let hop = 0; hop < 10; hop++) {
      const jar = this.cookies.get(target.origin) ?? new Map<string, string>();
      this.cookies.set(target.origin, jar);
      const address =
        target.origin === BASE_URL ? this.appAddress + target.pathname + target.search : target;
      const response = await fetch(address, {
        redirect: "manual",
        headers: {
          accept: "text/html",
          cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
        },
      });
      for (const header of response.headers.getSetCookie()) {
        this.setCookieHeaders.push(header);
        const [pair = "", ...attributes] = header.split("; ");
        const name = pair.slice(0, pair.indexOf("="));
        const expires = attributes.find((a) => a.toLowerCase().startsWith("expires="));
        if (expires !== undefined && new Date(expires.slice("expires=".length)) <= new Date()) {
          jar.delete(name);
        } else {
          jar.set(name, pair.slice(name.length + 1));
        }
      }
      const location = response.headers.get("location");
      if (!followRedirects || response.status < 300 || response.status >= 400 || !location) {
        return response;
      }
      target = new URL(location, target);
    }
    throw new Error("Too many redirects");
  }
}

describe("loadAuthConfig", () => {
  it("requires the OIDC settings by default", () => {
    expect(() => loadAuthConfig({})).toThrow(/OIDC_ISSUER_URL/);
    expect(() => loadAuthConfig({ ...oidcEnv, OIDC_CLIENT_SECRET: "" })).toThrow(
      /OIDC_CLIENT_SECRET/,
    );
  });

  it("reads the OIDC settings from the environment", () => {
    expect(loadAuthConfig({ ...oidcEnv, NODE_ENV: "production" })).toEqual({
      mode: "oidc",
      issuerUrl: oidcEnv.OIDC_ISSUER_URL,
      clientId: oidcEnv.OIDC_CLIENT_ID,
      clientSecret: oidcEnv.OIDC_CLIENT_SECRET,
      baseUrl: BASE_URL,
      sessionSecret: oidcEnv.SESSION_SECRET,
    });
  });

  it("rejects a short session secret", () => {
    expect(() => loadAuthConfig({ ...oidcEnv, SESSION_SECRET: "too-short" })).toThrow(
      /at least 32/,
    );
  });

  it("disables authentication only when explicitly asked to", () => {
    expect(loadAuthConfig({ AUTH_DISABLED: "true" })).toEqual({ mode: "disabled" });
    expect(loadAuthConfig({ AUTH_DISABLED: "true", NODE_ENV: "development" })).toEqual({
      mode: "disabled",
    });
    // Anything other than exactly "true" leaves authentication on.
    expect(() => loadAuthConfig({ AUTH_DISABLED: "1" })).toThrow(/OIDC_ISSUER_URL/);
  });

  it("refuses to disable authentication in production", () => {
    expect(() => loadAuthConfig({ AUTH_DISABLED: "true", NODE_ENV: "production" })).toThrow(
      /not allowed/,
    );
    expect(() =>
      loadAuthConfig({ ...oidcEnv, AUTH_DISABLED: "true", NODE_ENV: "production" }),
    ).toThrow(/not allowed/);
  });
});

describe("with authentication disabled", () => {
  let server: Server;
  let address: string;

  beforeAll(async () => {
    server = createServer(createApp(repository, { mode: "disabled" }));
    address = await listen(server);
  });

  afterAll(() => {
    server.close();
  });

  it("serves the API without a login", async () => {
    const response = await fetch(`${address}/api/sets`);
    expect(response.status).toBe(200);
  });

  it("identifies every request as the dev user, with no way to log out", async () => {
    const response = await fetch(`${address}/api/me`);
    expect(await response.json()).toEqual({ user: DEV_USER, logoutUrl: null });
  });
});

describe("with OIDC authentication", () => {
  /** Pocket ID client IDs are UUIDs. */
  const CLIENT_ID = "3654a746-35d4-4321-ac61-0bdcff2b4055";
  const idp = new OAuth2Server();
  let server: Server;
  let address: string;

  beforeAll(async () => {
    await idp.issuer.keys.generate("RS256");
    await idp.start(0, "127.0.0.1");
    idp.service.on(Events.BeforeTokenSigning, (token, req) => {
      // The app authenticates with client_secret_basic, whose credentials are
      // form-encoded inside the Basic header (RFC 6749 section 2.3.1), so the
      // hyphens arrive as %2D. Unlike Pocket ID, the mock does not decode them
      // before copying the client ID into `aud`; do that here on its behalf.
      const basic = req.headers.authorization!.slice("Basic ".length);
      const [encodedClientId = ""] = Buffer.from(basic, "base64").toString().split(":");
      Object.assign(token.payload, {
        aud: new URLSearchParams(`id=${encodedClientId}`).get("id"),
        sub: "user-123",
        name: "Erika Mustermann",
        email: "erika@example.test",
      });
    });

    const authConfig: AuthConfig = {
      mode: "oidc",
      issuerUrl: idp.issuer.url!,
      clientId: CLIENT_ID,
      clientSecret: oidcEnv.OIDC_CLIENT_SECRET,
      baseUrl: BASE_URL,
      sessionSecret: oidcEnv.SESSION_SECRET,
    };
    server = createServer(createApp(repository, authConfig));
    address = await listen(server);
  });

  afterAll(async () => {
    server.close();
    await idp.stop();
  });

  it("rejects unauthenticated API requests with a 401 rather than a redirect", async () => {
    const response = await fetch(`${address}/api/sets`, { redirect: "manual" });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated" });

    expect((await fetch(`${address}/api/me`, { redirect: "manual" })).status).toBe(401);
  });

  it("leaves the version endpoint public", async () => {
    const response = await fetch(`${address}/api/version`);
    expect(response.status).toBe(200);
  });

  it("redirects unauthenticated page loads to the identity provider", async () => {
    const response = await new TestBrowser(address).get("/", { followRedirects: false });
    expect(response.status).toBe(302);

    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe(new URL(idp.issuer.url!).origin);
    const params = location.searchParams;
    expect(params.get("response_type")).toBe("code");
    expect(params.get("client_id")).toBe(CLIENT_ID);
    expect(params.get("redirect_uri")).toBe(`${BASE_URL}/callback`);
    expect(params.get("scope")).toBe("openid profile email");
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("code_challenge")).toBeTruthy();
    expect(params.get("state")).toBeTruthy();
    expect(params.get("nonce")).toBeTruthy();
  });

  it("establishes a session through the authorization code flow", async () => {
    const browser = new TestBrowser(address);

    // App -> identity provider -> /callback -> back to the app.
    const page = await browser.get("/");
    expect(new URL(page.url).pathname).toBe("/");

    const me = await browser.get("/api/me");
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({
      user: { id: "user-123", name: "Erika Mustermann", email: "erika@example.test" },
      logoutUrl: "/logout",
    });
    expect((await browser.get("/api/sets")).status).toBe(200);

    const sessionCookie = browser.setCookieHeaders.find((h) => h.startsWith("appSession="));
    expect(sessionCookie).toMatch(/; HttpOnly/i);
    expect(sessionCookie).toMatch(/; Secure/i);
    expect(sessionCookie).toMatch(/; SameSite=Lax/i);
  });

  it("rejects a callback that does not match a login it started", async () => {
    const browser = new TestBrowser(address);
    const response = await browser.get("/callback?code=forged&state=forged");
    expect(response.status).toBe(400);
    expect((await browser.get("/api/me")).status).toBe(401);
  });

  it("logs out of the app and the identity provider", async () => {
    const browser = new TestBrowser(address);
    await browser.get("/");
    expect((await browser.get("/api/me")).status).toBe(200);

    const response = await browser.get("/logout", { followRedirects: false });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe(new URL(idp.issuer.url!).origin);
    expect(location.searchParams.get("post_logout_redirect_uri")).toBe(BASE_URL);
    expect(location.searchParams.get("id_token_hint")).toBeTruthy();

    expect((await browser.get("/api/me")).status).toBe(401);
  });
});
