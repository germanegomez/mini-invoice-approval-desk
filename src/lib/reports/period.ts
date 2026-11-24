export const zone = "America/Argentina/Buenos_Aires";
const dayMs = 86400000;

export function shiftDate(day: string, days: number): string {
  return new Date(Date.parse(day + "T00:00:00Z") + days * dayMs).toISOString().slice(0, 10);
}

export function lastCompletedMonday(now = new Date()): string {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const weekday = new Date(today + "T00:00:00Z").getUTCDay();
  return shiftDate(today, -7 - ((weekday + 6) % 7));
}

export function validWeek(day: unknown, latest: string): day is string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > latest || day < "0001-01-01") return false;
  const date = new Date(day + "T00:00:00Z");
  return date.getUTCDay() === 1 && date.toISOString().slice(0, 10) === day;
}
