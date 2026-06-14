import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, getExpiredSessionCookie, verifySessionToken } from "@/lib/auth";
import { addMonthsToMonthKey, getMonthKey } from "@/lib/date-helpers";
import { dbConnect } from "@/lib/dbConnect";
import { exportMonthToGoogleSheets } from "@/lib/google-sheets-export";
import { buildMonthlyDashboardPayload, syncHistorySnapshot } from "@/lib/monthly-dashboard";
import { Household } from "@/models/Household";
import { User } from "@/models/User";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());

  return response;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return getUnauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as
    | {
        force?: boolean;
        monthKey?: string;
      }
    | null;

  await dbConnect();

  const household = await Household.findById(session.hogarId)
    .select("_id mesActivo googleSheets")
    .lean();

  if (!household) {
    return NextResponse.json(
      { error: "No encontramos tu cucha actual." },
      { status: 404 }
    );
  }

  const activeMonth = household.mesActivo ?? getMonthKey(new Date());

  if (body?.monthKey && body.monthKey !== activeMonth) {
    return NextResponse.json(
      { error: "Solo podés finalizar el mes activo actual." },
      { status: 409 }
    );
  }

  const payloadResult = await buildMonthlyDashboardPayload({
    hogarId: session.hogarId,
    currentUserId: session.sub,
    requestedMonth: activeMonth,
  });

  if (!payloadResult.ok) {
    return NextResponse.json(
      { error: payloadResult.error },
      { status: payloadResult.status }
    );
  }

  const { payload } = payloadResult;
  const outstandingDebt = payload.summary.activeDebt.settlement;

  if (outstandingDebt && !body?.force) {
    return NextResponse.json(
      {
        error: payload.summary.activeDebt.message,
        outstandingDebt,
      },
      { status: 409 }
    );
  }

  await syncHistorySnapshot({
    hogarId: session.hogarId,
    monthKey: activeMonth,
    payload,
    ensureExists: true,
  });

  const nextMonth = addMonthsToMonthKey(activeMonth, 1);

  await Household.findByIdAndUpdate(
    session.hogarId,
    {
      $set: {
        mesActivo: nextMonth,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  let googleSheetsExport: {
    ok: boolean;
    error?: string;
    sheetTitle?: string;
  } | null = null;

  if (household.googleSheets?.spreadsheetId && household.googleSheets.exportOwnerUserId) {
    try {
      const exportOwner = await User.findOne({
        _id: household.googleSheets.exportOwnerUserId,
        hogarId: session.hogarId,
      }).select(
        "_id googleAuth.email +googleAuth.accessTokenEncrypted +googleAuth.refreshTokenEncrypted googleAuth.scope googleAuth.tokenType googleAuth.expiryDate googleAuth.connectedAt"
      );

      if (!exportOwner?.googleAuth?.email) {
        throw new Error("La cuenta conectada para exportar a Google Sheets ya no está disponible.");
      }

      const exportResult = await exportMonthToGoogleSheets({
        payload,
        spreadsheetId: household.googleSheets.spreadsheetId,
        templateSheetName: household.googleSheets.templateSheetName ?? null,
        user: exportOwner,
      });

      await Household.findByIdAndUpdate(session.hogarId, {
        $set: {
          "googleSheets.lastExportedAt": exportResult.exportedAt,
          "googleSheets.lastExportedSheetName": exportResult.sheetTitle,
          "googleSheets.lastExportError": null,
        },
      });

      googleSheetsExport = {
        ok: true,
        sheetTitle: exportResult.sheetTitle,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No pudimos exportar el cierre mensual a Google Sheets.";

      await Household.findByIdAndUpdate(session.hogarId, {
        $set: {
          "googleSheets.lastExportError": message,
        },
      });

      googleSheetsExport = {
        ok: false,
        error: message,
      };
    }
  }

  return NextResponse.json({
    ok: true,
    finalizedMonth: activeMonth,
    activeMonth: nextMonth,
    googleSheetsExport,
  });
}
