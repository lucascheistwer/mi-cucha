// Ubicacion: src/app/api/auth/logout/route.ts
// Cierra la sesion borrando la cookie HttpOnly. No consulta la base.

import { NextResponse } from "next/server";

import { getExpiredSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getExpiredSessionCookie());

  return response;
}
