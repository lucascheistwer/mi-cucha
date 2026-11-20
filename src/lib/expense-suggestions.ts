// Plantillas de carga a partir del historial del hogar, sin configuración ni IA.
// La ventana cierra en el mes activo (mesActivo / mesLiquidacion), no en el mes calendario.
// Cada persona ve los gastos que ella pagó. Un gasto ya cargado este mes se oculta para todo el hogar.
//
// Umbrales:
// - Historial: los 6 meses de liquidación anteriores al mes activo, más el mes activo
//   para frecuentes y autocompletado. Un mes sin gastos no corta la racha: no suma ni resta.
// - Principio de mes: mismo nombre normalizado y misma categoría, un solo cargo en el mes,
//   con fecha entre el día 1 y el 7, en al menos 3 de esos meses anteriores.
//   El mes activo no alcanza para crear el hábito. El monto no se precarga: se guarda
//   el último cobro anterior como referencia.
// - Frecuentes (chips): no son fijos de principio de mes, y además
//   4 cargos en 2 meses distintos, o 3 cargos en 3 meses (un hábito mensual más tardío).
// - Autocompletado: desde 2 cargos. Al escribir, primero lo que empieza con el texto,
//   después frecuencia y recencia.
// - Ahora no: oculta la tarjeta 3 días en este navegador. Descartar un ítem lo oculta
//   hasta que cambie el mes activo. No se sincroniza entre dispositivos.
import { addMonthsToMonthKey } from "@/lib/date-helpers";
import { normalizeExpenseDescription } from "@/lib/recurring-expenses";

export const SUGGESTION_HISTORY_MONTHS = 6;
export const MONTH_START_MAX_DAY = 7;
export const MONTH_START_MIN_MONTHS = 3;
export const MONTH_START_LIMIT = 4;
export const FREQUENT_MIN_TRANSACTIONS = 4;
export const FREQUENT_MIN_MONTHS = 2;
export const FREQUENT_MONTHLY_MIN_TRANSACTIONS = 3;
export const FREQUENT_MONTHLY_MIN_MONTHS = 3;
export const FREQUENT_LIMIT = 6;
export const AUTOCOMPLETE_MIN_TRANSACTIONS = 2;
export const AUTOCOMPLETE_LIMIT = 5;
export const SUGGESTION_SNOOZE_DAYS = 3;

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type SuggestionExpenseInput = {
  descripcion: string;
  monto: number;
  categoria: string;
  fecha: string;
  pagadoPor: string;
  mesLiquidacion: string;
};

export type ExpenseTemplate = {
  normalizedName: string;
  displayName: string;
  categoria: string;
  pagadoPor: string;
  lastAmount: number;
  lastMonthKey: string;
  lastDate: string;
  transactionCount: number;
  monthCount: number;
};

export type ExpenseSuggestions = {
  monthStart: ExpenseTemplate[];
  frequent: ExpenseTemplate[];
  autocomplete: ExpenseTemplate[];
};

export type ExpenseSuggestionsResponse = ExpenseSuggestions & {
  activeMonth: string;
};

export type MonthStartReminderMemory = {
  dismissedNames: string[];
  snoozeUntil: string | null;
};

type ObservedExpense = {
  displayName: string;
  normalizedName: string;
  categoria: string;
  monto: number;
  pagadoPor: string;
  mesLiquidacion: string;
  dateKey: string;
  day: number | null;
  sequence: number;
};

type ExpenseGroup = {
  normalizedName: string;
  categoria: string;
  pagadoPor: string;
  expenses: ObservedExpense[];
};

const EMPTY_SUGGESTIONS: ExpenseSuggestions = {
  monthStart: [],
  frequent: [],
  autocomplete: [],
};

export function getSuggestionHistoryStart(activeMonth: string) {
  if (!MONTH_KEY_PATTERN.test(activeMonth)) {
    return null;
  }

  return addMonthsToMonthKey(activeMonth, -SUGGESTION_HISTORY_MONTHS);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const match = DATE_KEY_PATTERN.exec(dateKey);

  if (!match || !Number.isInteger(days)) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() + days);

  return toDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function monthStartReminderStorageKey(hogarId: string, userId: string, activeMonth: string) {
  return `mi-cucha:month-start:${hogarId}:${userId}:${activeMonth}`;
}

