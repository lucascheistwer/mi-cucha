import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  getExpiredSessionCookie,
  verifySessionToken,
} from "@/lib/auth";
import { dbConnect } from "@/lib/dbConnect";
import {
  EXPENSE_CATEGORY_VALUES,
  isExpenseCategoryValue,
} from "@/lib/expense-categories";
import { normalizeSpreadsheetUrl } from "@/lib/google-sheets-format";
import { Household } from "@/models/Household";
import { User } from "@/models/User";

function normalizeTemplateSheetName(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  return normalized ? normalized.slice(0, 100) : null;
}

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  const response = NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  response.cookies.set(getExpiredSessionCookie());

  return response;
}

function normalizePercentage(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

function normalizeEnabledCategories(value: string[] | undefined) {
  const normalizedValues = value?.filter(isExpenseCategoryValue) ?? [];

  return normalizedValues.length > 0 ? normalizedValues : [...EXPENSE_CATEGORY_VALUES];
}

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return getUnauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as
    | {
      nombre?: unknown;
      user1Percentage?: unknown;
      enabledCategories?: unknown;
      spreadsheetUrl?: unknown;
      templateSheetName?: unknown;
    }
    | null;

  const user1Percentage =
    body && Object.hasOwn(body, "user1Percentage")
      ? normalizePercentage(body.user1Percentage)
      : undefined;
  const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : undefined;
  const templateSheetName = normalizeTemplateSheetName(body?.templateSheetName);
  const spreadsheetConfig =
    body && Object.hasOwn(body, "spreadsheetUrl")
      ? typeof body.spreadsheetUrl === "string"
        ? normalizeSpreadsheetUrl(body.spreadsheetUrl)
        : body.spreadsheetUrl === null
          ? null
          : undefined
      : undefined;

  const enabledCategories =
    body && Object.hasOwn(body, "enabledCategories")
      ? Array.isArray(body.enabledCategories)
        ? Array.from(
            new Set(
              body.enabledCategories
                .filter((value): value is string => typeof value === "string")
                .map((value) => value.trim())
                .filter(Boolean)
            )
          )
        : null
      : undefined;

  if (
    user1Percentage !== undefined &&
    (user1Percentage === null || user1Percentage < 0 || user1Percentage > 100)
  ) {
    return NextResponse.json(
      { error: "El porcentaje del primer usuario debe estar entre 0 y 100." },
      { status: 400 }
    );
  }

  if (nombre !== undefined && (nombre.length < 2 || nombre.length > 80)) {
    return NextResponse.json(
      { error: "El nombre de la cucha debe tener entre 2 y 80 caracteres." },
      { status: 400 }
    );
  }

  if (
    enabledCategories === null ||
    (enabledCategories !== undefined &&
      (enabledCategories.length === 0 ||
        enabledCategories.some((category) => !isExpenseCategoryValue(category))))
  ) {
    return NextResponse.json(
      { error: "Elegí al menos una categoría válida para dejar habilitada." },
      { status: 400 }
    );
  }

  if (body && Object.hasOwn(body, "spreadsheetUrl") && spreadsheetConfig === undefined) {
    return NextResponse.json(
      { error: "Pegá una URL válida de Google Sheets." },
      { status: 400 }
    );
  }

  if (templateSheetName !== undefined && templateSheetName !== null && templateSheetName.length < 2) {
    return NextResponse.json(
      { error: "El nombre de la hoja plantilla debe tener al menos 2 caracteres." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};

  if (nombre !== undefined) {
    updates.nombre = nombre;
  }

  if (enabledCategories !== undefined) {
    updates.categoriasHabilitadas = enabledCategories;
  }

  if (user1Percentage !== undefined) {
    const user2Percentage = Number((100 - user1Percentage).toFixed(2));

    updates["porcentajesDefecto.user1"] = user1Percentage;
    updates["porcentajesDefecto.user2"] = user2Percentage;
  }

  await dbConnect();

  if (spreadsheetConfig) {
    const currentUser = await User.findById(session.sub)
      .select("_id googleAuth.email")
      .lean();

    if (!currentUser?.googleAuth?.email) {
      return NextResponse.json(
        { error: "Conectá tu cuenta de Google antes de configurar la exportación." },
        { status: 409 }
      );
    }

    updates["googleSheets.spreadsheetId"] = spreadsheetConfig.spreadsheetId;
    updates["googleSheets.spreadsheetUrl"] = spreadsheetConfig.spreadsheetUrl;
    updates["googleSheets.exportOwnerUserId"] = session.sub;
    updates["googleSheets.lastExportError"] = null;
  } else if (spreadsheetConfig === null) {
    updates["googleSheets.spreadsheetId"] = null;
    updates["googleSheets.spreadsheetUrl"] = null;
    updates["googleSheets.templateSheetName"] = null;
    updates["googleSheets.exportOwnerUserId"] = null;
    updates["googleSheets.lastExportError"] = null;
  }

  if (templateSheetName !== undefined) {
    updates["googleSheets.templateSheetName"] = templateSheetName;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No recibimos cambios para guardar." },
      { status: 400 }
    );
  }

  const household = await Household.findByIdAndUpdate(
    session.hogarId,
    {
      $set: updates,
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  )
    .select(
      "_id nombre codigoInvitacion mesActivo porcentajesDefecto categoriasHabilitadas googleSheets"
    )
    .lean();

  if (!household) {
    return NextResponse.json(
      { error: "No encontramos la configuración de tu cucha." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    household: {
      _id: household._id.toString(),
      nombre: household.nombre,
      inviteCode: household.codigoInvitacion,
      activeMonth: household.mesActivo,
      categoriasHabilitadas: normalizeEnabledCategories(household.categoriasHabilitadas),
      porcentajesDefecto: {
        user1: household.porcentajesDefecto.user1,
        user2: household.porcentajesDefecto.user2,
      },
      googleSheets: {
        spreadsheetId: household.googleSheets?.spreadsheetId ?? null,
        spreadsheetUrl: household.googleSheets?.spreadsheetUrl ?? null,
        templateSheetName: household.googleSheets?.templateSheetName ?? null,
        exportOwnerUserId: household.googleSheets?.exportOwnerUserId
          ? household.googleSheets.exportOwnerUserId.toString()
          : null,
        lastExportedAt: household.googleSheets?.lastExportedAt?.toISOString() ?? null,
        lastExportedSheetName: household.googleSheets?.lastExportedSheetName ?? null,
        lastExportError: household.googleSheets?.lastExportError ?? null,
      },
    },
  });
}
