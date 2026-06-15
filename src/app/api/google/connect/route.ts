import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import {
  buildGoogleOAuthUrl,
  createGoogleOAuthState,
  getGoogleOAuthCookieName,
} from "@/lib/google-oauth";

export const runtime = "nodejs";

function summarizeValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  const requestId = request.headers.get("x-vercel-id");
  const userAgent = request.headers.get("user-agent");

  if (!session) {
    console.warn("[google-connect] missing-session", {
      requestId,
      host: request.nextUrl.host,
      origin: request.nextUrl.origin,
      hasSessionCookie: Boolean(token),
      userAgent,
    });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = createGoogleOAuthState();
  const redirectUrl = buildGoogleOAuthUrl({
    origin: request.nextUrl.origin,
    state,
  });
  const response = NextResponse.redirect(redirectUrl);
  const stateCookieName = getGoogleOAuthCookieName();

  response.cookies.set({
    name: stateCookieName,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  console.info("[google-connect] oauth-start", {
    requestId,
    host: request.nextUrl.host,
    origin: request.nextUrl.origin,
    userId: session.sub,
    hasSessionCookie: Boolean(token),
    stateCookieName,
    statePreview: summarizeValue(state),
    redirectUri: redirectUrl.searchParams.get("redirect_uri"),
    sameSite: "lax",
    secureCookie: process.env.NODE_ENV === "production",
    userAgent,
  });

  return response;
}