export function emptyMonthStartReminderMemory(): MonthStartReminderMemory {
  return {
    dismissedNames: [],
    snoozeUntil: null,
  };
}

export function parseMonthStartReminderMemory(value: string | null): MonthStartReminderMemory {
  if (!value) {
    return emptyMonthStartReminderMemory();
  }

  try {
    const parsed = JSON.parse(value) as {
      dismissedNames?: unknown;
      snoozeUntil?: unknown;
    };
    const dismissedNames = Array.isArray(parsed.dismissedNames)
      ? parsed.dismissedNames.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0
        )
      : [];
    const snoozeUntil =
      typeof parsed.snoozeUntil === "string" && DATE_KEY_PATTERN.test(parsed.snoozeUntil)
        ? parsed.snoozeUntil
        : null;

    return {
      dismissedNames,
      snoozeUntil,
    };
  } catch {
    return emptyMonthStartReminderMemory();
  }
}

export function isMonthStartSnoozed(today: string, snoozeUntil: string | null) {
  if (!snoozeUntil || !DATE_KEY_PATTERN.test(today) || !DATE_KEY_PATTERN.test(snoozeUntil)) {
    return false;
  }

  return today < snoozeUntil;
}

export function formatMonthStartQuestion(names: readonly string[]) {
  if (names.length === 0) {
    return "";
  }

  if (names.length === 1) {
    return `¿Cargamos ${names[0]} de este mes?`;
  }

  if (names.length === 2) {
    return `¿Cargamos ${names[0]} y ${names[1]} de este mes?`;
  }

  if (names.length === 3) {
    return `¿Cargamos ${names[0]}, ${names[1]} y ${names[2]} de este mes?`;
  }

  const extraCount = names.length - 2;

  return `¿Cargamos ${names[0]}, ${names[1]} y ${extraCount} más de este mes?`;
}

export function buildExpenseSuggestions(input: {
  expenses: readonly SuggestionExpenseInput[];
  activeMonth: string;
  userId: string;
}): ExpenseSuggestions {
  const historyStart = getSuggestionHistoryStart(input.activeMonth);

  if (!historyStart || !input.userId) {
    return EMPTY_SUGGESTIONS;
  }

  const groups = new Map<string, ExpenseGroup>();
  let sequence = 0;

  input.expenses.forEach((expense) => {
    const observed = observeExpense(expense, input.userId, historyStart, input.activeMonth, sequence);

    if (!observed) {
      return;
    }

    sequence += 1;
    const groupKey = templateKey(observed.normalizedName, observed.categoria);
    const group = groups.get(groupKey) ?? {
      normalizedName: observed.normalizedName,
      categoria: observed.categoria,
      pagadoPor: observed.pagadoPor,
      expenses: [],
    };
    group.expenses.push(observed);
    groups.set(groupKey, group);
  });

  const monthStart = Array.from(groups.values())
    .map((group) => toMonthStartTemplate(group, input.activeMonth))
    .filter((template): template is ExpenseTemplate => template !== null)
    .sort(compareTemplates)
    .slice(0, MONTH_START_LIMIT);
  const monthStartKeys = new Set(
    monthStart.map((template) => templateKey(template.normalizedName, template.categoria))
  );
  const frequent = Array.from(groups.values())
    .filter((group) => !monthStartKeys.has(templateKey(group.normalizedName, group.categoria)))
    .filter((group) => isFrequentGroup(group))
    .map((group) => toTemplate(group, group.expenses))
    .sort(compareTemplates)
    .slice(0, FREQUENT_LIMIT);
  const autocomplete = Array.from(groups.values())
    .filter((group) => group.expenses.length >= AUTOCOMPLETE_MIN_TRANSACTIONS)
    .map((group) => toTemplate(group, group.expenses))
    .sort(compareTemplates);

  return {
    monthStart,
    frequent,
    autocomplete,
  };
}

export function selectVisibleMonthStartSuggestions(input: {
  suggestions: readonly ExpenseTemplate[];
  activeMonthExpenses: readonly { descripcion: string }[];
  dismissedNames: readonly string[];
  snoozeUntil: string | null;
  today: string;
}) {
  if (isMonthStartSnoozed(input.today, input.snoozeUntil)) {
    return [];
  }

  const loadedNames = new Set(
    input.activeMonthExpenses
      .map((expense) => normalizeExpenseDescription(expense.descripcion))
      .filter((name) => name.length > 0)
  );
  const dismissedNames = new Set(
    input.dismissedNames
      .map((name) => normalizeExpenseDescription(name))
      .filter((name) => name.length > 0)
  );

  return input.suggestions.filter(
    (suggestion) =>
      !loadedNames.has(suggestion.normalizedName) && !dismissedNames.has(suggestion.normalizedName)
  );
}

