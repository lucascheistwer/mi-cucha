import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
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

    const formattedTrips: TripDetail[] = trips.map((trip: any) => ({
      _id: trip._id.toString(),
      hogarId: trip.hogarId.toString(),
      nombre: trip.nombre,
      descripcion: trip.descripcion,
      fechaInicio: trip.fechaInicio.toISOString().split("T")[0],
      fechaFin: trip.fechaFin.toISOString().split("T")[0],
      ciudades: trip.ciudades,
      estado: trip.estado,
      creadoPor: trip.creadoPor._id.toString(),
      creadoPorDetalle: {
        _id: trip.creadoPor._id.toString(),
        nombre: trip.creadoPor.nombre,
        username: trip.creadoPor.username,
      },
      createdAt: trip.createdAt.toISOString(),
      updatedAt: trip.updatedAt.toISOString(),
    }));

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

    const body = await request.json();
    const { nombre, descripcion, fechaInicio, fechaFin, ciudades } = body;

    if (!nombre || !fechaInicio || !fechaFin || !ciudades || ciudades.length === 0) {
      return NextResponse.json(
        { error: "Faltan datos requeridos" },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findOne({ _id: session.sub }).lean();
    if (!user) {
      return getUnauthorizedResponse();
    }

    const trip = await Trip.create({
      hogarId: user.hogarId,
      nombre,
      descripcion: descripcion || "",
      fechaInicio: new Date(fechaInicio),
      fechaFin: new Date(fechaFin),
      ciudades,
      estado: "activo",
      creadoPor: user._id,
    });

    const createdTrip = await trip.populate<{
      creadoPor: { _id: Types.ObjectId; nombre: string; username: string };
    }>("creadoPor", "nombre username _id");

    const formattedTrip: TripDetail = {
      _id: createdTrip._id.toString(),
      hogarId: createdTrip.hogarId.toString(),
      nombre: createdTrip.nombre,
      descripcion: createdTrip.descripcion,
      fechaInicio: createdTrip.fechaInicio.toISOString().split("T")[0],
      fechaFin: createdTrip.fechaFin.toISOString().split("T")[0],
      ciudades: createdTrip.ciudades,
      estado: createdTrip.estado,
      creadoPor: createdTrip.creadoPor._id.toString(),
      creadoPorDetalle: {
        _id: createdTrip.creadoPor._id.toString(),
        nombre: createdTrip.creadoPor.nombre,
        username: createdTrip.creadoPor.username,
      },
      createdAt: createdTrip.createdAt.toISOString(),
      updatedAt: createdTrip.updatedAt.toISOString(),
    };

    return NextResponse.json({ trip: formattedTrip }, { status: 201 });
  } catch (error) {
    console.error("Error creating trip:", error);
    return NextResponse.json(
      { error: "Error al crear el viaje" },
      { status: 500 }
    );
  }
}
