export const EXPENSE_CATEGORIES = [
  { value: "supermercado", label: "Supermercado", icon: "🛒" },
  { value: "delivery", label: "Delivery", icon: "🍔" },
  { value: "transporte", label: "Transporte", icon: "🚌" },
  { value: "hogar", label: "Hogar", icon: "🏠" },
  { value: "salud", label: "Salud", icon: "💊" },
  { value: "ocio", label: "Ocio", icon: "🎉" },
  { value: "servicios", label: "Servicios", icon: "💡" },
  { value: "otros", label: "Otros", icon: "✨" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseCategoryValue = ExpenseCategory["value"];

export const EXPENSE_CATEGORY_VALUES = EXPENSE_CATEGORIES.map(
  (category) => category.value
) as ExpenseCategoryValue[];

const expenseCategoryValueSet = new Set<string>(EXPENSE_CATEGORY_VALUES);

export function isExpenseCategoryValue(value: string): value is ExpenseCategoryValue {
  return expenseCategoryValueSet.has(value);
}