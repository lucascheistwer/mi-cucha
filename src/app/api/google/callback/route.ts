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
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookieName = getGoogleOAuthCookieName();
  const storedState = request.cookies.get(stateCookieName)?.value;
  const requestId = request.headers.get("x-vercel-id");
  const userAgent = request.headers.get("user-agent");
  const stateMatches = Boolean(state && storedState && state === storedState);
  const isReadyToExchange = Boolean(session && code && stateMatches);
  const response = NextResponse.redirect(
    buildConfigurationRedirect(request, isReadyToExchange ? "connected" : "error")
  );

  console.info("[google-callback] received", {
    requestId,
    host: request.nextUrl.host,
    origin: request.nextUrl.origin,
    hasSessionCookie: Boolean(token),
    hasSession: Boolean(session),
    hasCode: Boolean(code),
    hasStateParam: Boolean(state),
    hasStoredStateCookie: Boolean(storedState),
    stateMatches,
    stateParamPreview: summarizeValue(state),
    storedStatePreview: summarizeValue(storedState),
    stateCookieName,
    userAgent,
  });

  if (!session || !code || !state || !stateMatches) {
    console.warn("[google-callback] preflight-failed", {
      requestId,
      reason: {
        missingSession: !session,
        missingCode: !code,
        missingStateParam: !state,
        missingStoredStateCookie: !storedState,
        stateMismatch: Boolean(state && storedState && state !== storedState),
      },
      host: request.nextUrl.host,
      origin: request.nextUrl.origin,
      userAgent,
    });
    return response;
  }

  try {
    console.info("[google-callback] token-exchange-start", {
      requestId,
      host: request.nextUrl.host,
      origin: request.nextUrl.origin,
      userId: session.sub,
    });
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

    console.info("[google-callback] success", {
      requestId,
      host: request.nextUrl.host,
      origin: request.nextUrl.origin,
      userId: session.sub,
      email,
    });

    response.cookies.set({
      name: stateCookieName,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("[google-callback] token-exchange-failed", {
      requestId,
      host: request.nextUrl.host,
      origin: request.nextUrl.origin,
      userId: session.sub,
      message: error instanceof Error ? error.message : "unknown-error",
    });
    return NextResponse.redirect(buildConfigurationRedirect(request, "error"));
  }
}
