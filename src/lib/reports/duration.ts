/** Display weekly durations to the nearest minute, including signed changes in median. */
export function formatDuration(hours: number): string {
  const totalMinutes = Math.round(Math.abs(hours) * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const sign = hours < 0 && totalMinutes > 0 ? "−" : "";
  if (!wholeHours) return `${sign}${minutes} min`;
  return `${sign}${wholeHours} h${minutes ? ` ${minutes} min` : ""}`;
}
