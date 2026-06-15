import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { getMonthKey, parseDateInputValue } from "@/lib/date-helpers";
import { isExpenseCategoryValue } from "@/lib/expense-categories";
import { Household } from "@/models/Household";
import { Expense } from "@/models/Expense";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());

  return response;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ expenseId: string }> }
) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return getUnauthorizedResponse();
  }

  const { expenseId } = await context.params;

  if (!Types.ObjectId.isValid(expenseId)) {
    return NextResponse.json({ error: "El gasto no es válido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        descripcion?: string;
        monto?: number;
        categoria?: string;
        fecha?: string;
      }
    | null;

  const descripcion = body?.descripcion?.trim();
  const monto = Number(body?.monto);
  const categoria = body?.categoria?.trim();
  const rawFecha = body?.fecha?.trim();
  const fecha = rawFecha ? parseDateInputValue(rawFecha) : null;

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

  if (!fecha || Number.isNaN(fecha.getTime())) {
    return NextResponse.json(
      { error: "Revisá la fecha del gasto." },
      { status: 400 }
    );
  }

  await dbConnect();

  const existingExpense = await Expense.findOne({
    _id: expenseId,
    hogarId: session.hogarId,
  });

  if (!existingExpense) {
    return NextResponse.json({ error: "No encontramos ese gasto." }, { status: 404 });
  }

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
  const expenseMonth = existingExpense.mesLiquidacion;

  if (expenseMonth !== activeMonth) {
    return NextResponse.json(
      {
        error: `Solo podés editar gastos del mes activo ${activeMonth}.`,
      },
      { status: 400 }
    );
  }

  const updatedExpenseMonth = getMonthKey(fecha);

  if (updatedExpenseMonth !== activeMonth) {
    return NextResponse.json(
      {
        error: `La fecha del gasto tiene que pertenecer al mes activo ${activeMonth}.`,
      },
      { status: 400 }
    );
  }

  existingExpense.descripcion = descripcion;
  existingExpense.monto = Number(monto.toFixed(2));
  existingExpense.categoria = categoria;
  existingExpense.fecha = fecha;
  existingExpense.mesLiquidacion = updatedExpenseMonth;
  await existingExpense.save();

  return NextResponse.json({
    expense: {
      _id: existingExpense._id.toString(),
      hogarId: existingExpense.hogarId.toString(),
      descripcion: existingExpense.descripcion,
      monto: existingExpense.monto,
      categoria: existingExpense.categoria,
      fecha: existingExpense.fecha.toISOString(),
      pagadoPor: existingExpense.pagadoPor.toString(),
      mesLiquidacion: existingExpense.mesLiquidacion,
      createdAt: existingExpense.createdAt.toISOString(),
      updatedAt: existingExpense.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ expenseId: string }> }
) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return getUnauthorizedResponse();
  }

  const { expenseId } = await context.params;

  if (!Types.ObjectId.isValid(expenseId)) {
    return NextResponse.json({ error: "El gasto no es válido." }, { status: 400 });
  }

  await dbConnect();

  const deletedExpense = await Expense.findOneAndDelete({
    _id: expenseId,
    hogarId: session.hogarId,
  });

  if (!deletedExpense) {
    return NextResponse.json({ error: "No encontramos ese gasto." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, expenseId });
}
