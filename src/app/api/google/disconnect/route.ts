import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  getExpiredSessionCookie,
  verifySessionToken,
} from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { Household } from "@/models/Household";
import { User } from "@/models/User";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());

  return response;
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return getUnauthorizedResponse();
  }

  await dbConnect();

  await User.findByIdAndUpdate(session.sub, {
    $unset: {
      googleAuth: 1,
    },
  });

  await Household.findByIdAndUpdate(session.hogarId, {
    $set: {
      "googleSheets.lastExportError": "La conexión de Google fue removida.",
    },
    $unset: {
      "googleSheets.exportOwnerUserId": 1,
    },
  });

  return NextResponse.json({ ok: true });
}
