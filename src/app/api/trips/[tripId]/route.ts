import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { toHouseholdUser, toTripDetail } from "@/lib/trip-format";
import { parseTripWriteInput, resolveTripCities } from "@/lib/trip-input";
import { buildTripSummary } from "@/lib/trip-summary";
import { Trip } from "@/models/Trip";
import { TripExpense } from "@/models/TripExpense";
import { TripPayment } from "@/models/TripPayment";
import { Household } from "@/models/Household";
import { User } from "@/models/User";
import type {
  TripDashboardPayload,
  TripExpenseListItem,
  TripPaymentListItem,
  HouseholdUserOption,
} from "@/types/trip";

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

    const payments = await TripPayment.find({
      tripId,
    })
      .populate("fromUserId", "nombre username _id")
      .populate("toUserId", "nombre username _id")
      .sort({ fecha: -1 })
      .lean();

    const formattedUsers: HouseholdUserOption[] = [];

    for (const householdUser of householdUsers) {
      const option = toHouseholdUser(householdUser);

      if (!option) {
        return NextResponse.json({ error: "Error al cargar el viaje" }, { status: 500 });
      }

      formattedUsers.push(option);
    }

    const formattedExpenses: TripExpenseListItem[] = [];

    for (const expense of expenses) {
      const payer = toHouseholdUser(expense.pagadoPor);

      if (!payer) {
        return NextResponse.json({ error: "Error al cargar el viaje" }, { status: 500 });
      }

      formattedExpenses.push({
        _id: expense._id.toString(),
        tripId: expense.tripId.toString(),
        hogarId: expense.hogarId.toString(),
        descripcion: expense.descripcion,
        monto: expense.monto,
        categoria: expense.categoria,
        ciudad: expense.ciudad,
        fecha: expense.fecha.toISOString(),
        pagadoPor: payer._id,
        pagadoPorDetalle: payer,
        createdAt: expense.createdAt.toISOString(),
        updatedAt: expense.updatedAt.toISOString(),
      });
    }

    const formattedPayments: TripPaymentListItem[] = [];

    for (const payment of payments) {
      const fromUser = toHouseholdUser(payment.fromUserId);
      const toUser = toHouseholdUser(payment.toUserId);

      if (!fromUser || !toUser) {
        return NextResponse.json({ error: "Error al cargar el viaje" }, { status: 500 });
      }

      formattedPayments.push({
        _id: payment._id.toString(),
        tripId: payment.tripId.toString(),
        hogarId: payment.hogarId.toString(),
        fromUserId: fromUser._id,
        toUserId: toUser._id,
        monto: payment.monto,
        fecha: payment.fecha.toISOString(),
        fromUser,
        toUser,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      });
    }

    const porcentajesDefecto = household.porcentajesDefecto ?? { user1: 50, user2: 50 };

    const tripDetail = toTripDetail(trip);

    if (!tripDetail) {
      return NextResponse.json({ error: "Error al cargar el viaje" }, { status: 500 });
    }

    const payload: TripDashboardPayload = {
      trip: tripDetail,
      currentUserId: user._id.toString(),
      users: formattedUsers,
      expenses: formattedExpenses,
      payments: formattedPayments,
      porcentajesDefecto,
      summary: buildTripSummary({
        users: formattedUsers,
        expenses: formattedExpenses,
        payments: formattedPayments,
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

export async function PATCH(
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

    const parsed = parseTripWriteInput(await request.json().catch(() => null));

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
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

    const expenseCities = await TripExpense.distinct("ciudad", {
      tripId: trip._id,
      hogarId: user.hogarId,
    });
    const resolvedCities = resolveTripCities(
      trip.ciudades,
      parsed.value.ciudades,
      expenseCities.filter((city): city is string => typeof city === "string")
    );

    if (!resolvedCities.ok) {
      return NextResponse.json({ error: resolvedCities.error }, { status: 409 });
    }

    trip.nombre = parsed.value.nombre;
    trip.descripcion = parsed.value.descripcion;
    trip.fechaInicio = parsed.value.fechaInicio;
    trip.fechaFin = parsed.value.fechaFin;
    trip.ciudades = resolvedCities.ciudades;
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
    console.error("Error updating trip:", error);
    return NextResponse.json({ error: "Error al actualizar el viaje" }, { status: 500 });
  }
}
