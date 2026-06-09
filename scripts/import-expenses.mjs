#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";

import mongoose from "mongoose";

const CATEGORY_BY_TOKEN = new Map([
  ["comida", "comida"],
  ["transporte", "transporte"],
  ["servicios", "servicios"],
  ["salidas/ocio", "salidas-ocio"],
  ["salidas ocio", "salidas-ocio"],
  ["salidas-ocio", "salidas-ocio"],
  ["para la casa", "para-la-casa"],
  ["para-la-casa", "para-la-casa"],
  ["delivery", "delivery"],
]);

const DEFAULT_PAYER_ALIASES = new Map([
  ["luqui", "lucas"],
  ["tami", "tami"],
]);

const HELP_TEXT = `Uso:
  npm run import:expenses -- --file=./ruta/gastos.csv --mongo-url='mongodb+srv://...' --household-id='...' [--month-key=2026-06] [--payer-map='tami=tami,luqui=luqui']
  npm run import:expenses -- --file=./ruta/gastos.tsv --mongo-url='mongodb+srv://...' --household-code='ABC123' --commit

Opciones:
  --file            Ruta al archivo CSV/TSV exportado o pegado desde Google Sheets.
  --mongo-url       URL de Mongo. Tambien puede venir de MONGO_URL.
  --household-id    _id de la cucha destino.
  --household-code  Codigo de invitacion de la cucha destino.
  --month-key       Fuerza que todas las filas pertenezcan al mes YYYY-MM.
  --payer-map       Alias extra para pagadores. Ej: 'tami=tamara,luqui=lucas'.
  --commit          Inserta en la base. Sin esto, el script hace dry-run.
  --help            Muestra esta ayuda.

Formato esperado por fila:
  descripcion, categoria, fecha, monto, pagadoPor
  Tambien acepta encabezados como: Gasto, Categoria, Fecha, Monto, Pagado Por

Ejemplo sin encabezado:
  ABL\tServicios\t1/06/2026\t$14.960\tTami
`;

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function parseArgs(argv) {
  const options = {
    commit: false,
    file: "",
    householdCode: "",
    householdId: "",
    mongoUrl: process.env.MONGO_URL ?? "",
    monthKey: "",
    payerMap: new Map(DEFAULT_PAYER_ALIASES),
  };

  for (const arg of argv) {
    if (arg === "--help") {
      options.help = true;
      continue;
    }

    if (arg === "--commit") {
      options.commit = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }

    const separatorIndex = arg.indexOf("=");

    if (separatorIndex === -1) {
      throw new Error(`Falta valor para ${arg}`);
    }

    const key = arg.slice(2, separatorIndex);
    const value = arg.slice(separatorIndex + 1).trim();

    if (!value) {
      throw new Error(`El valor para --${key} no puede estar vacio.`);
    }

    if (key === "payer-map") {
      options.payerMap = parsePayerMap(value);
      continue;
    }

    if (key === "mongo-url") {
      options.mongoUrl = value;
      continue;
    }

    if (key === "household-id") {
      options.householdId = value;
      continue;
    }

    if (key === "household-code") {
      options.householdCode = value;
      continue;
    }

    if (key === "month-key") {
      options.monthKey = value;
      continue;
    }

    if (key === "file") {
      options.file = value;
      continue;
    }

    throw new Error(`Opcion no soportada: --${key}`);
  }

  return options;
}

function parsePayerMap(value) {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const payerMap = new Map(DEFAULT_PAYER_ALIASES);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex === -1) {
      throw new Error(`Alias invalido en --payer-map: ${entry}`);
    }

    const source = normalizeText(entry.slice(0, separatorIndex));
    const target = normalizeText(entry.slice(separatorIndex + 1));

    if (!source || !target) {
      throw new Error(`Alias invalido en --payer-map: ${entry}`);
    }

    payerMap.set(source, target);
  }

  return payerMap;
}

function countOccurrences(value, token) {
  return value.split(token).length - 1;
}

