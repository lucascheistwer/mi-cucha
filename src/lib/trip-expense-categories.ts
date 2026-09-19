export const TRIP_EXPENSE_CATEGORIES = [
  { value: "hospedaje", label: "Hospedaje", icon: "🛏️" },
  { value: "transporte", label: "Transporte", icon: "🚗" },
  { value: "supermercado", label: "Supermercado", icon: "🛒" },
  { value: "bar-restaurante", label: "Bar/Restaurante", icon: "🍽️" },
  { value: "atraccion", label: "Atracción", icon: "🎭" },
  { value: "compras-casa", label: "Compras para la casa", icon: "🏠" },
] as const;

export type TripExpenseCategory = (typeof TRIP_EXPENSE_CATEGORIES)[number];

export type TripExpenseCategoryValue = TripExpenseCategory["value"];

export const TRIP_EXPENSE_CATEGORY_VALUES = TRIP_EXPENSE_CATEGORIES.map(
  (category) => category.value
) as TripExpenseCategoryValue[];

const tripExpenseCategoryValueSet = new Set<string>(TRIP_EXPENSE_CATEGORY_VALUES);

export function isTripExpenseCategoryValue(value: string): value is TripExpenseCategoryValue {
  return tripExpenseCategoryValueSet.has(value);
}
