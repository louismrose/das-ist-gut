import { Router } from "express";
import { auth } from "express-openid-connect";
import type { CurrentUser } from "../shared/types.js";

declare module "express-serve-static-core" {
  interface Request {
    /** The authenticated user. Always set on routes behind the auth middleware. */
    user?: CurrentUser;
  }
}

export type AuthConfig =
  | { mode: "disabled" }
  | {
      mode: "oidc";
      issuerUrl: string;
      clientId: string;
      clientSecret: string;
      /** Public URL of this app; the OIDC redirect URI is `${baseUrl}/callback`. */
      baseUrl: string;
      /** Key for encrypting the session cookie. */
      sessionSecret: string;
    };

/** The identity every request gets when authentication is disabled. */
export const DEV_USER: CurrentUser = { id: "dev-user", name: "Dev User", email: "dev@localhost" };

/** Where the browser goes to log out (served by express-openid-connect). */
export const LOGOUT_PATH = "/logout";

/**
 * Requested without cookies by browsers and OSes (web manifest, home-screen
 * icons) or by health probes, so they must not require a session.
 */
const PUBLIC_PATHS = new Set([
  "/api/version",
  "/site.webmanifest",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
]);

const MIN_SESSION_SECRET_LENGTH = 32;

/**
 * Reads the auth configuration from the environment, failing fast if it is
 * incomplete. Authentication is on unless AUTH_DISABLED is exactly "true", and
 * that opt-out is refused outright when NODE_ENV=production (which the Docker
 * image bakes in), so a production deployment can never silently run open.
 */
export function loadAuthConfig(env: NodeJS.ProcessEnv): AuthConfig {
  if (env.AUTH_DISABLED === "true") {
    if (env.NODE_ENV === "production") {
      throw new Error("AUTH_DISABLED=true is not allowed when NODE_ENV=production");
    }
    return { mode: "disabled" };
  }

  const required = (name: string): string => {
    const value = env[name];
    if (value === undefined || value === "") {
      throw new Error(
        `Missing environment variable ${name}. Authentication needs OIDC_ISSUER_URL, ` +
          "OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, BASE_URL and SESSION_SECRET " +
          "(or, outside production only, set AUTH_DISABLED=true).",
      );
    }
    return value;
  };

  const config: AuthConfig = {
    mode: "oidc",
    issuerUrl: required("OIDC_ISSUER_URL"),
    clientId: required("OIDC_CLIENT_ID"),
    clientSecret: required("OIDC_CLIENT_SECRET"),
    baseUrl: required("BASE_URL"),
    sessionSecret: required("SESSION_SECRET"),
  };
  if (config.sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`);
  }
  return config;
}

/**
 * Middleware that puts everything mounted after it behind authentication and
 * sets `req.user`.
 *
 * In "oidc" mode, express-openid-connect runs the Authorization Code flow
 * (state, nonce and PKCE included), serves /login, /callback and /logout, and
 * keeps the session in an encrypted cookie, so no session store is needed.
 */
export function createAuthMiddleware(config: AuthConfig): Router {
  const router = Router();

  if (config.mode === "disabled") {
    router.use((req, _res, next) => {
      req.user = DEV_USER;
      next();
    });
    return router;
  }

  router.use(
    auth({
      issuerBaseURL: config.issuerUrl,
      baseURL: config.baseUrl,
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      secret: config.sessionSecret,
      authorizationParams: { response_type: "code", scope: "openid profile email" },
      // Enforced below instead, so that API calls get a 401 rather than a redirect.
      authRequired: false,
      // Also end the Pocket ID session; otherwise "log out" would be undone by
      // an immediate silent re-login.
      idpLogout: true,
      routes: { logout: LOGOUT_PATH },
      // Session cookie defaults: HttpOnly, SameSite=Lax, and Secure whenever
      // baseURL is https.
    }),
  );

  router.use((req, res, next) => {
    if (PUBLIC_PATHS.has(req.path)) {
      next();
      return;
    }
    const claims = req.oidc.isAuthenticated() ? req.oidc.user : undefined;
    if (claims !== undefined) {
      req.user = {
        id: claims.sub,
        name: claims.name ?? claims.preferred_username ?? claims.email ?? claims.sub,
        email: claims.email,
      };
      next();
      return;
    }
    // Only page loads can usefully follow a redirect to the identity provider.
    if (req.method !== "GET" || req.path.startsWith("/api/") || !req.accepts("html")) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    void res.oidc.login();
  });

  return router;
}
