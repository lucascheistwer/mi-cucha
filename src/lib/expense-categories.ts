export const EXPENSE_CATEGORIES = [
  { value: "comida", label: "Comida", icon: "🍝" },
  { value: "transporte", label: "Transporte", icon: "🚌" },
  { value: "servicios", label: "Servicios", icon: "💡" },
  { value: "salidas-ocio", label: "Salidas/Ocio", icon: "🎉" },
  { value: "para-la-casa", label: "Para la Casa", icon: "🏠" },
  { value: "delivery", label: "Delivery", icon: "🛵" },
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