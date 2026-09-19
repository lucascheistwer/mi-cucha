import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import { Trip } from "@/models/Trip";
import { TripExpense } from "@/models/TripExpense";
import { User } from "@/models/User";
import type { TripExpenseListItem } from "@/types/trip";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());
  return response;
}

export async function POST(
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

    const body = await request.json();
    const { descripcion, monto, categoria, ciudad, fecha, pagadoPor } = body;

    if (!descripcion || !monto || !categoria || !ciudad || !fecha || !pagadoPor) {
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

    const trip = await Trip.findOne({
      _id: tripId,
      hogarId: user.hogarId,
    }).lean();

    if (!trip) {
      return getUnauthorizedResponse();
    }

    const expense = await TripExpense.create({
      tripId,
      hogarId: user.hogarId,
      descripcion,
      monto: Number(monto),
      categoria,
      ciudad,
      fecha: new Date(fecha),
      pagadoPor,
    });

    const createdExpense = await expense.populate<{
      pagadoPor: { _id: Types.ObjectId; nombre: string; username: string };
    }>("pagadoPor", "nombre username _id");

    const formattedExpense: TripExpenseListItem = {
      _id: createdExpense._id.toString(),
      tripId: createdExpense.tripId.toString(),
      hogarId: createdExpense.hogarId.toString(),
      descripcion: createdExpense.descripcion,
      monto: createdExpense.monto,
      categoria: createdExpense.categoria,
      ciudad: createdExpense.ciudad,
      fecha: createdExpense.fecha.toISOString(),
      pagadoPor: createdExpense.pagadoPor._id.toString(),
      pagadoPorDetalle: {
        _id: createdExpense.pagadoPor._id.toString(),
        nombre: createdExpense.pagadoPor.nombre,
        username: createdExpense.pagadoPor.username,
      },
      createdAt: createdExpense.createdAt.toISOString(),
      updatedAt: createdExpense.updatedAt.toISOString(),
    };

    return NextResponse.json({ expense: formattedExpense }, { status: 201 });
  } catch (error) {
    console.error("Error creating trip expense:", error);
    return NextResponse.json(
      { error: "Error al crear el gasto" },
      { status: 500 }
    );
  }
}
