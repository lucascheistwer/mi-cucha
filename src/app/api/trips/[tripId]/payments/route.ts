import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { parseDateInputValue } from "@/lib/date-helpers";
import { buildTripSummary } from "@/lib/trip-summary";
import { Household } from "@/models/Household";
import { Trip } from "@/models/Trip";
import { TripExpense } from "@/models/TripExpense";
import { TripPayment } from "@/models/TripPayment";
import { User } from "@/models/User";
import type { TripPaymentListItem } from "@/types/trip";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());

  return response;
}

async function parseJson<T>(request: NextRequest) {
  return (await request.json().catch(() => null)) as T | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return getUnauthorizedResponse();
  }

  if (!Types.ObjectId.isValid(tripId)) {
    return NextResponse.json({ error: "El viaje no es válido." }, { status: 400 });
  }

  const body = await parseJson<{
    fromUserId?: string;
    toUserId?: string;
    monto?: number;
    fecha?: string;
  }>(request);
  const fromUserId = body?.fromUserId?.trim() ?? "";
  const toUserId = body?.toUserId?.trim() ?? "";
  const rawFecha = body?.fecha?.trim();
  const fecha = rawFecha ? parseDateInputValue(rawFecha) : new Date();
  const monto = Math.round(Number(body?.monto));

  if (!Types.ObjectId.isValid(fromUserId) || !Types.ObjectId.isValid(toUserId)) {
    return NextResponse.json(
      { error: "Elegí dos personas válidas para registrar el pago." },
      { status: 400 }
    );
  }

  if (fromUserId === toUserId) {
    return NextResponse.json(
      { error: "El pago debe registrarse entre dos personas distintas." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json(
      { error: "El monto del pago debe ser mayor a cero." },
      { status: 400 }
    );
  }

  if (!fecha || Number.isNaN(fecha.getTime())) {
    return NextResponse.json(
      { error: "Revisá la fecha del pago." },
      { status: 400 }
    );
  }

  await dbConnect();

  const user = await User.findOne({ _id: session.sub }).lean();
  if (!user) {
    return getUnauthorizedResponse();
  }

  const trip = await Trip.findOne({
    _id: tripId,
    hogarId: user.hogarId,
  }).lean();

  if (!trip) {
    return getUnauthorizedResponse();
  }

  const household = await Household.findOne({
    _id: user.hogarId,
  }).lean();

  if (!household) {
    return NextResponse.json(
      { error: "No encontramos tu cucha actual." },
      { status: 404 }
    );
  }

  const householdUsers = await User.find({
    hogarId: user.hogarId,
  })
    .select("_id nombre username")
    .lean();

  const users = householdUsers.map((householdUser) => ({
    _id: householdUser._id.toString(),
    nombre: householdUser.nombre,
    username: householdUser.username,
  }));

  const [existingExpenses, existingPayments] = await Promise.all([
    TripExpense.find({ tripId }).select("pagadoPor monto").lean(),
    TripPayment.find({ tripId }).select("fromUserId toUserId monto").lean(),
  ]);

  const porcentajesDefecto = household.porcentajesDefecto ?? { user1: 50, user2: 50 };

  const summary = buildTripSummary({
    users,
    expenses: existingExpenses.map((expense) => ({
      pagadoPor: expense.pagadoPor.toString(),
      monto: expense.monto,
    })),
    payments: existingPayments.map((payment) => ({
      fromUserId: payment.fromUserId.toString(),
      toUserId: payment.toUserId.toString(),
      monto: payment.monto,
    })),
    percentages: porcentajesDefecto,
  });

  const outstandingDebt = summary.activeDebt.settlement;

  if (!outstandingDebt) {
    return NextResponse.json(
      { error: "Este viaje ya no tiene deuda pendiente para cancelar." },
      { status: 400 }
    );
  }

  if (
    outstandingDebt.fromUserId !== fromUserId ||
    outstandingDebt.toUserId !== toUserId
  ) {
    return NextResponse.json(
      {
        error:
          "El pago tiene que respetar la dirección de la deuda pendiente del viaje.",
      },
      { status: 400 }
    );
  }

  if (monto > outstandingDebt.amount) {
    return NextResponse.json(
      {
        error:
          "El pago no puede superar la deuda pendiente que figura en el viaje.",
      },
      { status: 400 }
    );
  }

  const payingUsers = await User.find({
    _id: { $in: [fromUserId, toUserId] },
    hogarId: user.hogarId,
  })
    .select("_id nombre username")
    .lean();

  if (payingUsers.length !== 2) {
    return NextResponse.json(
      { error: "Las personas seleccionadas no pertenecen a esta cucha." },
      { status: 400 }
    );
  }

  const payment = await TripPayment.create({
    tripId,
    hogarId: user.hogarId,
    fromUserId,
    toUserId,
    monto,
    fecha,
  });

  const userMap = new Map(
    payingUsers.map((payingUser) => [
      payingUser._id.toString(),
      {
        _id: payingUser._id.toString(),
        nombre: payingUser.nombre,
        username: payingUser.username,
      },
    ])
  );

  const formattedPayment: TripPaymentListItem = {
    _id: payment._id.toString(),
    tripId: payment.tripId.toString(),
    hogarId: payment.hogarId.toString(),
    fromUserId: payment.fromUserId.toString(),
    toUserId: payment.toUserId.toString(),
    monto: payment.monto,
    fecha: payment.fecha.toISOString(),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    fromUser: userMap.get(payment.fromUserId.toString()) ?? null,
    toUser: userMap.get(payment.toUserId.toString()) ?? null,
  };

  return NextResponse.json({ payment: formattedPayment }, { status: 201 });
}