export function matchExpenseTemplates(
  templates: readonly ExpenseTemplate[],
  query: string,
  limit = AUTOCOMPLETE_LIMIT
) {
  const normalizedQuery = normalizeExpenseDescription(query);

  if (!normalizedQuery || limit < 1) {
    return [];
  }

  return templates
    .filter((template) => template.normalizedName.includes(normalizedQuery))
    .sort((firstTemplate, secondTemplate) => {
      const firstStarts = firstTemplate.normalizedName.startsWith(normalizedQuery) ? 0 : 1;
      const secondStarts = secondTemplate.normalizedName.startsWith(normalizedQuery) ? 0 : 1;

      return (
        firstStarts - secondStarts ||
        secondTemplate.transactionCount - firstTemplate.transactionCount ||
        secondTemplate.lastDate.localeCompare(firstTemplate.lastDate) ||
        secondTemplate.lastMonthKey.localeCompare(firstTemplate.lastMonthKey) ||
        firstTemplate.displayName.localeCompare(secondTemplate.displayName, "es")
      );
    })
    .slice(0, limit);
}

function observeExpense(
  expense: SuggestionExpenseInput,
  userId: string,
  historyStart: string,
  activeMonth: string,
  sequence: number
): ObservedExpense | null {
  if (expense.pagadoPor !== userId) {
    return null;
  }

  if (
    !MONTH_KEY_PATTERN.test(expense.mesLiquidacion) ||
    expense.mesLiquidacion < historyStart ||
    expense.mesLiquidacion > activeMonth
  ) {
    return null;
  }

  if (!Number.isFinite(expense.monto) || expense.monto <= 0) {
    return null;
  }

  const categoria = expense.categoria.trim();
  const displayName = expense.descripcion.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeExpenseDescription(displayName);

  if (!categoria || !normalizedName) {
    return null;
  }

  const dateKey = readDateKey(expense.fecha);
  const day = dateKey && dateKey.slice(0, 7) === expense.mesLiquidacion
    ? Number(dateKey.slice(8, 10))
    : null;

  return {
    displayName,
    normalizedName,
    categoria,
    monto: roundCurrencyAmount(expense.monto),
    pagadoPor: expense.pagadoPor,
    mesLiquidacion: expense.mesLiquidacion,
    dateKey: dateKey ?? `${expense.mesLiquidacion}-01`,
    day,
    sequence,
  };
}

function toMonthStartTemplate(group: ExpenseGroup, activeMonth: string): ExpenseTemplate | null {
  const previousExpenses = group.expenses.filter((expense) => expense.mesLiquidacion < activeMonth);
  const buckets = groupByMonth(previousExpenses);
  const earlyMonths = Array.from(buckets.values()).filter(isEarlySingleMonth);

  if (earlyMonths.length < MONTH_START_MIN_MONTHS) {
    return null;
  }

  const reference = latestExpense(previousExpenses);

  if (!reference) {
    return null;
  }

  return {
    normalizedName: group.normalizedName,
    displayName: chooseDisplayName(group.expenses),
    categoria: group.categoria,
    pagadoPor: group.pagadoPor,
    lastAmount: reference.monto,
    lastMonthKey: reference.mesLiquidacion,
    lastDate: reference.dateKey,
    transactionCount: group.expenses.length,
    monthCount: earlyMonths.length,
  };
}

function isFrequentGroup(group: ExpenseGroup) {
  const monthCount = groupByMonth(group.expenses).size;

  if (
    group.expenses.length >= FREQUENT_MIN_TRANSACTIONS &&
    monthCount >= FREQUENT_MIN_MONTHS
  ) {
    return true;
  }

  return (
    group.expenses.length >= FREQUENT_MONTHLY_MIN_TRANSACTIONS &&
    monthCount >= FREQUENT_MONTHLY_MIN_MONTHS
  );
}

