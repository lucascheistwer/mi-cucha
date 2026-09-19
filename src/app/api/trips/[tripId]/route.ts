import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { buildTripSummary } from "@/lib/trip-summary";
import { Trip } from "@/models/Trip";
import { TripExpense } from "@/models/TripExpense";
import { Household } from "@/models/Household";
import { User } from "@/models/User";
import type { TripDashboardPayload, TripExpenseListItem, HouseholdUserOption } from "@/types/trip";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());
  return response;
}

export async function GET(
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

    await dbConnect();

    const user = await User.findOne({ _id: session.sub }).lean();
    if (!user) {
      return getUnauthorizedResponse();
    }

    const trip = await Trip.findOne({
      _id: tripId,
      hogarId: user.hogarId,
    })
      .populate<{
        creadoPor: { _id: Types.ObjectId; nombre: string; username: string };
      }>("creadoPor", "nombre username _id")
      .lean();

    if (!trip) {
      return getUnauthorizedResponse();
    }

    const household = await Household.findOne({
      _id: user.hogarId,
    }).lean();

    if (!household) {
      return getUnauthorizedResponse();
    }

    const householdUsers = await User.find({
      hogarId: user.hogarId,
    })
      .select("nombre username _id")
      .lean();

    const expenses = await TripExpense.find({
      tripId,
    })
      .populate("pagadoPor", "nombre username _id")
      .sort({ fecha: -1 })
      .lean();

    const formattedUsers: HouseholdUserOption[] = householdUsers.map((u: any) => ({
      _id: u._id.toString(),
      nombre: u.nombre,
      username: u.username,
    }));

    const formattedExpenses: TripExpenseListItem[] = expenses.map((expense: any) => ({
      _id: expense._id.toString(),
      tripId: expense.tripId.toString(),
      hogarId: expense.hogarId.toString(),
      descripcion: expense.descripcion,
      monto: expense.monto,
      categoria: expense.categoria,
      ciudad: expense.ciudad,
      fecha: expense.fecha.toISOString(),
      pagadoPor: expense.pagadoPor._id.toString(),
      pagadoPorDetalle: {
        _id: expense.pagadoPor._id.toString(),
        nombre: expense.pagadoPor.nombre,
        username: expense.pagadoPor.username,
      },
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    }));

    const porcentajesDefecto = household.porcentajesDefecto ?? { user1: 50, user2: 50 };

    const payload: TripDashboardPayload = {
      trip: {
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
      },
      currentUserId: user._id.toString(),
      users: formattedUsers,
      expenses: formattedExpenses,
      porcentajesDefecto,
      summary: buildTripSummary({
        users: formattedUsers,
        expenses: formattedExpenses,
        percentages: porcentajesDefecto,
      }),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error fetching trip:", error);
    return NextResponse.json(
      { error: "Error al cargar el viaje" },
      { status: 500 }
    );
  }
}
