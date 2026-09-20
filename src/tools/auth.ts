import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerGoogleAuth,
  TokenProvider,
  unconfiguredPrefix,
  type GoogleAuthOptions,
} from "@a1-x-tech/mcp-google-auth";

/**
 * The scopes an in-chat login requests (the per-task table lives in
 * docs/TOOLS.md). The component always adds the identity scopes on top. The full `drive` scope rides along because export and comments reach presentations this server did not create; `drive.file` would silently fail on decks the user opened elsewhere.
 */
export const LOGIN_SCOPES = [
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/drive",
];

/**
 * The single source of the auth wiring: serverName "slides" puts the stored
 * login in ~/.config/mcp-google-slides/credentials.json (the component
 * prefixes "mcp-google-"), envPrefix keeps the provider reading the exact
 * GOOGLE_SLIDES_* variables config.ts documents — which is what preserves the
 * env-beats-stored priority for existing installs.
 */
export const AUTH_OPTIONS: GoogleAuthOptions = {
  serverName: "slides",
  envPrefix: "GOOGLE_SLIDES",
  scopes: LOGIN_SCOPES,
};

/**
 * Registers the six onboarding tools (auth_status, setup_instructions,
 * set_client, start_login, finish_login, logout) and returns the TokenProvider
 * the client plugs in as its fallback token source — the same instance, so a
 * login finished mid-session is visible to the very next API call without a
 * restart.
 */
export function registerAuthTools(server: McpServer): TokenProvider {
  return registerGoogleAuth(server, AUTH_OPTIONS);
}

/** True when any token exists — env variables or a stored in-chat login. */
export function hasAuthToken(): boolean {
  return new TokenProvider(AUTH_OPTIONS).hasToken();
}

/** The "NOT CONNECTED" prefix for the initialize instructions (names both fixes). */
export function authUnconfiguredPrefix(): string {
  return unconfiguredPrefix(AUTH_OPTIONS);
}
