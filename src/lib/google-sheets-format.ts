import type { ExpensesDashboardPayload } from "@/types/expense";

type SheetRowValue = string | number | null | undefined;

function formatSheetDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");

  return `${Number(day)}/${month}/${year}`;
}

function formatSheetCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return new Intl.NumberFormat("es-AR", {
    currency: "ARS",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  })
    .format(value)
    .replace(/\s/g, "");
}

function escapeSheetCell(value: SheetRowValue) {
  return `${value ?? ""}`.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function escapeHtmlCell(value: SheetRowValue) {
  return `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findUserName(payload: ExpensesDashboardPayload, userId: string) {
  return payload.users.find((user) => user._id === userId)?.nombre ?? "Persona";
}

function buildRows(payload: ExpensesDashboardPayload) {
  const SECTION_GAP_ROWS = 2;
  const categoryLabels = new Map(
    payload.summary.categorySummary.map((category) => [category.categoria, category.label])
  );
  const sortedExpenses = [...payload.expenses].sort((firstExpense, secondExpense) => {
    const dateDiff =
      new Date(firstExpense.fecha).getTime() - new Date(secondExpense.fecha).getTime();

    return dateDiff || firstExpense.descripcion.localeCompare(secondExpense.descripcion);
  });
  const sortedPayments = [...payload.payments].sort((firstPayment, secondPayment) => {
    const dateDiff =
      new Date(firstPayment.fecha).getTime() - new Date(secondPayment.fecha).getTime();

    return dateDiff || firstPayment.monto - secondPayment.monto;
  });
  const rows: SheetRowValue[][] = [];
  const styledCells = new Set<string>();

  function setCell(rowIndex: number, columnIndex: number, value: SheetRowValue) {
    rows[rowIndex] ??= [];
    rows[rowIndex][columnIndex] = value;
  }

  function setStyledCell(rowIndex: number, columnIndex: number, value: SheetRowValue) {
    setCell(rowIndex, columnIndex, value);
    styledCells.add(`${rowIndex}:${columnIndex}`);
  }

  setCell(0, 0, "Gasto");
  setCell(0, 1, "Categoría");
  setCell(0, 2, "Fecha");
  setCell(0, 3, "Monto");
  setCell(0, 4, "Pagado Por");
  setStyledCell(2, 6, "Total");
  setStyledCell(2, 7, formatSheetCurrency(payload.summary.gastoTotal));

  sortedExpenses.forEach((expense, index) => {
    const rowIndex = index + 1;

    setCell(rowIndex, 0, expense.descripcion);
    setCell(rowIndex, 1, categoryLabels.get(expense.categoria) ?? expense.categoria);
    setCell(rowIndex, 2, formatSheetDate(expense.fecha));
    setCell(rowIndex, 3, formatSheetCurrency(expense.monto));
    setCell(
      rowIndex,
      4,
      expense.pagadoPorDetalle?.nombre ?? findUserName(payload, expense.pagadoPor)
    );
  });

  payload.summary.spendingByUser.forEach((user, index) => {
    const rowIndex = index + 4 + SECTION_GAP_ROWS;

    setStyledCell(rowIndex, 6, `Pagado por ${user.nombre}`);
    setStyledCell(rowIndex, 7, formatSheetCurrency(user.totalPagado));
  });

  const summaryStartRowIndex = 4 + SECTION_GAP_ROWS;
  const saldoRowIndex = Math.max(
    summaryStartRowIndex + payload.summary.spendingByUser.length + SECTION_GAP_ROWS,
    8
  );
  setStyledCell(saldoRowIndex, 6, "Saldo del Mes");
  setStyledCell(
    saldoRowIndex,
    7,
    formatSheetCurrency(payload.summary.activeDebt.settlement?.amount ?? 0)
  );

  const paymentsHeaderRowIndex = saldoRowIndex + 1 + SECTION_GAP_ROWS;
  setStyledCell(paymentsHeaderRowIndex, 6, "Fecha");
  setStyledCell(paymentsHeaderRowIndex, 7, "Pago de Saldo");
  setStyledCell(paymentsHeaderRowIndex, 8, "Quién");

  if (sortedPayments.length === 0) {
    setCell(paymentsHeaderRowIndex + 1, 6, "Sin pagos");
  } else {
    sortedPayments.forEach((payment, index) => {
      const rowIndex = paymentsHeaderRowIndex + index + 1;

      setCell(rowIndex, 6, formatSheetDate(payment.fecha));
      setCell(rowIndex, 7, formatSheetCurrency(payment.monto));
      setCell(
        rowIndex,
        8,
        payment.fromUser?.nombre ?? findUserName(payload, payment.fromUserId)
      );
    });
  }

  const statusRowIndex =
    paymentsHeaderRowIndex + Math.max(sortedPayments.length, 1) + 1 + SECTION_GAP_ROWS;
  setCell(statusRowIndex, 6, payload.summary.activeDebt.message);

  const categoryHeaderRowIndex = statusRowIndex + 1 + SECTION_GAP_ROWS;
  setStyledCell(categoryHeaderRowIndex, 6, "Categoría");
  setStyledCell(categoryHeaderRowIndex, 7, "Gasto Total");

  payload.summary.categorySummary.forEach((category, index) => {
    const rowIndex = categoryHeaderRowIndex + index + 1;

    setCell(rowIndex, 6, category.label);
    setCell(rowIndex, 7, formatSheetCurrency(category.total));
  });

  return { rows, styledCells };
}

export function buildSheetsExport(payload: ExpensesDashboardPayload) {
  const { rows, styledCells } = buildRows(payload);
  const expenseRowCount = payload.expenses.length;
  const paymentRowCount = Math.max(payload.payments.length, 1);
  const summaryStartRowIndex = 6;
  const saldoRowIndex = Math.max(
    summaryStartRowIndex + payload.summary.spendingByUser.length + 2,
    8
  );
  const paymentsHeaderRowIndex = saldoRowIndex + 3;

  const text = rows
    .map((row) => {
      const lastColumnIndex = row.reduce<number>(
        (lastIndex, cell, index) =>
          cell === undefined || cell === null || cell === "" ? lastIndex : index,
        0
      );

      return Array.from({ length: lastColumnIndex + 1 }, (_, index) =>
        escapeSheetCell(row[index])
      ).join("\t");
    })
    .join("\n");

  const htmlRows = rows
    .map((row, rowIndex) => {
      const lastColumnIndex = row.reduce<number>(
        (lastIndex, cell, index) =>
          cell === undefined || cell === null || cell === "" ? lastIndex : index,
        0
      );
      const cells = Array.from({ length: lastColumnIndex + 1 }, (_, columnIndex) => {
        const isStyled = styledCells.has(`${rowIndex}:${columnIndex}`) || rowIndex === 0;
        const tagName = isStyled ? "th" : "td";
        const style = isStyled
          ? "border:1px solid #444;background:#f1f5f9;font-weight:700;padding:4px 8px;text-align:left;"
          : "border:1px solid #d4d4d4;padding:4px 8px;text-align:left;";

        return `<${tagName} style="${style}">${escapeHtmlCell(row[columnIndex])}</${tagName}>`;
      }).join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return {
    html: `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:10pt;">${htmlRows}</table>`,
    text,
    values: rows.map((row) => row.map((cell) => (cell === undefined || cell === null ? "" : `${cell}`))),
    metadata: {
      expenseTable: {
        startColumnIndex: 0,
        endColumnIndex: 5,
        startRowIndex: 0,
        endRowIndex: Math.max(expenseRowCount + 1, 1),
      },
      paymentTable: {
        startColumnIndex: 6,
        endColumnIndex: 9,
        startRowIndex: paymentsHeaderRowIndex,
        endRowIndex: paymentsHeaderRowIndex + paymentRowCount + 1,
      },
    },
  };
}

export function normalizeSpreadsheetUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

    if (!match?.[1]) {
      return null;
    }

    return {
      spreadsheetId: match[1],
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${match[1]}/edit`,
    };
  } catch {
    return null;
  }
}
