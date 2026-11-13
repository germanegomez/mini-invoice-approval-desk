import type { InvoiceStats } from "@/types/invoice";
import { formatCurrency } from "@/lib/utils";

export function KPIBar({ stats }: { stats: InvoiceStats }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
        <p className="text-xs font-mono uppercase text-zinc-500">Alcance actual</p>
        <p className="mt-2 text-3xl font-bold tabular-nums">{stats.totalCount}</p>
        <p className="text-xs text-zinc-500">facturas visibles</p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
        <p className="text-xs font-mono uppercase text-zinc-500">Procesamiento de facturas</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {stats.processingStages.map((entry) => <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-mono" key={entry.code}>{entry.code}: {entry.count}</span>)}
        </div>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
        <p className="text-xs font-mono uppercase text-zinc-500">Totales por moneda</p>
        <div className="mt-2 space-y-1 text-sm font-mono">
          {stats.currencyTotals.length === 0 && <span className="text-zinc-500">Sin importes</span>}
          {stats.currencyTotals.map((entry, index) => (
            <div className="flex justify-between gap-3" key={`${entry.currency ?? "invalid"}-${index}`}>
              <span>{entry.currency ?? "Sin moneda"}</span>
              <span>{entry.currency ? formatCurrency(entry.amount, entry.currency) : "—"} <small className="text-zinc-500">({entry.excludedCount} excl.)</small></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
