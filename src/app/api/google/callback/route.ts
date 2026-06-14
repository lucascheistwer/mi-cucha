import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import {
  exchangeGoogleCodeForTokens,
  fetchGoogleUserEmail,
  getGoogleOAuthCookieName,
  encryptGoogleToken,
} from "@/lib/google-oauth";
import { dbConnect } from "@/lib/dbConnect";
import { Household } from "@/models/Household";
import { User } from "@/models/User";

export const runtime = "nodejs";

function buildConfigurationRedirect(request: NextRequest, status: string) {
  const redirectUrl = new URL("/configuracion", request.url);
  redirectUrl.searchParams.set("google", status);

  return redirectUrl;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(getGoogleOAuthCookieName())?.value;
  const response = NextResponse.redirect(
    buildConfigurationRedirect(request, session && code && state && state === storedState ? "connected" : "error")
  );

  response.cookies.set({
    name: getGoogleOAuthCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  if (!session || !code || !state || state !== storedState) {
    return response;
  }

  try {
    const googleTokens = await exchangeGoogleCodeForTokens({
      code,
      origin: request.nextUrl.origin,
    });
    const email = await fetchGoogleUserEmail(googleTokens.accessToken);

    await dbConnect();

    await User.findByIdAndUpdate(session.sub, {
      $set: {
        "googleAuth.email": email,
        "googleAuth.accessTokenEncrypted": encryptGoogleToken(googleTokens.accessToken),
        "googleAuth.refreshTokenEncrypted": encryptGoogleToken(googleTokens.refreshToken),
        "googleAuth.scope": googleTokens.scope,
        "googleAuth.tokenType": googleTokens.tokenType,
        "googleAuth.expiryDate": googleTokens.expiresAt,
        "googleAuth.connectedAt": new Date(),
      },
    });

    await Household.findOneAndUpdate(
      {
        _id: session.hogarId,
        "googleSheets.exportOwnerUserId": { $exists: false },
      },
      {
        $set: {
          "googleSheets.exportOwnerUserId": session.sub,
        },
      }
    );

    return response;
  } catch {
    return NextResponse.redirect(buildConfigurationRedirect(request, "error"));
  }
}
