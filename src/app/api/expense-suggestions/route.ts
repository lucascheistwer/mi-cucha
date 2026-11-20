// Ubicacion: src/app/api/expense-suggestions/route.ts
// Plantillas de carga para el mes activo, armadas con los gastos que pagó la persona logueada.
import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { getMonthKey } from "@/lib/date-helpers";
import {
  buildExpenseSuggestions,
  getSuggestionHistoryStart,
  type ExpenseSuggestionsResponse,
  type SuggestionExpenseInput,
} from "@/lib/expense-suggestions";
import { Expense } from "@/models/Expense";
import { Household } from "@/models/Household";

export const runtime = "nodejs";

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());

  return response;
}

function emptyResponse(activeMonth: string): ExpenseSuggestionsResponse {
  return {
    activeMonth,
    monthStart: [],
    frequent: [],
    autocomplete: [],
  };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return getUnauthorizedResponse();
  }

  await dbConnect();

  const household = await Household.findById(session.hogarId).select("_id mesActivo").lean();

  if (!household) {
    return NextResponse.json({ error: "No encontramos tu cucha actual." }, { status: 404 });
  }

  const activeMonth =
    household.mesActivo && MONTH_KEY_PATTERN.test(household.mesActivo)
      ? household.mesActivo
      : getMonthKey(new Date());
  const historyStart = getSuggestionHistoryStart(activeMonth);

  if (!historyStart) {
    return NextResponse.json(emptyResponse(activeMonth));
  }

  const expenses = await Expense.find({
    hogarId: session.hogarId,
    pagadoPor: session.sub,
    mesLiquidacion: { $gte: historyStart, $lte: activeMonth },
  })
    .select("descripcion monto categoria fecha pagadoPor mesLiquidacion")
    .sort({ mesLiquidacion: 1, fecha: 1, createdAt: 1 })
    .lean();

  const history: SuggestionExpenseInput[] = expenses.map((expense) => ({
    descripcion: expense.descripcion,
    monto: expense.monto,
    categoria: expense.categoria,
    fecha: expense.fecha.toISOString(),
    pagadoPor: expense.pagadoPor.toString(),
    mesLiquidacion: expense.mesLiquidacion,
  }));
  const suggestions = buildExpenseSuggestions({
    expenses: history,
    activeMonth,
    userId: session.sub,
  });

  return NextResponse.json({
    activeMonth,
    ...suggestions,
  });
}
