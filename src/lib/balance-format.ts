import { formatCurrency } from "@/lib/utils";

export function formatSignedBalance(
  amount: number | null,
  currency: "ARS" | "USD" = "ARS"
) {
  if (amount === null) {
    return null;
  }

  if (Math.abs(amount) < 0.01) {
    return "Al día";
  }

  return amount > 0
    ? `${formatCurrency(amount, currency)} a favor`
    : `${formatCurrency(Math.abs(amount), currency)} por cubrir`;
}
