export const EXPENSE_CATEGORIES = [
  { value: "comida", label: "Comida", icon: "🍝" },
  { value: "transporte", label: "Transporte", icon: "🚌" },
  { value: "servicios", label: "Servicios", icon: "💡" },
  { value: "salidas-ocio", label: "Salidas/Ocio", icon: "🎉" },
  { value: "para-la-casa", label: "Para la Casa", icon: "🏠" },
  { value: "delivery", label: "Delivery", icon: "🛵" },
  { value: "supermercado", label: "Supermercado", icon: "🛒" },
  { value: "salud", label: "Salud", icon: "💊" },
  { value: "mascotas", label: "Mascotas", icon: "🐾" },
  { value: "suscripciones", label: "Suscripciones", icon: "📺" },
  { value: "ropa", label: "Ropa", icon: "👕" },
  { value: "educacion", label: "Educación", icon: "📚" },
  { value: "regalos", label: "Regalos", icon: "🎁" },
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