function toTemplate(group: ExpenseGroup, expenses: readonly ObservedExpense[]): ExpenseTemplate {
  const reference = latestExpense(expenses);

  return {
    normalizedName: group.normalizedName,
    displayName: chooseDisplayName(expenses),
    categoria: group.categoria,
    pagadoPor: group.pagadoPor,
    lastAmount: reference?.monto ?? 0,
    lastMonthKey: reference?.mesLiquidacion ?? "",
    lastDate: reference?.dateKey ?? "",
    transactionCount: expenses.length,
    monthCount: groupByMonth(expenses).size,
  };
}

function isEarlySingleMonth(expenses: readonly ObservedExpense[]) {
  const [onlyExpense] = expenses;

  return (
    expenses.length === 1 &&
    onlyExpense !== undefined &&
    onlyExpense.day !== null &&
    onlyExpense.day >= 1 &&
    onlyExpense.day <= MONTH_START_MAX_DAY
  );
}

function groupByMonth(expenses: readonly ObservedExpense[]) {
  const buckets = new Map<string, ObservedExpense[]>();

  expenses.forEach((expense) => {
    const bucket = buckets.get(expense.mesLiquidacion) ?? [];
    bucket.push(expense);
    buckets.set(expense.mesLiquidacion, bucket);
  });

  return buckets;
}

function chooseDisplayName(expenses: readonly ObservedExpense[]) {
  const spellings = new Map<
    string,
    { text: string; count: number; lastMonthKey: string; lastDate: string; lastSequence: number }
  >();

  expenses.forEach((expense) => {
    const spelling = spellings.get(expense.displayName) ?? {
      text: expense.displayName,
      count: 0,
      lastMonthKey: "",
      lastDate: "",
      lastSequence: -1,
    };
    spelling.count += 1;

    if (isAfterSnapshot(expense, spelling)) {
      spelling.lastMonthKey = expense.mesLiquidacion;
      spelling.lastDate = expense.dateKey;
      spelling.lastSequence = expense.sequence;
    }

    spellings.set(expense.displayName, spelling);
  });

  const [winner] = Array.from(spellings.values()).sort(
    (firstSpelling, secondSpelling) =>
      secondSpelling.count - firstSpelling.count ||
      secondSpelling.lastMonthKey.localeCompare(firstSpelling.lastMonthKey) ||
      secondSpelling.lastDate.localeCompare(firstSpelling.lastDate) ||
      secondSpelling.lastSequence - firstSpelling.lastSequence ||
      firstSpelling.text.localeCompare(secondSpelling.text, "es")
  );

  return winner?.text ?? "";
}

function latestExpense(expenses: readonly ObservedExpense[]) {
  return expenses.reduce<ObservedExpense | null>((latest, expense) => {
    if (!latest || isAfterExpense(expense, latest)) {
      return expense;
    }

    return latest;
  }, null);
}

function isAfterSnapshot(
  expense: ObservedExpense,
  snapshot: { lastMonthKey: string; lastDate: string; lastSequence: number }
) {
  if (expense.mesLiquidacion !== snapshot.lastMonthKey) {
    return expense.mesLiquidacion > snapshot.lastMonthKey;
  }

  if (expense.dateKey !== snapshot.lastDate) {
    return expense.dateKey > snapshot.lastDate;
  }

  return expense.sequence > snapshot.lastSequence;
}

function isAfterExpense(expense: ObservedExpense, other: ObservedExpense) {
  return isAfterSnapshot(expense, {
    lastMonthKey: other.mesLiquidacion,
    lastDate: other.dateKey,
    lastSequence: other.sequence,
  });
}

function compareTemplates(firstTemplate: ExpenseTemplate, secondTemplate: ExpenseTemplate) {
  return (
    secondTemplate.monthCount - firstTemplate.monthCount ||
    secondTemplate.transactionCount - firstTemplate.transactionCount ||
    secondTemplate.lastDate.localeCompare(firstTemplate.lastDate) ||
    secondTemplate.lastMonthKey.localeCompare(firstTemplate.lastMonthKey) ||
    firstTemplate.displayName.localeCompare(secondTemplate.displayName, "es")
  );
}

function templateKey(normalizedName: string, categoria: string) {
  return `${normalizedName}\u0000${categoria}`;
}

function readDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return toDateKey(year, month, day);
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

function roundCurrencyAmount(value: number) {
  return Number(value.toFixed(2));
}
