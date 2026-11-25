import Link from "next/link";
import {
  Activity, ArrowDownLeft, ArrowUpRight, CheckCheck, ChevronDown, ChevronRight, CircleCheck,
  Clock3, Inbox, Layers, RotateCcw, Timer, TriangleAlert, type LucideIcon,
} from "lucide-react";
import { Header } from "@/components/Header";
import { deskContent, rowBorder, secondary } from "@/components/deskStyles";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration } from "@/lib/reports/duration";
import { shiftDate } from "@/lib/reports/period";
import type { WeeklyReport } from "@/lib/reports/server";
import { formatDate } from "@/lib/utils";

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

const gray = "text-zinc-600 dark:text-zinc-400";
const number = "font-mono font-semibold tabular-nums tracking-tight";
const countBadge = "rounded-md px-2 py-0.5 text-xs font-mono font-semibold tabular-nums";
const palette = {
  gray: { edge: "border-zinc-200 dark:border-zinc-800", ink: gray, tint: "bg-zinc-100 dark:bg-zinc-800" },
  blue: { edge: "border-sky-600/25 dark:border-sky-400/25", ink: "text-sky-700 dark:text-sky-300", tint: "bg-sky-500/10" },
  green: { edge: "border-emerald-600/25 dark:border-emerald-400/25", ink: "text-emerald-700 dark:text-emerald-300", tint: "bg-emerald-500/10" },
  amber: { edge: "border-amber-600/30 dark:border-amber-400/30", ink: "text-amber-800 dark:text-amber-300", tint: "bg-amber-500/10" },
};
type Metric = { label: string; value: number; icon: LucideIcon; tone: keyof typeof palette; sign?: string };

function Movement({ movement: m }: { movement: WeeklyReport["movement"] }) {
  const metrics: Metric[] = [
    { label: "Pendientes al inicio", value: m.initial, icon: Layers, tone: "gray" },
    { label: "Ingresadas", value: m.received, sign: "+", icon: ArrowDownLeft, tone: "blue" },
  ];
  if (m.reopened) metrics.push({ label: "Reabiertas", value: m.reopened, sign: "+", icon: RotateCcw, tone: "blue" });
  metrics.push(
    { label: "Contabilizadas", value: m.posted, sign: "−", icon: CheckCheck, tone: "green" },
    { label: "Otras salidas", value: m.rejected + m.duplicates + m.other, sign: "−", icon: ArrowUpRight, tone: "gray" },
    { label: "Pendientes al cierre", value: m.final, icon: Clock3, tone: "amber" },
  );
  return <section>
    <h2 className={`mb-3 ${title}`}>Movimiento de facturas</h2>
    <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-flow-col md:auto-cols-fr md:grid-cols-none">
      {metrics.map(({ label, value, icon: Icon, tone, sign }) => {
        const { edge, ink, tint } = palette[value === 0 ? "gray" : tone];
        return <div key={label} className={`min-w-0 rounded-xl border bg-white p-3 shadow-sm dark:bg-zinc-900/80 sm:p-4 ${edge}`}>
          <dt className="flex flex-col items-start gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <span className={`rounded-lg p-1.5 ${ink} ${tint}`}><Icon aria-hidden size={16} /></span>
            {label}
          </dt>
          <dd className={`mt-1 break-words text-2xl sm:text-3xl ${number} ${ink}`}>{value ? sign : ""}{fmt(value)}</dd>
        </div>;
      })}
    </dl>
    <p className={`mt-2 text-xs ${gray}`}>Otras salidas · {m.rejected} {m.rejected === 1 ? "rechazo" : "rechazos"} · {m.duplicates} {m.duplicates === 1 ? "duplicado vinculado" : "duplicados vinculados"} · {m.other} {m.other === 1 ? "cierre" : "cierres"}</p>
  </section>;
}

