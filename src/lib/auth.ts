// Ubicacion: src/lib/auth.ts
// Utilidades compartidas para firmar y validar la sesion JWT del MVP.

import { promisify } from "node:util";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const encoder = new TextEncoder();
const scryptAsync = promisify(scrypt);

export const AUTH_COOKIE_NAME = "mi-cucha.session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 365;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_LENGTH = 16;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

export type SessionPayload = {
  sub: string;
  username: string;
  hogarId: string;
  iat: number;
  exp: number;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("Falta definir AUTH_SECRET en .env.local");
  }

  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(unsignedToken: string) {
  return createHmac("sha256", getAuthSecret())
    .update(unsignedToken)
    .digest("base64url");
}

export function normalizeUsername(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!/^[a-z0-9._-]{3,30}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function validatePassword(value: unknown) {
  if (typeof value !== "string") {
    return "Ingresá una contraseña válida.";
  }

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (value.length > PASSWORD_MAX_LENGTH) {
    return "La contraseña es demasiado larga.";
  }

  return null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(PASSWORD_SALT_LENGTH).toString("hex");
  const derivedKey = (await scryptAsync(
    password,
    salt,
    PASSWORD_KEY_LENGTH
  )) as Buffer;

  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expectedHash] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !expectedHash) {
    return false;
  }

  const derivedKey = (await scryptAsync(
    password,
    salt,
    PASSWORD_KEY_LENGTH
  )) as Buffer;
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (derivedKey.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedBuffer);
}

export function createSessionToken(input: {
  userId: string;
  username: string;
  hogarId: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: input.userId,
    username: input.username,
    hogarId: input.hogarId,
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
  };

  const header: JwtHeader = {
    alg: "HS256",
    typ: "JWT",
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  return `${unsignedToken}.${sign(unsignedToken)}`;
}

export function verifySessionToken(token: string) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, receivedSignature] = parts;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(unsignedToken);
  const expectedBuffer = encoder.encode(expectedSignature);
  const receivedBuffer = encoder.encode(receivedSignature);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (
      typeof payload.sub !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.hogarId !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= now
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookie(token: string) {
  const expires = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  return {
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
    expires,
  };
}

export function getExpiredSessionCookie() {
  return {
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
}