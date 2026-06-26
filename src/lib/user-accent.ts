import type { HouseholdUserOption } from "@/types/expense";

const USER_ACCENT_PALETTE = [
  {
    textClassName: "text-teal-800",
    softTextClassName: "text-teal-700",
    dotClassName: "bg-teal-500",
    backgroundClassName: "bg-teal-50",
    borderClassName: "border-teal-200",
  },
  {
    textClassName: "text-amber-800",
    softTextClassName: "text-amber-700",
    dotClassName: "bg-amber-500",
    backgroundClassName: "bg-amber-50",
    borderClassName: "border-amber-200",
  },
  {
    textClassName: "text-sky-800",
    softTextClassName: "text-sky-700",
    dotClassName: "bg-sky-500",
    backgroundClassName: "bg-sky-50",
    borderClassName: "border-sky-200",
  },
  {
    textClassName: "text-rose-800",
    softTextClassName: "text-rose-700",
    dotClassName: "bg-rose-500",
    backgroundClassName: "bg-rose-50",
    borderClassName: "border-rose-200",
  },
] as const;

const DEFAULT_USER_ACCENT = {
  textClassName: "text-stone-700",
  softTextClassName: "text-stone-600",
  dotClassName: "bg-stone-400",
  backgroundClassName: "bg-stone-100",
  borderClassName: "border-stone-200",
} as const;

export function getUserAccent(
  users: HouseholdUserOption[],
  userId: string | null | undefined
) {
  if (!userId) {
    return DEFAULT_USER_ACCENT;
  }

  const userIndex = users.findIndex((user) => user._id === userId);

  if (userIndex < 0) {
    return DEFAULT_USER_ACCENT;
  }

  return USER_ACCENT_PALETTE[userIndex % USER_ACCENT_PALETTE.length];
}
