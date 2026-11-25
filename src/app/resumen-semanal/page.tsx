import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";
import { deskContent, metricLabel, metricValue, rowBorder, secondary } from "@/components/deskStyles";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Header } from "@/components/Header";
import { AuthAccessError, requireAuthenticatedUser } from "@/lib/auth/guard";
import { canReadWeeklyReport, readWeeklyReport, type WeeklyReport } from "@/lib/reports/server";
import { lastCompletedMonday, shiftDate, validWeek } from "@/lib/reports/period";

export const dynamic = "force-dynamic";
const card = "min-w-0 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-5";
const title = "text-sm font-semibold text-zinc-900 dark:text-zinc-100 sm:text-base";
const muted = "text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500";
const linkStyle = `rounded-sm font-mono text-xs font-semibold underline underline-offset-4 hover:text-amber-700 dark:hover:text-amber-400 ${focus}`;
const groupRow = `${rowBorder} py-2.5 last:border-0 sm:py-3`;
const sectionNames: Record<string,string> = {
  direction_approval: "Dirección", sector_approval: "Revisión del sector", accounting_classification: "Clasificación contable",
  correction: "Corrección de extracción", regularization: "Regularización posterior", error: "Errores técnicos abiertos",
  unassigned: "Sin tarea registrada",
};

const fmt = (n: number | null) => n === null ? "Sin dato" : n.toLocaleString("es-AR", { maximumFractionDigits: 6 });

