import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { AuthAccessError, requireAuthenticatedUser } from "@/lib/auth/guard";
import { canReadWeeklyReport, readWeeklyReport, type WeeklyReport } from "@/lib/reports/server";
import { lastCompletedMonday, shiftDate, validWeek } from "@/lib/reports/period";

export const dynamic = "force-dynamic";
const card = "rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";
const sectionNames: Record<string,string> = {
  direction_approval: "Dirección", sector_approval: "Revisión del sector", accounting_classification: "Clasificación contable",
  correction: "Corrección de extracción", regularization: "Regularización posterior", error: "Errores técnicos abiertos",
  unassigned: "Sin tarea registrada",
};

const fmt = (n: number | null) => n === null ? "Sin dato" : n.toLocaleString("es-AR", { maximumFractionDigits: 6 });

function CaseGroup({ group }: { group: WeeklyReport["groups"][number] }) {
  return <details className="border-t py-3">
    <summary className="cursor-pointer"><b>{group.category === "intervention" && group.section === "correction"
      ? "Diferencia antes de contabilizar" : sectionNames[group.section] ?? group.section}</b> · {group.count}
      <span className="block pl-4 text-sm">{group.owner}{group.category === "queue" && (group.oldest_days === null
        ? " · Antigüedad sin dato" : ` · ${group.oldest_days} ${group.oldest_days === 1 ? "día" : "días"} de espera`)}
        {group.category === "intervention" && group.section === "regularization" && " · Factura ya contabilizada"}
        {group.category === "intervention" && group.section === "correction" && " · Incluida en pendientes"}</span>
    </summary>
    <ul className="mt-2 flex flex-wrap gap-3">{group.ids.map(id =>
      <li key={id}><Link className="underline" href={`/?invoice=${id}`}>Factura #{id}</Link></li>)}</ul>
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
  if (!validWeek(week, latest)) return <main className="mx-auto max-w-xl p-8">
    <h1>Elegí un lunes de una semana finalizada.</h1><Link className="underline" href="/resumen-semanal">Volver al informe</Link></main>;
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
  return <><Header /><main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
    <Link href="/" className="text-sm underline">‹ Volver a Facturas</Link>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Resumen semanal</h1>
        <p>Del {formatDate(week)} al {formatDate(shiftDate(week, 6))}</p>
        <p className="text-sm">Proveedores WF05 · Corte al {formatDate(report.cutoff)}, 00:00 (Argentina)</p></div>
      <form className="flex items-end gap-2"><label className="text-sm">Semana del lunes
        <input className="block rounded border bg-transparent px-2 py-1" type="date" name="semana" defaultValue={week}
          min="1970-01-05" max={latest} step="7" required /></label><button className="rounded border px-3 py-1">Consultar</button></form>
    </div>
    {report.missing_posting>0 && <p role="status" className={card}>Historial incompleto. Falta el evento de contabilización verificable en {report.missing_posting} factura(s). Los saldos y tiempos reflejan los movimientos documentados.</p>}
    {m.initial === 0 && m.received === 0 && m.reopened === 0 && !report.groups.length && !report.diagnostics.length &&
      <p className={card}>Semana sin movimientos ni pendientes en tu alcance.</p>}
    <section className={card}><h2 className="mb-3 text-lg font-semibold">Movimiento de facturas</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:justify-between">{metrics.map(([label,value]) =>
        <div key={label} className={`flex flex-col-reverse rounded-md px-3 py-2 ${label === "Pendientes al cierre" ? "bg-amber-50 dark:bg-amber-950" : ""}`}><dt className="text-sm">{label}</dt><dd className="text-2xl font-bold tabular-nums">{value}</dd></div>)}</dl>
      <p className="mt-2 text-xs">Otras salidas · {m.rejected} {m.rejected === 1 ? "rechazo" : "rechazos"} · {m.duplicates} {m.duplicates === 1 ? "duplicado vinculado" : "duplicados vinculados"} · {m.other} {m.other === 1 ? "cierre" : "cierres"}</p></section>
    <div className="grid gap-4 md:grid-cols-2"><section className={card}><h2 className="mb-3 text-lg font-semibold">¿Dónde están las pendientes?</h2>
      {queues.map(g => <CaseGroup key={g.section+g.owner} group={g} />)}{!queues.length && <p>Sin pendientes.</p>}</section>
      <section className={card}><h2 className="mb-3 text-lg font-semibold">Casos que requieren intervención</h2>
      {["correction","regularization","error"].map(section => {
        const g = interventions.find(row => row.section===section);
        return g ? <CaseGroup key={section} group={g} /> : <p className="border-t py-3" key={section}>{sectionNames[section]} · 0</p>;
      })}</section></div>
    <section className={card}><h2 className="text-lg font-semibold">Del ingreso a la contabilización</h2>
      <p className="my-2 text-2xl font-bold">{time.median === null ? "Sin observaciones" : fmt(time.median)+" h"}</p>
      <p>Mediana de {time.sample} facturas. Semana anterior · {time.previous_sample} facturas{time.previous !== null && ` · ${fmt(time.previous)} h`}.</p>
      <p>{time.median === null || time.previous === null ? "Sin base para comparar." : `Variación de la mediana · ${fmt(time.median-time.previous)} h`}</p></section>
    <details className={card}><summary className="cursor-pointer font-semibold">Diagnóstico técnico</summary>
      {report.diagnostics.length ? <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>
        {["Etapa","Eventos","p50 (ms)","p95 (ms)","Reintentos","Límites 429","Tokens entrada","Tokens salida","Costo (USD)"].map(h=><th className="px-2" key={h}>{h}</th>)}
      </tr></thead><tbody>{report.diagnostics.map(d=><tr key={d.stage}>
        <th className="px-2">{d.stage}</th>{[d.events,d.p50,d.p95,d.retries,d.rate_limits,d.input_tokens,d.output_tokens,d.cost].map((value,i)=><td className="p-2" key={i}>{fmt(value)}</td>)}
      </tr>)}</tbody></table></div> : <p>Sin eventos técnicos en el período.</p>}</details>
  </main></>;
}
