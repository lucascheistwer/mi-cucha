import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { parseDateInputValue } from "@/lib/date-helpers";
import { isTripExpenseCategoryValue } from "@/lib/trip-expense-categories";
import { TripExpense } from "@/models/TripExpense";
import { User } from "@/models/User";
import type { TripExpenseListItem } from "@/types/trip";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());
  return response;
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ tripId: string; expenseId: string }> }
) {
  try {
    const { tripId, expenseId } = await params;
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
      return getUnauthorizedResponse();
    }

    if (!Types.ObjectId.isValid(expenseId)) {
      return NextResponse.json({ error: "El gasto no es válido." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as
      | {
          descripcion?: string;
          monto?: number;
          categoria?: string;
          ciudad?: string;
          fecha?: string;
          pagadoPor?: string;
        }
      | null;

    const descripcion = body?.descripcion?.trim();
    const monto = Number(body?.monto);
    const categoria = body?.categoria?.trim();
    const ciudad = body?.ciudad?.trim();
    const rawFecha = body?.fecha?.trim();
    const fecha = rawFecha ? parseDateInputValue(rawFecha) : null;
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

    if (!categoria || !isTripExpenseCategoryValue(categoria)) {
      return NextResponse.json(
        { error: "Elegí una categoría para el gasto." },
        { status: 400 }
      );
    }

    if (!ciudad || ciudad.length < 2) {
      return NextResponse.json(
        { error: "Elegí una ciudad para el gasto." },
        { status: 400 }
      );
    }

    if (!fecha || Number.isNaN(fecha.getTime())) {
      return NextResponse.json(
        { error: "Revisá la fecha del gasto." },
        { status: 400 }
      );
    }

    if (!pagadoPor || !Types.ObjectId.isValid(pagadoPor)) {
      return NextResponse.json(
        { error: "Elegí quién pagó el gasto." },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findOne({ _id: session.sub }).lean();
    if (!user) {
      return getUnauthorizedResponse();
    }

    const expense = await TripExpense.findOne({
      _id: expenseId,
      tripId,
      hogarId: user.hogarId,
    });

    if (!expense) {
      return NextResponse.json({ error: "No encontramos ese gasto." }, { status: 404 });
    }

    const payer = await User.findOne({ _id: pagadoPor, hogarId: user.hogarId }).lean();

    if (!payer) {
      return NextResponse.json(
        { error: "Elegí quién pagó el gasto." },
        { status: 400 }
      );
    }

    expense.descripcion = descripcion;
    expense.monto = Number(monto.toFixed(2));
    expense.categoria = categoria;
    expense.ciudad = ciudad;
    expense.fecha = fecha;
    expense.pagadoPor = new Types.ObjectId(pagadoPor);
    await expense.save();

    const updatedExpense = await expense.populate<{
      pagadoPor: { _id: Types.ObjectId; nombre: string; username: string };
    }>("pagadoPor", "nombre username _id");

    const formattedExpense: TripExpenseListItem = {
      _id: updatedExpense._id.toString(),
      tripId: updatedExpense.tripId.toString(),
      hogarId: updatedExpense.hogarId.toString(),
      descripcion: updatedExpense.descripcion,
      monto: updatedExpense.monto,
      categoria: updatedExpense.categoria,
      ciudad: updatedExpense.ciudad,
      fecha: updatedExpense.fecha.toISOString(),
      pagadoPor: updatedExpense.pagadoPor._id.toString(),
      pagadoPorDetalle: {
        _id: updatedExpense.pagadoPor._id.toString(),
        nombre: updatedExpense.pagadoPor.nombre,
        username: updatedExpense.pagadoPor.username,
      },
      createdAt: updatedExpense.createdAt.toISOString(),
      updatedAt: updatedExpense.updatedAt.toISOString(),
    };

    return NextResponse.json({ expense: formattedExpense });
  } catch (error) {
    console.error("Error updating trip expense:", error);
    return NextResponse.json(
      { error: "Error al actualizar el gasto" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ tripId: string; expenseId: string }> }
) {
  try {
    const { expenseId } = await params;
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

    const expense = await TripExpense.findOne({
      _id: expenseId,
      hogarId: user.hogarId,
    });

    if (!expense) {
      return getUnauthorizedResponse();
    }

    await TripExpense.deleteOne({ _id: expenseId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting trip expense:", error);
    return NextResponse.json(
      { error: "Error al eliminar el gasto" },
      { status: 500 }
    );
  }
}