function CaseGroup({ group }: { group: WeeklyReport["groups"][number] }) {
  return <details className={groupRow}>
    <summary className={`cursor-pointer rounded-sm text-xs sm:text-sm ${focus}`}><b>{group.category === "intervention" && group.section === "correction"
      ? "Diferencia antes de contabilizar" : sectionNames[group.section] ?? group.section}</b> · {group.count}
      <span className={`mt-1 block pl-4 ${muted}`}>{group.owner}{group.category === "queue" && (group.oldest_days === null
        ? " · Antigüedad sin dato" : ` · ${group.oldest_days} ${group.oldest_days === 1 ? "día" : "días"} de espera`)}
        {group.category === "intervention" && group.section === "regularization" && " · Factura ya contabilizada"}
        {group.category === "intervention" && group.section === "correction" && " · Incluida en pendientes"}</span>
    </summary>
    <ul className="mt-2 flex flex-wrap gap-3">{group.ids.map(id =>
      <li key={id}><Link className={linkStyle} href={`/?invoice=${id}`}>Factura #{id}</Link></li>)}</ul>
  </details>;
}

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
    <div className={card}><h1 className={title}>Elegí un lunes de una semana finalizada.</h1>
      <Link className={`mt-3 inline-block ${linkStyle}`} href="/resumen-semanal">Volver al informe</Link>
    </div>
  </main></>;
  const report = await readWeeklyReport(actor.id, week);
  const m = report.movement;
  const time = report.timing;
  const queues = report.groups.filter(g => g.category === "queue");
  const interventions = report.groups.filter(g => g.category === "intervention");
  const metrics = [
    ["Pendientes al inicio", m.initial], ["Ingresadas", "+" + m.received],
    ...(m.reopened ? [["Reabiertas", "+" + m.reopened]] : []),
    ["Contabilizadas", "−" + m.posted], ["Otras salidas", "−" + (m.rejected + m.duplicates + m.other)],
    ["Pendientes al cierre", m.final],
  ];
  return <><Header /><main className={deskContent}>
    <Link href="/" className={`inline-flex ${linkStyle}`}>‹ Volver a Facturas</Link>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-base font-bold tracking-tight sm:text-xl">Resumen semanal</h1>
        <p className="mt-1 text-sm font-medium">Del {formatDate(week)} al {formatDate(shiftDate(week, 6))}</p>
        <p className={muted}>Proveedores WF05 · Corte al {formatDate(report.cutoff)}, 00:00 (Argentina)</p></div>
      <form className="flex max-w-full flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-3"><label className="min-w-0 font-mono text-xs text-zinc-600 dark:text-zinc-400">Semana del lunes
        <input className={`mt-1 block h-9 max-w-full rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:[color-scheme:dark] ${focus}`} type="date" name="semana" defaultValue={week}
          min="1970-01-05" max={latest} step="7" required /></label><button className={`h-9 ${secondary} ${focus}`}>Consultar</button></form>
    </div>
    {report.missing_posting>0 && <p role="status" className={`${card} ${muted}`}>Historial incompleto. Falta el evento de contabilización verificable en {report.missing_posting} factura(s). Los saldos y tiempos reflejan los movimientos documentados.</p>}
    {m.initial === 0 && m.received === 0 && m.reopened === 0 && !report.groups.length && !report.diagnostics.length &&
      <p className={`${card} ${muted}`}>Semana sin movimientos ni pendientes en tu alcance.</p>}
    <section><h2 className={`mb-2.5 sm:mb-4 ${title}`}>Movimiento de facturas</h2>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none">{metrics.map(([label,value]) =>
        <div key={label} className={`min-w-0 rounded-xl border bg-white p-2.5 shadow-sm dark:bg-zinc-900/80 sm:p-4 ${label === "Pendientes al cierre" ? "border-amber-500/30" : "border-zinc-200 dark:border-zinc-800"}`}>
          <dt className={metricLabel}>{label}</dt><dd className={`mt-1.5 break-words sm:mt-3 ${metricValue}`}>{value}</dd></div>)}</dl>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Otras salidas · {m.rejected} {m.rejected === 1 ? "rechazo" : "rechazos"} · {m.duplicates} {m.duplicates === 1 ? "duplicado vinculado" : "duplicados vinculados"} · {m.other} {m.other === 1 ? "cierre" : "cierres"}</p></section>
    <div className="grid gap-4 md:grid-cols-2"><section className={card}><h2 className={`mb-2 ${title}`}>¿Dónde están las pendientes?</h2>
      {queues.map(g => <CaseGroup key={g.section+g.owner} group={g} />)}{!queues.length && <p className={muted}>Sin pendientes.</p>}</section>
      <section className={card}><h2 className={`mb-2 ${title}`}>Casos que requieren intervención</h2>
      {["correction","regularization","error"].map(section => {
        const g = interventions.find(row => row.section===section);
        return g ? <CaseGroup key={section} group={g} /> : <p className={`${groupRow} ${muted}`} key={section}>{sectionNames[section]} · 0</p>;
      })}</section></div>
    <section className={card}><h2 className={title}>Del ingreso a la contabilización</h2>
      <p className={`my-2 ${metricValue}`}>{time.median === null ? "Sin observaciones" : fmt(time.median)+" h"}</p>
      <p className={muted}>Mediana de {time.sample} facturas. Semana anterior · {time.previous_sample} facturas{time.previous !== null && ` · ${fmt(time.previous)} h`}.</p>
      <p className={muted}>{time.median === null || time.previous === null ? "Sin base para comparar." : `Variación de la mediana · ${fmt(time.median-time.previous)} h`}</p></section>
    <details className={card}><summary className={`cursor-pointer rounded-sm ${title} ${focus}`}>Diagnóstico técnico</summary>
      {report.diagnostics.length ? <div className="mt-3"><Table aria-label="Diagnóstico técnico"><TableHeader className="bg-zinc-50 dark:bg-zinc-950/80"><TableRow>
        {["Etapa","Eventos","p50 (ms)","p95 (ms)","Reintentos","Límites 429","Tokens entrada","Tokens salida","Costo (USD)"].map(h=><TableHead scope="col" className="whitespace-nowrap px-2" key={h}>{h}</TableHead>)}
      </TableRow></TableHeader><TableBody>{report.diagnostics.map(d=><TableRow key={d.stage}>
        <th scope="row" className="px-2 text-left font-mono text-xs font-medium">{d.stage}</th>{[d.events,d.p50,d.p95,d.retries,d.rate_limits,d.input_tokens,d.output_tokens,d.cost].map((value,i)=><TableCell className="p-2 font-mono text-xs tabular-nums" key={i}>{fmt(value)}</TableCell>)}
      </TableRow>)}</TableBody></Table></div> : <p className={muted}>Sin eventos técnicos en el período.</p>}</details>
  </main></>;
}
