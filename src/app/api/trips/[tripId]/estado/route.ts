import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { toTripDetail } from "@/lib/trip-format";
import { isTripEstado } from "@/lib/trip-input";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());

  return response;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
      return getUnauthorizedResponse();
    }

    if (!Types.ObjectId.isValid(tripId)) {
      return NextResponse.json({ error: "El viaje no es válido." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { estado?: unknown } | null;

    if (!isTripEstado(body?.estado)) {
      return NextResponse.json({ error: "El estado del viaje no es válido." }, { status: 400 });
    }

    await dbConnect();

    const user = await User.findOne({ _id: session.sub }).lean();
    if (!user) {
      return getUnauthorizedResponse();
    }

    const trip = await Trip.findOne({
      _id: tripId,
      hogarId: user.hogarId,
    });

    if (!trip) {
      return getUnauthorizedResponse();
    }

    trip.estado = body.estado;
    await trip.save();

    const populatedTrip = await trip.populate<{
      creadoPor: { _id: Types.ObjectId; nombre: string; username: string };
    }>("creadoPor", "nombre username _id");
    const detail = toTripDetail(populatedTrip);

    if (!detail) {
      return NextResponse.json({ error: "Error al actualizar el viaje" }, { status: 500 });
    }

    return NextResponse.json({ trip: detail });
  } catch (error) {
    console.error("Error updating trip status:", error);
    return NextResponse.json({ error: "Error al actualizar el viaje" }, { status: 500 });
  }
}
