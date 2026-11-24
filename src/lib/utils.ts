import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const moneyFormat = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  currencyDisplay: "code",
  useGrouping: "always",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function currencyLabel(currency: string | null | undefined): string {
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return "—";
  return currency === "ARS" ? "$" : currency;
}

export function formatItemQuantity(quantity: string | null, unit: string | null): string {
  if (quantity == null) return "—";
  return unit && unit !== "unidad" ? `${quantity} ${unit}` : quantity;
}

function isDecimal(value: string): value is `${number}` {
  return /^-?\d+(?:\.\d+)?$/.test(value);
}

export function formatCurrency(amount: number | string | null | undefined, currency: string | null): string {
  const label = currencyLabel(currency);
  if (label === "—" || amount == null) return "—";
  if (typeof amount === "string" && !isDecimal(amount)) return "—";
  if (typeof amount === "number" && !Number.isFinite(amount)) return "—";
  return moneyFormat.formatToParts(amount)
    .filter(part => !(currency === "ARS" && part.type === "literal" && part.value.trim() === ""))
    .map(part => part.type === "currency" ? label : part.value)
    .join("");
}

const localTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const iso = date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : date;
  if (typeof iso !== "string") return "-";
  const match = /^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?(?:$|T)/.exec(iso);
  if (!match) return "-";
  const [, year, month, day] = match;
  return day ? `${day}/${month}/${year}` : `${month}/${year}`;
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const instant = new Date(date);
  return Number.isFinite(instant.getTime()) ? localTime.format(instant) : "-";
}

export function getStatusConfig(status: string) {
  switch (status) {
    case "APPROVED":
    case "processed":
    case "posted":
      return {
        label: status.replace(/_/g, " "),
        bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
        dot: "bg-emerald-400",
      };
    case "NEEDS_REVIEW":
    case "requires_human_review":
    case "awaiting_classification":
    case "extracted":
      return {
        label: status.replace(/_/g, " "),
        bg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
        dot: "bg-amber-400 animate-pulse",
      };
    case "linked_duplicate":
      return {
        label: "linked duplicate",
        bg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
        dot: "bg-amber-400",
      };
    case "REJECTED":
    case "rejected":
    case "error":
      return {
        label: status.replace(/_/g, " "),
        bg: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
        dot: "bg-rose-400",
      };
    default:
      return {
        label: status.replace(/_/g, " "),
        bg: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
        dot: "bg-sky-400",
      };
  }
}