function CaseGroup({ group }: { group: WeeklyReport["groups"][number] }) {
  const intervention = group.category === "intervention";
  const tone = group.count ? palette.amber : palette.gray;
  return <details className={`group ${groupRow}`}>
    <summary className={`flex cursor-pointer list-none items-start gap-2 rounded-sm [&::-webkit-details-marker]:hidden ${focus}`}>
      <ChevronRight size={15} aria-hidden className="mt-0.5 shrink-0 text-zinc-500 group-open:rotate-90" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{intervention && group.section === "correction"
          ? "Diferencia antes de contabilizar" : sectionNames[group.section] ?? group.section}</span>
        <span className={`mt-1 block ${muted}`}>{group.owner}{!intervention && (group.oldest_days === null
          ? " · Antigüedad sin dato" : ` · ${group.oldest_days} ${group.oldest_days === 1 ? "día" : "días"} de espera`)}
          {intervention && group.section === "regularization" && " · Factura ya contabilizada"}
          {intervention && group.section === "correction" && " · Incluida en pendientes"}</span>
      </span>
      <span className={`${countBadge} ${tone.tint} ${tone.ink}`}>{group.count}</span>
    </summary>
    <ul className="mt-2 flex flex-wrap gap-3 pl-6">{group.ids.map(id =>
      <li key={id}><Link className={linkStyle} href={`/?invoice=${id}`}>Factura #{id}</Link></li>)}</ul>
  </details>;
}

export function WeeklyReportView({ report, week, latest }: { report: WeeklyReport; week: string; latest: string }) {
  const m = report.movement;
  const time = report.timing;
  const queues = report.groups.filter(g => g.category === "queue");
  const interventions = report.groups.filter(g => g.category === "intervention");
  const openIntervention = interventions.some(g => g.count > 0);
  const InterventionIcon = openIntervention ? TriangleAlert : CircleCheck;
  return <><Header /><main className={deskContent}>
    <Link href="/" className={`inline-flex ${linkStyle}`}>‹ Volver a Facturas</Link>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Resumen semanal</h1>
        <p className="mt-1 text-sm font-medium">Del {formatDate(week)} al {formatDate(shiftDate(week, 6))}</p>
        <p className={muted}>Proveedores WF05 · Corte al {formatDate(report.cutoff)}, 00:00 (Argentina)</p></div>
      <form className="flex max-w-full flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-3"><label className="min-w-0 font-mono text-xs text-zinc-600 dark:text-zinc-400">Semana del lunes
        <input className={`mt-1 block h-9 max-w-full rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:[color-scheme:dark] ${focus}`} type="date" name="semana" defaultValue={week}
          min="1970-01-05" max={latest} step="7" required /></label><button className={`h-9 ${secondary} ${focus}`}>Consultar</button></form>
    </div>
    {report.missing_posting>0 && <p role="status" className={`${card} ${muted}`}>Historial incompleto. Falta el evento de contabilización verificable en {report.missing_posting} factura(s). Los saldos y tiempos reflejan los movimientos documentados.</p>}
    {m.initial === 0 && m.received === 0 && m.reopened === 0 && !report.groups.length && !report.diagnostics.length &&
      <p className={`${card} ${muted}`}>Semana sin movimientos ni pendientes en tu alcance.</p>}
    <Movement movement={m} />
    <div className="grid gap-3 md:grid-cols-2">
      <section className={`${card} ${queues.length ? "bg-gradient-to-br from-amber-500/[0.07] via-transparent to-transparent" : ""}`}>
        <h2 className={`mb-2 flex items-center gap-2.5 ${title}`}>
          <span className={`rounded-lg p-2 ${queues.length ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : gray}`}>
            <Inbox aria-hidden size={17} />
          </span>¿Dónde están las pendientes?
        </h2>
        {queues.map(g => <CaseGroup key={g.section+g.owner} group={g} />)}
        {!queues.length && <p className={muted}>Sin pendientes.</p>}
      </section>
      <section className={card}>
        <h2 className={`mb-2 flex items-center gap-2.5 ${title}`}>
          <span className={`rounded-lg p-2 ${openIntervention ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
            <InterventionIcon aria-hidden size={17} />
          </span>Casos que requieren intervención
        </h2>
        {["correction", "regularization", "error"].map(section => {
          const group = interventions.find(g => g.section === section);
          return group ? <CaseGroup key={section} group={group} /> :
            <p key={section} className={`flex items-center justify-between gap-3 ${groupRow} ${muted}`}>
              {sectionNames[section]} <span className={`${countBadge} ${palette.gray.tint} ${gray}`}>0</span>
            </p>;
        })}
      </section>
    </div>
    <section className={`${card} flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-sky-500/[0.07] to-transparent`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="shrink-0 rounded-lg bg-sky-500/10 p-2 text-sky-700 dark:text-sky-300"><Timer aria-hidden size={19} /></span>
        <div><h2 className={title}>Del ingreso a la contabilización</h2>
          <p className={`mt-1 ${muted}`}>Mediana de {time.sample} {time.sample === 1 ? "factura" : "facturas"}. Semana anterior · {time.previous_sample} {time.previous_sample === 1 ? "factura" : "facturas"}{time.previous !== null && ` · ${formatDuration(time.previous)}`}.</p>
          <p className={muted}>{time.median === null || time.previous === null ? "Sin base para comparar." : `Variación de la mediana · ${formatDuration(time.median - time.previous)}`}</p>
        </div>
      </div>
      <p className={`${number} ${time.median === null || time.median === 0 ? gray : "text-sky-800 dark:text-sky-200"} ${time.median === null ? "text-base" : "text-2xl sm:text-3xl"}`}>
        {time.median === null ? "Sin observaciones" : formatDuration(time.median)}
      </p>
    </section>
    <details className={`group ${card}`}>
      <summary className={`flex cursor-pointer list-none items-center gap-2.5 rounded-sm [&::-webkit-details-marker]:hidden ${title} ${focus}`}>
        <Activity aria-hidden size={17} className="text-zinc-500 dark:text-zinc-400" />Diagnóstico técnico
        <ChevronDown aria-hidden size={16} className="ml-auto text-zinc-500 group-open:rotate-180" />
      </summary>
      {report.diagnostics.length ? <div className="mt-3"><Table aria-label="Diagnóstico técnico"><TableHeader className="bg-zinc-50 dark:bg-zinc-950/80"><TableRow>
        {["Etapa","Eventos","p50 (ms)","p95 (ms)","Reintentos","Límites 429","Tokens entrada","Tokens salida","Costo (USD)"].map(h=><TableHead scope="col" className="whitespace-nowrap px-2" key={h}>{h}</TableHead>)}
      </TableRow></TableHeader><TableBody>{report.diagnostics.map(d=><TableRow key={d.stage}>
        <th scope="row" className="px-2 text-left font-mono text-xs font-medium">{d.stage}</th>{[d.events,d.p50,d.p95,d.retries,d.rate_limits,d.input_tokens,d.output_tokens,d.cost].map((value,i)=><TableCell className={`p-2 font-mono text-xs tabular-nums ${value === 0 ? gray : ""}`} key={i}>{fmt(value)}</TableCell>)}
      </TableRow>)}</TableBody></Table></div> : <p className={muted}>Sin eventos técnicos en el período.</p>}</details>
  </main></>;
}
