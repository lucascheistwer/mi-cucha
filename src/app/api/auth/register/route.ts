import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { dbConnect } from "@/lib/dbConnect";
import {
  createSessionToken,
  getSessionCookie,
  hashPassword,
  normalizeUsername,
  validatePassword,
} from "@/lib/auth";
import { Household } from "@/models/Household";
import { User } from "@/models/User";

export const runtime = "nodejs";

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

async function createHouseholdForUser(username: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await Household.create({
        nombre: `Mi cucha de ${username}`,
        codigoInvitacion: randomBytes(6).toString("hex").toUpperCase(),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("No pudimos generar un código único para el hogar.");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { username?: unknown; password?: unknown; inviteCode?: unknown }
      | null;
    const username = normalizeUsername(body?.username);
    const password = typeof body?.password === "string" ? body.password : null;
    const inviteCode =
      typeof body?.inviteCode === "string" ? body.inviteCode.trim().toUpperCase() : "";
    const passwordError = validatePassword(body?.password);

    if (!username) {
      return NextResponse.json(
        { error: "Usá un usuario de 3 a 30 caracteres con letras, números, punto, guion o guion bajo." },
        { status: 400 }
      );
    }

    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    await dbConnect();

    const existingUser = await User.exists({ username });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ese usuario ya existe." },
        { status: 409 }
      );
    }

    const household = inviteCode
      ? await Household.findOne({ codigoInvitacion: inviteCode }).select("_id").lean()
      : await createHouseholdForUser(username);

    if (!household) {
      return NextResponse.json(
        { error: "No encontramos una cucha con ese código de invitación." },
        { status: 404 }
      );
    }

    const shouldCleanupHousehold = !inviteCode;

    try {
      const passwordHash = await hashPassword(password as string);
      const user = await User.create({
        username,
        passwordHash,
        nombre: username,
        hogarId: household._id,
      });

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
    } catch (error) {
      if (shouldCleanupHousehold) {
        await Household.findByIdAndDelete(household._id);
      }

      if (isDuplicateKeyError(error)) {
        return NextResponse.json(
          { error: "Ese usuario ya existe." },
          { status: 409 }
        );
      }

      throw error;
    }
  } catch {
    return NextResponse.json(
      { error: "No pudimos crear tu cuenta en este momento." },
      { status: 500 }
    );
  }
}