function detectDelimiter(lines) {
  const sample = lines.find((line) => line.trim().length > 0) ?? "";
  const candidates = ["\t", ",", ";"];
  const ranked = candidates
    .map((token) => ({ token, count: countOccurrences(sample, token) }))
    .sort((first, second) => second.count - first.count);

  return ranked[0]?.count > 0 ? ranked[0].token : "\t";
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === delimiter && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());

  return cells;
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}

function isHeaderRow(columns) {
  if (columns.length < 5) {
    return false;
  }

  const normalized = columns.slice(0, 5).map((column) => normalizeText(column));

  return (
    (normalized[0] === "descripcion" || normalized[0] === "gasto") &&
    normalized[1] === "categoria" &&
    normalized[2] === "fecha" &&
    normalized[3] === "monto" &&
    (normalized[4] === "pagado por" || normalized[4] === "pagadopor")
  );
}

function parseAmount(value) {
  const cleaned = value.replace(/\s/g, "").replace(/\$/g, "");

  if (!cleaned) {
    return Number.NaN;
  }

  if (cleaned.includes(",")) {
    return Number(cleaned.replace(/\./g, "").replace(/,/g, "."));
  }

  if (countOccurrences(cleaned, ".") > 1) {
    return Number(cleaned.replace(/\./g, ""));
  }

  const dotIndex = cleaned.indexOf(".");

  if (dotIndex !== -1 && cleaned.length - dotIndex - 1 === 3) {
    return Number(cleaned.replace(/\./g, ""));
  }

  return Number(cleaned);
}

