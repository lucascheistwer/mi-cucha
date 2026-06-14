import { randomBytes } from "node:crypto";

import { decryptSecret, encryptSecret } from "@/lib/secure-store";

const GOOGLE_OAUTH_STATE_COOKIE = "mi-cucha.google-oauth-state";
const GOOGLE_OAUTH_SCOPE = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export type GoogleTokens = {
  accessToken: string;
  expiresAt: Date | null;
  refreshToken: string | null;
  scope: string[];
  tokenType: string | null;
};

export function getGoogleOAuthCookieName() {
  return GOOGLE_OAUTH_STATE_COOKIE;
}

export function getGoogleOAuthClientId() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;

  if (!clientId) {
    throw new Error("Falta definir GOOGLE_OAUTH_CLIENT_ID en .env.local");
  }

  return clientId;
}

function getGoogleOAuthClientSecret() {
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error("Falta definir GOOGLE_OAUTH_CLIENT_SECRET en .env.local");
  }

  return clientSecret;
}

export function getGoogleOAuthRedirectUri(origin: string) {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI ?? `${origin}/api/google/callback`;
}

export function buildGoogleOAuthUrl(input: {
  origin: string;
  state: string;
}) {
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: getGoogleOAuthClientId(),
    include_granted_scopes: "true",
    prompt: "consent",
    redirect_uri: getGoogleOAuthRedirectUri(input.origin),
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPE,
    state: input.state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function createGoogleOAuthState() {
  return randomBytes(24).toString("base64url");
}

async function exchangeGoogleToken(body: URLSearchParams) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as GoogleTokenResponse | null;

  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "Google no devolvió un access token.");
  }

  return {
    accessToken: data.access_token,
    expiresAt: typeof data.expires_in === "number"
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
    refreshToken: data.refresh_token ?? null,
    scope: data.scope?.split(" ").filter(Boolean) ?? [],
    tokenType: data.token_type ?? null,
  } satisfies GoogleTokens;
}

export async function exchangeGoogleCodeForTokens(input: {
  code: string;
  origin: string;
}) {
  const body = new URLSearchParams({
    client_id: getGoogleOAuthClientId(),
    client_secret: getGoogleOAuthClientSecret(),
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: getGoogleOAuthRedirectUri(input.origin),
  });

  return exchangeGoogleToken(body);
}

export async function refreshGoogleAccessToken(input: {
  refreshToken: string;
}) {
  const body = new URLSearchParams({
    client_id: getGoogleOAuthClientId(),
    client_secret: getGoogleOAuthClientSecret(),
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
  });

  return exchangeGoogleToken(body);
}

export async function fetchGoogleUserEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | { email?: string }
    | null;

  if (!response.ok || !data?.email) {
    throw new Error("No pudimos obtener el email de Google.");
  }

  return data.email;
}

export function encryptGoogleToken(value: string | null | undefined) {
  return value ? encryptSecret(value) : undefined;
}

export function decryptGoogleToken(value: string | null | undefined) {
  return value ? decryptSecret(value) : null;
}
