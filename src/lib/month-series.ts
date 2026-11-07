import { addMonthsToMonthKey } from "@/lib/date-helpers";

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function listMonthKeysInSpan(monthKeys: readonly string[]) {
  const validMonthKeys = monthKeys.filter((monthKey) => MONTH_KEY_PATTERN.test(monthKey)).sort();
  const startMonthKey = validMonthKeys[0];
  const endMonthKey = validMonthKeys[validMonthKeys.length - 1];

  if (!startMonthKey || !endMonthKey) {
    return [];
  }

  const span: string[] = [];
  let cursor = startMonthKey;

  while (span.length < 240 && cursor <= endMonthKey) {
    span.push(cursor);
    const nextMonthKey = addMonthsToMonthKey(cursor, 1);

    if (nextMonthKey <= cursor) {
      break;
    }

    cursor = nextMonthKey;
  }

  return span;
}
