import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { getMonthKey, parseDateInputValue } from "@/lib/date-helpers";
import {
  EXPENSE_CATEGORY_VALUES,
  isExpenseCategoryValue,
} from "@/lib/expense-categories";
import { buildMonthlyDashboardPayload } from "@/lib/monthly-dashboard";
import { Expense } from "@/models/Expense";
import { Household } from "@/models/Household";
import { User } from "@/models/User";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());

  return response;
}

function normalizeEnabledCategories(value: string[] | undefined) {
  const normalizedValues = value?.filter(isExpenseCategoryValue) ?? [];

  return normalizedValues.length > 0 ? normalizedValues : [...EXPENSE_CATEGORY_VALUES];
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return getUnauthorizedResponse();
  }

  await dbConnect();

  const result = await buildMonthlyDashboardPayload({
    hogarId: session.hogarId,
    currentUserId: session.sub,
    requestedMonth: request.nextUrl.searchParams.get("mesLiquidacion"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.payload);
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return getUnauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as
    | {
        descripcion?: string;
        monto?: number;
        categoria?: string;
        fecha?: string;
        pagadoPor?: string;
      }
    | null;

  const descripcion = body?.descripcion?.trim();
  const categoria = body?.categoria?.trim();
  const rawFecha = body?.fecha?.trim();
  const fecha = rawFecha ? parseDateInputValue(rawFecha) : new Date();
  const monto = Number(body?.monto);
  const pagadoPor = body?.pagadoPor?.trim();

  if (!descripcion || descripcion.length < 2 || descripcion.length > 200) {
    return NextResponse.json(
      { error: "La descripción debe tener entre 2 y 200 caracteres." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json(
      { error: "El monto debe ser un número mayor a cero." },
      { status: 400 }
    );
  }

  if (!categoria || !isExpenseCategoryValue(categoria)) {
    return NextResponse.json(
      { error: "Elegí una categoría para el gasto." },
      { status: 400 }
    );
  }

  if (!pagadoPor || !fecha || Number.isNaN(fecha.getTime())) {
    return NextResponse.json(
      { error: "Revisá la fecha y quién pagó el gasto." },
      { status: 400 }
    );
  }

  await dbConnect();

  const household = await Household.findById(session.hogarId)
    .select("_id categoriasHabilitadas mesActivo")
    .lean();

  if (!household) {
    return NextResponse.json(
      { error: "No encontramos tu cucha actual." },
      { status: 404 }
    );
  }

  const enabledCategories = normalizeEnabledCategories(household.categoriasHabilitadas);

  if (!enabledCategories.includes(categoria)) {
    return NextResponse.json(
      { error: "Esa categoría ya no está habilitada en la configuración actual." },
      { status: 400 }
    );
  }

  const activeMonth = household.mesActivo ?? getMonthKey(new Date());
  const expenseMonth = rawFecha ? getMonthKey(rawFecha) : getMonthKey(fecha);

  if (expenseMonth !== activeMonth) {
    return NextResponse.json(
      {
        error: `La fecha del gasto tiene que pertenecer al mes activo ${activeMonth}.`,
      },
      { status: 400 }
    );
  }

  const payer = await User.findOne({
    _id: pagadoPor,
    hogarId: session.hogarId,
  })
    .select("_id nombre username")
    .lean();

  if (!payer) {
    return NextResponse.json(
      { error: "El usuario seleccionado no pertenece a este hogar." },
      { status: 400 }
    );
  }

  const expense = await Expense.create({
    hogarId: session.hogarId,
    descripcion,
    monto,
    categoria,
    fecha,
    pagadoPor: payer._id,
    mesLiquidacion: activeMonth,
  });

  return NextResponse.json(
    {
      expense: {
        _id: expense._id.toString(),
        hogarId: expense.hogarId.toString(),
        descripcion: expense.descripcion,
        monto: expense.monto,
        categoria: expense.categoria,
        fecha: expense.fecha.toISOString(),
        pagadoPor: expense.pagadoPor.toString(),
        mesLiquidacion: expense.mesLiquidacion,
        createdAt: expense.createdAt.toISOString(),
        updatedAt: expense.updatedAt.toISOString(),
        pagadoPorDetalle: {
          _id: payer._id.toString(),
          nombre: payer.nombre,
          username: payer.username,
        },
      },
    },
    { status: 201 }
  );
}
