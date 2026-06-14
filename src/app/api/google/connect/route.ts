import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import {
  buildGoogleOAuthUrl,
  createGoogleOAuthState,
  getGoogleOAuthCookieName,
} from "@/lib/google-oauth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = createGoogleOAuthState();
  const redirectUrl = buildGoogleOAuthUrl({
    origin: request.nextUrl.origin,
    state,
  });
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set({
    name: getGoogleOAuthCookieName(),
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
