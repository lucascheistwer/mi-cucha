// Ubicacion: src/app/api/auth/me/route.ts
// Devuelve el usuario autenticado actual para hidratar el frontend.

import { NextRequest, NextResponse } from "next/server";

import { dbConnect } from "@/lib/dbConnect";
import {
  AUTH_COOKIE_NAME,
  getExpiredSessionCookie,
  verifySessionToken,
} from "@/lib/auth";
import { User } from "@/models/User";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const session = verifySessionToken(token);

  if (!session) {
    const response = NextResponse.json({ user: null }, { status: 401 });
    response.cookies.set(getExpiredSessionCookie());

    return response;
  }

  await dbConnect();

  const user = await User.findById(session.sub)
    .select("_id username nombre hogarId")
    .lean();

  if (!user) {
    const response = NextResponse.json({ user: null }, { status: 401 });
    response.cookies.set(getExpiredSessionCookie());

    return response;
  }

  return NextResponse.json({
    user: {
      _id: user._id.toString(),
      username: user.username,
      nombre: user.nombre,
      hogarId: user.hogarId.toString(),
    },
  });
}