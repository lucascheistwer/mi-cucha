import { formatMonthLabel } from "@/lib/date-helpers";
import { buildSheetsExport } from "@/lib/google-sheets-format";
import { decryptGoogleToken, refreshGoogleAccessToken } from "@/lib/google-oauth";
import type { UserDocument } from "@/models/User";
import type { ExpensesDashboardPayload } from "@/types/expense";

type GoogleSheetTab = {
  properties?: {
    sheetId?: number;
    title?: string;
  };
};

type GoogleSpreadsheetResponse = {
  sheets?: GoogleSheetTab[];
};

function buildSheetTitle(monthKey: string) {
  const monthLabel = formatMonthLabel(monthKey);

  return `${monthKey} · ${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)}`.slice(0, 100);
}

async function callGoogleSheetsApi<T>(input: {
  accessToken: string;
  method?: "GET" | "POST" | "PUT";
  url: string;
  body?: Record<string, unknown>;
}) {
  const response = await fetch(input.url, {
    method: input.method ?? "GET",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      ...(input.body ? { "Content-Type": "application/json" } : {}),
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null;

  if (!response.ok) {
    const errorMessage =
      data && typeof data === "object" && "error" in data
        ? data.error?.message || "Google Sheets respondió con error."
        : "Google Sheets respondió con error.";

    throw new Error(errorMessage);
  }

  return data as T;
}

async function getValidGoogleAccessToken(user: UserDocument) {
  if (!user.googleAuth?.refreshTokenEncrypted) {
    throw new Error("La conexión de Google no tiene refresh token.");
  }

  const refreshToken = decryptGoogleToken(user.googleAuth.refreshTokenEncrypted);

  if (!refreshToken) {
    throw new Error("No pudimos descifrar el refresh token de Google.");
  }

  const refreshed = await refreshGoogleAccessToken({ refreshToken });

  return {
    accessToken: refreshed.accessToken,
    expiresAt: refreshed.expiresAt,
  };
}

function buildUniqueSheetTitle(existingTitles: string[], desiredTitle: string) {
  if (!existingTitles.includes(desiredTitle)) {
    return desiredTitle;
  }

  let suffix = 2;
  let candidate = `${desiredTitle} (${suffix})`;

  while (existingTitles.includes(candidate)) {
    suffix += 1;
    candidate = `${desiredTitle} (${suffix})`;
  }

  return candidate;
}

async function createSheetForMonth(input: {
  accessToken: string;
  spreadsheetId: string;
  monthKey: string;
  templateSheetName?: string | null;
}) {
  const spreadsheet = await callGoogleSheetsApi<GoogleSpreadsheetResponse>({
    accessToken: input.accessToken,
    url: `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}?fields=sheets.properties(sheetId,title)`,
  });
  const existingSheets = spreadsheet.sheets ?? [];
  const existingTitles = existingSheets
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => Boolean(title));
  const desiredTitle = buildUniqueSheetTitle(existingTitles, buildSheetTitle(input.monthKey));
  const templateSheet = input.templateSheetName
    ? existingSheets.find((sheet) => sheet.properties?.title === input.templateSheetName)
    : null;

  type BatchUpdateResponse = {
    replies?: Array<{
      addSheet?: { properties?: { sheetId?: number; title?: string } };
      duplicateSheet?: { properties?: { sheetId?: number; title?: string } };
    }>;
  };

  const batchResponse = await callGoogleSheetsApi<BatchUpdateResponse>({
    accessToken: input.accessToken,
    method: "POST",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}:batchUpdate`,
    body: templateSheet?.properties?.sheetId !== undefined
      ? {
          requests: [
            {
              duplicateSheet: {
                insertSheetIndex: existingSheets.length,
                newSheetName: desiredTitle,
                sourceSheetId: templateSheet.properties.sheetId,
              },
            },
          ],
        }
      : {
          requests: [
            {
              addSheet: {
                properties: {
                  title: desiredTitle,
                },
              },
            },
          ],
        },
  });

  const createdProperties =
    batchResponse.replies?.[0]?.duplicateSheet?.properties ??
    batchResponse.replies?.[0]?.addSheet?.properties;

  if (!createdProperties?.title || createdProperties.sheetId === undefined) {
    throw new Error("No pudimos crear la hoja mensual en Google Sheets.");
  }

  return {
    sheetId: createdProperties.sheetId,
    sheetTitle: createdProperties.title,
  };
}

async function applySheetLayout(input: {
  accessToken: string;
  spreadsheetId: string;
  sheetId: number;
  expenseTable: {
    startColumnIndex: number;
    endColumnIndex: number;
    startRowIndex: number;
    endRowIndex: number;
  };
  paymentTable: {
    startColumnIndex: number;
    endColumnIndex: number;
    startRowIndex: number;
    endRowIndex: number;
  };
}) {
  await callGoogleSheetsApi({
    accessToken: input.accessToken,
    method: "POST",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}:batchUpdate`,
    body: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: input.sheetId,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          setBasicFilter: {
            filter: {
              range: {
                sheetId: input.sheetId,
                startRowIndex: input.expenseTable.startRowIndex,
                endRowIndex: input.expenseTable.endRowIndex,
                startColumnIndex: input.expenseTable.startColumnIndex,
                endColumnIndex: input.expenseTable.endColumnIndex,
              },
            },
          },
        },
        {
          addFilterView: {
            filter: {
              title: "Pagos de saldo",
              range: {
                sheetId: input.sheetId,
                startRowIndex: input.paymentTable.startRowIndex,
                endRowIndex: input.paymentTable.endRowIndex,
                startColumnIndex: input.paymentTable.startColumnIndex,
                endColumnIndex: input.paymentTable.endColumnIndex,
              },
            },
          },
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: input.sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: 9,
            },
          },
        },
      ],
    },
  });
}

export async function exportMonthToGoogleSheets(input: {
  payload: ExpensesDashboardPayload;
  spreadsheetId: string;
  templateSheetName?: string | null;
  user: UserDocument;
}) {
  const tokens = await getValidGoogleAccessToken(input.user);
  const createdSheet = await createSheetForMonth({
    accessToken: tokens.accessToken,
    spreadsheetId: input.spreadsheetId,
    monthKey: input.payload.currentMonth,
    templateSheetName: input.templateSheetName,
  });
  const exportData = buildSheetsExport(input.payload);

  await callGoogleSheetsApi({
    accessToken: tokens.accessToken,
    method: "PUT",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(`${createdSheet.sheetTitle}!A1`)}?valueInputOption=USER_ENTERED`,
    body: {
      majorDimension: "ROWS",
      values: exportData.values,
    },
  });

  await applySheetLayout({
    accessToken: tokens.accessToken,
    spreadsheetId: input.spreadsheetId,
    sheetId: createdSheet.sheetId,
    expenseTable: exportData.metadata.expenseTable,
    paymentTable: exportData.metadata.paymentTable,
  });

  return {
    exportedAt: tokens.expiresAt ? new Date() : new Date(),
    sheetTitle: createdSheet.sheetTitle,
  };
}
