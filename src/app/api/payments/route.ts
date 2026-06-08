import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { getMonthKey } from "@/lib/date-helpers";
import {
  buildMonthlyDashboardPayload,
  isValidMonthKey,
  syncHistorySnapshot,
} from "@/lib/monthly-dashboard";
import { History } from "@/models/History";
import { Household } from "@/models/Household";
import { Payment } from "@/models/Payment";
import { User } from "@/models/User";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());

  return response;
}

async function parseJson<T>(request: NextRequest) {
  return (await request.json().catch(() => null)) as T | null;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return getUnauthorizedResponse();
  }

  const body = await parseJson<{
    fromUserId?: string;
    toUserId?: string;
    monto?: number;
    fecha?: string;
    mesLiquidacion?: string;
  }>(request);
  const fromUserId = body?.fromUserId?.trim() ?? "";
  const toUserId = body?.toUserId?.trim() ?? "";
  const monthKey = body?.mesLiquidacion?.trim() ?? "";
  const fecha = body?.fecha ? new Date(body.fecha) : new Date();
  const monto = Number(body?.monto);

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

  if (!isValidMonthKey(monthKey) || Number.isNaN(fecha.getTime())) {
    return NextResponse.json(
      { error: "Revisá el mes del resumen y la fecha del pago." },
      { status: 400 }
    );
  }

  await dbConnect();

  const household = await Household.findById(session.hogarId)
    .select("_id mesActivo")
    .lean();

  if (!household) {
    return NextResponse.json(
      { error: "No encontramos tu cucha actual." },
      { status: 404 }
    );
  }

  const activeMonth = household.mesActivo ?? getMonthKey(new Date());
  const canUseMonth =
    monthKey === activeMonth ||
    Boolean(
      await History.exists({
        hogarId: session.hogarId,
        mesLiquidacion: monthKey,
      })
    );

  if (!canUseMonth) {
    return NextResponse.json(
      {
        error:
          "Solo podés cargar pagos en el mes activo o en un mes ya finalizado.",
      },
      { status: 400 }
    );
  }

  const payloadResult = await buildMonthlyDashboardPayload({
    hogarId: session.hogarId,
    currentUserId: session.sub,
    requestedMonth: monthKey,
  });

  if (!payloadResult.ok) {
    return NextResponse.json(
      { error: payloadResult.error },
      { status: payloadResult.status }
    );
  }

  const outstandingDebt = payloadResult.payload.summary.activeDebt.settlement;

  if (!outstandingDebt) {
    return NextResponse.json(
      { error: "Ese resumen ya no tiene deuda pendiente para cancelar." },
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
          "El pago tiene que respetar la dirección de la deuda pendiente del resumen.",
      },
      { status: 400 }
    );
  }

  if (monto > outstandingDebt.amount) {
    return NextResponse.json(
      {
        error:
          "El pago no puede superar la deuda pendiente que figura en el resumen.",
      },
      { status: 400 }
    );
  }

  const users = await User.find({
    _id: { $in: [fromUserId, toUserId] },
    hogarId: session.hogarId,
  })
    .select("_id nombre username")
    .lean();

  if (users.length !== 2) {
    return NextResponse.json(
      { error: "Las personas seleccionadas no pertenecen a esta cucha." },
      { status: 400 }
    );
  }

  const payment = await Payment.create({
    hogarId: session.hogarId,
    fromUserId,
    toUserId,
    monto: Number(monto.toFixed(2)),
    fecha,
    mesLiquidacion: monthKey,
  });

  const updatedPayloadResult = await buildMonthlyDashboardPayload({
    hogarId: session.hogarId,
    currentUserId: session.sub,
    requestedMonth: monthKey,
  });

  if (updatedPayloadResult.ok) {
    await syncHistorySnapshot({
      hogarId: session.hogarId,
      monthKey,
      payload: updatedPayloadResult.payload,
      ensureExists: false,
    });
  }

  const userMap = new Map(
    users.map((user) => [
      user._id.toString(),
      {
        _id: user._id.toString(),
        nombre: user.nombre,
        username: user.username,
      },
    ])
  );

  return NextResponse.json(
    {
      payment: {
        _id: payment._id.toString(),
        hogarId: payment.hogarId.toString(),
        fromUserId: payment.fromUserId.toString(),
        toUserId: payment.toUserId.toString(),
        monto: payment.monto,
        fecha: payment.fecha.toISOString(),
        mesLiquidacion: payment.mesLiquidacion,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
        fromUser: userMap.get(payment.fromUserId.toString()) ?? null,
        toUser: userMap.get(payment.toUserId.toString()) ?? null,
      },
    },
    { status: 201 }
  );
}