function parseDate(value) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    throw new Error(`Fecha invalida: ${value}`);
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Fecha invalida: ${value}`);
  }

  return {
    date,
    isoDay: `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`,
    monthKey: `${year}-${`${month}`.padStart(2, "0")}`,
  };
}

function normalizeCategory(value) {
  const normalized = normalizeText(value).replace(/\s*\/\s*/g, "/");
  const category = CATEGORY_BY_TOKEN.get(normalized);

  if (!category) {
    throw new Error(`Categoria no soportada: ${value}`);
  }

  return category;
}

function buildUserLookup(users) {
  const lookup = new Map();

  for (const user of users) {
    const tokens = Array.from(
      new Set(
        [user.nombre, user.username]
          .filter(Boolean)
          .map((value) => normalizeText(value))
      )
    );

    for (const token of tokens) {
      const bucket = lookup.get(token) ?? [];
      bucket.push(user);
      lookup.set(token, bucket);
    }
  }

  return lookup;
}

function resolveUser(payerLabel, payerMap, userLookup) {
  const rawToken = normalizeText(payerLabel);
  const mappedToken = payerMap.get(rawToken) ?? rawToken;
  const candidates = Array.from(
    new Map(
      (userLookup.get(mappedToken) ?? []).map((user) => [user._id.toString(), user])
    ).values()
  );

  if (candidates.length === 0) {
    throw new Error(`No existe un usuario para el pagador: ${payerLabel}`);
  }

  if (candidates.length > 1) {
    throw new Error(
      `El pagador ${payerLabel} coincide con multiples usuarios: ${candidates
        .map((user) => `${user.nombre}(@${user.username})`)
        .join(", ")}.`
    );
  }

  return candidates[0];
}

function buildDuplicateKey(row) {
  return [
    normalizeText(row.descripcion),
    row.categoria,
    row.isoDay,
    row.monto.toFixed(2),
    row.pagadoPorId,
  ].join("|");
}

function roundCurrency(value) {
  return Number(value.toFixed(2));
}

function buildHistorySnapshot({ users, percentages, expenses, payments }) {
  const totalsByUser = expenses.reduce((accumulator, expense) => {
    const userId = expense.pagadoPor.toString();

    accumulator.set(
      userId,
      roundCurrency((accumulator.get(userId) ?? 0) + Number(expense.monto))
    );

    return accumulator;
  }, new Map());
  const paymentsByUser = payments.reduce((accumulator, payment) => {
    const fromUserId = payment.fromUserId.toString();
    const toUserId = payment.toUserId.toString();

    accumulator.set(
      fromUserId,
      roundCurrency((accumulator.get(fromUserId) ?? 0) + Number(payment.monto))
    );
    accumulator.set(
      toUserId,
      roundCurrency((accumulator.get(toUserId) ?? 0) - Number(payment.monto))
    );

    return accumulator;
  }, new Map());

  const gastoTotal = roundCurrency(
    Array.from(totalsByUser.values()).reduce(
      (runningTotal, currentValue) => runningTotal + currentValue,
      0
    )
  );
  const paymentTotal = roundCurrency(
    payments.reduce((runningTotal, payment) => runningTotal + Number(payment.monto), 0)
  );
  const hasPairSetup = users.length === 2;
  const normalizedPercentages = hasPairSetup
    ? {
        user1: Number(percentages?.user1 ?? 50),
        user2: Number(percentages?.user2 ?? 50),
      }
    : null;
  const balances = users.map((user, index) => {
    const totalPagado = totalsByUser.get(user._id.toString()) ?? 0;

    if (!hasPairSetup || !normalizedPercentages) {
      return {
        userId: user._id,
        totalPagado,
        saldoNeto: 0,
      };
    }

    const porcentajeResponsabilidad = index === 0
      ? normalizedPercentages.user1
      : normalizedPercentages.user2;
    const montoObjetivo = roundCurrency((gastoTotal * porcentajeResponsabilidad) / 100);
    const saldoNeto = roundCurrency(
      totalPagado - montoObjetivo + (paymentsByUser.get(user._id.toString()) ?? 0)
    );

    return {
      userId: user._id,
      totalPagado,
      saldoNeto,
    };
  });

  if (!hasPairSetup || !normalizedPercentages || gastoTotal <= 0) {
    return {
      gastoTotal,
      paymentTotal,
      paymentCount: payments.length,
      balances,
      settlement: null,
    };
  }

  const sortedByBalance = [...balances].sort(
    (firstUser, secondUser) => secondUser.saldoNeto - firstUser.saldoNeto
  );
  const creditor = sortedByBalance[0];
  const debtor = sortedByBalance[sortedByBalance.length - 1];
  const amount = roundCurrency(
    Math.min(creditor.saldoNeto, Math.abs(debtor.saldoNeto))
  );

  return {
    gastoTotal,
    paymentTotal,
    paymentCount: payments.length,
    balances,
    settlement: amount > 0
      ? {
          desde: debtor.userId,
          hacia: creditor.userId,
          monto: amount,
        }
      : null,
  };
}

async function syncHistorySnapshots({
  db,
  hogarId,
  activeMonth,
  monthKeys,
  users,
  percentages,
}) {
  const historyMonthKeys = monthKeys.filter((monthKey) => monthKey !== activeMonth);

  if (historyMonthKeys.length === 0) {
    return [];
  }

  const [expenses, payments] = await Promise.all([
    db.collection("expenses")
      .find(
        {
          hogarId,
          mesLiquidacion: { $in: historyMonthKeys },
        },
        {
          projection: {
            monto: 1,
            pagadoPor: 1,
            mesLiquidacion: 1,
          },
        }
      )
      .toArray(),
    db.collection("payments")
      .find(
        {
          hogarId,
          mesLiquidacion: { $in: historyMonthKeys },
        },
        {
          projection: {
            monto: 1,
            fromUserId: 1,
            toUserId: 1,
            mesLiquidacion: 1,
          },
        }
      )
      .toArray(),
  ]);

  const historyCollection = db.collection("history");
  const now = new Date();
  const syncedMonths = [];

  for (const monthKey of historyMonthKeys) {
    const monthExpenses = expenses.filter((expense) => expense.mesLiquidacion === monthKey);
    const monthPayments = payments.filter((payment) => payment.mesLiquidacion === monthKey);
    const snapshot = buildHistorySnapshot({
      users,
      percentages,
      expenses: monthExpenses,
      payments: monthPayments,
    });

    await historyCollection.updateOne(
      {
        hogarId,
        mesLiquidacion: monthKey,
      },
      {
        $set: {
          gastoTotal: snapshot.gastoTotal,
          totalPagos: snapshot.paymentTotal,
          cantidadPagos: snapshot.paymentCount,
          deudaPendiente: snapshot.settlement?.monto ?? 0,
          resumenSaldos: {
            balances: snapshot.balances,
            transferenciaSugerida: snapshot.settlement ?? undefined,
          },
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
          cerradoEl: now,
        },
      },
      {
        upsert: true,
      }
    );

    syncedMonths.push(monthKey);
  }

  return syncedMonths;
}

async function loadRows(filePath) {
  const rawContent = stripBom(await fs.readFile(filePath, "utf8"));
  const lines = rawContent
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("El archivo no tiene filas para importar.");
  }

  const delimiter = detectDelimiter(lines);
  const parsedLines = lines.map((line) => parseDelimitedLine(line, delimiter));

  return isHeaderRow(parsedLines[0]) ? parsedLines.slice(1) : parsedLines;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(HELP_TEXT);
    return;
  }

  if (!options.file) {
    throw new Error("Tenes que indicar --file=... con el CSV o TSV a importar.");
  }

  if (!options.mongoUrl) {
    throw new Error("Tenes que indicar --mongo-url=... o definir MONGO_URL.");
  }

  if (!options.householdId && !options.householdCode) {
    throw new Error("Indica --household-id o --household-code para elegir la cucha destino.");
  }

  if (options.householdId && !mongoose.isValidObjectId(options.householdId)) {
    throw new Error("El valor de --household-id no es un ObjectId valido.");
  }

  if (options.monthKey && !/^\d{4}-(0[1-9]|1[0-2])$/.test(options.monthKey)) {
    throw new Error("--month-key debe tener formato YYYY-MM.");
  }

  const rows = await loadRows(options.file);

  await mongoose.connect(options.mongoUrl, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    const db = mongoose.connection.db;
    const households = db.collection("households");
    const usersCollection = db.collection("users");
    const expensesCollection = db.collection("expenses");

    const householdQuery = options.householdId
      ? { _id: new mongoose.Types.ObjectId(options.householdId) }
      : { codigoInvitacion: options.householdCode.trim().toUpperCase() };
    const household = await households.findOne(householdQuery, {
      projection: {
        _id: 1,
        nombre: 1,
        codigoInvitacion: 1,
        mesActivo: 1,
        porcentajesDefecto: 1,
      },
    });

    if (!household) {
      throw new Error("No encontre la cucha destino con los datos indicados.");
    }

    const users = await usersCollection
      .find(
        { hogarId: household._id },
        { projection: { _id: 1, nombre: 1, username: 1 } }
      )
      .sort({ nombre: 1 })
      .toArray();

    if (users.length === 0) {
      throw new Error("La cucha destino no tiene usuarios para asignar como pagadores.");
    }

    const userLookup = buildUserLookup(users);
    const parsedRows = [];
    const validationErrors = [];

    rows.forEach((columns, index) => {
      const rowNumber = index + 1;

      try {
        if (columns.length < 5) {
          throw new Error("La fila no tiene las 5 columnas esperadas.");
        }

        const [descripcionRaw, categoriaRaw, fechaRaw, montoRaw, pagadoPorRaw] = columns;
        const descripcion = descripcionRaw.trim();

        if (descripcion.length < 2 || descripcion.length > 200) {
          throw new Error("La descripcion debe tener entre 2 y 200 caracteres.");
        }

        const categoria = normalizeCategory(categoriaRaw);
        const { date, isoDay, monthKey } = parseDate(fechaRaw);
        const monto = parseAmount(montoRaw);

        if (!Number.isFinite(monto) || monto <= 0) {
          throw new Error(`Monto invalido: ${montoRaw}`);
        }

        if (options.monthKey && monthKey !== options.monthKey) {
          throw new Error(
            `La fila pertenece a ${monthKey} y no coincide con --month-key=${options.monthKey}`
          );
        }

        const user = resolveUser(pagadoPorRaw, options.payerMap, userLookup);

        parsedRows.push({
          categoria,
          descripcion,
          fecha: date,
          isoDay,
          mesLiquidacion: options.monthKey || monthKey,
          monto: Number(monto.toFixed(2)),
          pagadoPorId: user._id.toString(),
          pagadoPorNombre: user.nombre,
          rawPayer: pagadoPorRaw,
          rowNumber,
        });
      } catch (error) {
        validationErrors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    });

    if (validationErrors.length > 0) {
      console.error("Errores de validacion detectados:");
      validationErrors.forEach((message) => console.error(`- ${message}`));
      process.exitCode = 1;
      return;
    }

    const monthKeys = Array.from(new Set(parsedRows.map((row) => row.mesLiquidacion)));
    const existingExpenses = await expensesCollection
      .find(
        {
          hogarId: household._id,
          mesLiquidacion: { $in: monthKeys },
        },
        {
          projection: {
            _id: 1,
            categoria: 1,
            descripcion: 1,
            fecha: 1,
            mesLiquidacion: 1,
            monto: 1,
            pagadoPor: 1,
          },
        }
      )
      .toArray();

    const existingKeys = new Set(
      existingExpenses.map((expense) =>
        buildDuplicateKey({
          categoria: expense.categoria,
          descripcion: expense.descripcion,
          isoDay: expense.fecha.toISOString().slice(0, 10),
          monto: Number(expense.monto),
          pagadoPorId: expense.pagadoPor.toString(),
        })
      )
    );

    const duplicateRows = [];
    const rowsToInsert = [];

    for (const row of parsedRows) {
      const duplicateKey = buildDuplicateKey(row);

      if (existingKeys.has(duplicateKey)) {
        duplicateRows.push(row);
        continue;
      }

      existingKeys.add(duplicateKey);
      rowsToInsert.push(row);
    }

    console.log(`Cucha destino: ${household.nombre} (${household._id.toString()})`);
    console.log(`Usuarios encontrados: ${users.map((user) => `${user.nombre}(@${user.username})`).join(", ")}`);
    console.log(`Filas leidas: ${rows.length}`);
    console.log(`Filas validas: ${parsedRows.length}`);
    console.log(`Duplicados detectados: ${duplicateRows.length}`);
    console.log(`Filas listas para insertar: ${rowsToInsert.length}`);

    if (duplicateRows.length > 0) {
      console.log("Duplicados omitidos:");
      duplicateRows.slice(0, 10).forEach((row) => {
        console.log(
          `- Fila ${row.rowNumber}: ${row.descripcion} | ${row.isoDay} | ${row.monto} | ${row.pagadoPorNombre}`
        );
      });
    }

    if (!options.commit) {
      console.log("Dry-run completado. Agrega --commit para escribir en la base.");
      return;
    }

    let insertedCount = 0;

    if (rowsToInsert.length > 0) {
      const now = new Date();
      const documents = rowsToInsert.map((row) => ({
        hogarId: household._id,
        descripcion: row.descripcion,
        monto: row.monto,
        categoria: row.categoria,
        fecha: row.fecha,
        pagadoPor: new mongoose.Types.ObjectId(row.pagadoPorId),
        mesLiquidacion: row.mesLiquidacion,
        createdAt: now,
        updatedAt: now,
      }));

      const result = await expensesCollection.insertMany(documents, { ordered: true });
      insertedCount = result.insertedCount;
    }

    const syncedHistoryMonths = await syncHistorySnapshots({
      db,
      hogarId: household._id,
      activeMonth: household.mesActivo,
      monthKeys,
      users,
      percentages: household.porcentajesDefecto,
    });

    if (insertedCount === 0) {
      console.log("No hay filas nuevas para insertar.");
    } else {
      console.log(`Importacion completada. Documentos insertados: ${insertedCount}`);
    }

    if (syncedHistoryMonths.length > 0) {
      console.log(`Snapshots historicos sincronizados: ${syncedHistoryMonths.join(", ")}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});