// Ubicacion: src/app/api/auth/login/route.ts
// Login MVP por username. Si el usuario existe, emite una cookie HttpOnly con JWT por 1 anio.

import { NextRequest, NextResponse } from "next/server";

import { dbConnect } from "@/lib/dbConnect";
import {
  createSessionToken,
  getSessionCookie,
  normalizeUsername,
  validatePassword,
  verifyPassword,
} from "@/lib/auth";
import { User } from "@/models/User";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { username?: unknown; password?: unknown }
      | null;
    const username = normalizeUsername(body?.username);
    const password = typeof body?.password === "string" ? body.password : null;
    const passwordError = validatePassword(body?.password);

    if (!username) {
      return NextResponse.json(
        { error: "Ingresá un usuario válido." },
        { status: 400 }
      );
    }

    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    await dbConnect();

    const user = await User.findOne({ username })
      .select("_id username nombre hogarId passwordHash")
      .lean();

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const isPasswordValid = await verifyPassword(password as string, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const token = createSessionToken({
      userId: user._id.toString(),
      username: user.username,
      hogarId: user.hogarId.toString(),
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        _id: user._id.toString(),
        username: user.username,
        nombre: user.nombre,
        hogarId: user.hogarId.toString(),
      },
    });

    response.cookies.set(getSessionCookie(token));

    return response;
  } catch {
    return NextResponse.json(
      { error: "No se pudo iniciar sesión en este momento." },
      { status: 500 }
    );
  }
}