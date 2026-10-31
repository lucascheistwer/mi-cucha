import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { toTripDetail } from "@/lib/trip-format";
import { parseTripWriteInput } from "@/lib/trip-input";
import { Trip } from "@/models/Trip";
import { Household } from "@/models/Household";
import { User } from "@/models/User";
import type { TripDetail } from "@/types/trip";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
      return getUnauthorizedResponse();
    }

    await dbConnect();

    const user = await User.findOne({ _id: session.sub }).lean();
    if (!user) {
      return getUnauthorizedResponse();
    }

    const household = await Household.findOne({
      _id: user.hogarId,
    }).lean();

    if (!household) {
      return getUnauthorizedResponse();
    }

    const trips = await Trip.find({
      hogarId: household._id,
    })
      .populate("creadoPor", "nombre username _id")
      .sort({ createdAt: -1 })
      .lean();

    const formattedTrips: TripDetail[] = [];

    for (const trip of trips) {
      const detail = toTripDetail(trip);

      if (!detail) {
        return NextResponse.json({ error: "Error al cargar los viajes" }, { status: 500 });
      }

      formattedTrips.push(detail);
    }

    return NextResponse.json({
      trips: formattedTrips,
    });
  } catch (error) {
    console.error("Error fetching trips:", error);
    return NextResponse.json(
      { error: "Error al cargar los viajes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
      return getUnauthorizedResponse();
    }

    const parsed = parseTripWriteInput(await request.json().catch(() => null));

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await dbConnect();

    const user = await User.findOne({ _id: session.sub }).lean();
    if (!user) {
      return getUnauthorizedResponse();
    }

    const trip = await Trip.create({
      hogarId: user.hogarId,
      nombre: parsed.value.nombre,
      descripcion: parsed.value.descripcion,
      fechaInicio: parsed.value.fechaInicio,
      fechaFin: parsed.value.fechaFin,
      ciudades: parsed.value.ciudades,
      estado: "activo",
      creadoPor: user._id,
    });

    const createdTrip = await trip.populate<{
      creadoPor: { _id: Types.ObjectId; nombre: string; username: string };
    }>("creadoPor", "nombre username _id");

    const formattedTrip = toTripDetail(createdTrip);

    if (!formattedTrip) {
      return NextResponse.json({ error: "Error al crear el viaje" }, { status: 500 });
    }

    return NextResponse.json({ trip: formattedTrip }, { status: 201 });
  } catch (error) {
    console.error("Error creating trip:", error);
    return NextResponse.json(
      { error: "Error al crear el viaje" },
      { status: 500 }
    );
  }
}
