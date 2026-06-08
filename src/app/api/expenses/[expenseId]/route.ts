import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { Expense } from "@/models/Expense";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());

  return response;
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