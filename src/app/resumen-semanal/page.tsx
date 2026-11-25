import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { deskContent } from "@/components/deskStyles";
import { AuthAccessError, requireAuthenticatedUser } from "@/lib/auth/guard";
import { canReadWeeklyReport, readWeeklyReport } from "@/lib/reports/server";
import { lastCompletedMonday, validWeek } from "@/lib/reports/period";
import { WeeklyReportView } from "./WeeklyReportView";

export const dynamic = "force-dynamic";

export default async function WeeklyPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  let actor;
  try {
    actor = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthAccessError && error.status === 401) redirect("/login");
    if (error instanceof AuthAccessError && error.status === 403) redirect("/access-denied");
    throw error;
  }
  if (!await canReadWeeklyReport(actor.id)) redirect("/access-denied");
  const latest = lastCompletedMonday();
  const week = (await searchParams).semana ?? latest;
  if (!validWeek(week, latest)) return <><Header /><main className={deskContent}>
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><h1 className="text-base font-semibold">Elegí un lunes de una semana finalizada.</h1>
      <Link className="mt-3 inline-block rounded-sm font-mono text-xs font-semibold underline underline-offset-4 focus-visible:outline-amber-500" href="/resumen-semanal">Volver al informe</Link>
    </div>
  </main></>;
  const report = await readWeeklyReport(actor.id, week);
  return <WeeklyReportView report={report} week={week} latest={latest} />;
}
