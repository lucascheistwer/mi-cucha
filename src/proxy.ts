// Ubicacion: src/proxy.ts
// Protege las rutas de la app. Sin cookie valida redirige a /login.

import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  getExpiredSessionCookie,
  verifySessionToken,
} from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login"]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (PUBLIC_PATHS.has(pathname)) {
    if (!session) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const nextValue = `${pathname}${search}`;

  if (nextValue !== "/") {
    loginUrl.searchParams.set("next", nextValue);
  }

  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(getExpiredSessionCookie());

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|txt|xml)$).*)",
  ],
};