"use client";

import { useMemo, useState } from "react";
import { Header } from "./Header";
import { KPIBar } from "./KPIBar";
import { FilterBar, type FilterState } from "./FilterBar";
import { InvoiceTable } from "./InvoiceTable";
import { InvoiceDetailDrawer } from "./InvoiceDetailDrawer";
import { useInvoiceDetailQuery, useInvoicesQuery } from "@/hooks/useInvoices";
import type { FilterOptions, InvoiceStats, InvoiceSummary } from "@/types/invoice";
import { formatDateTime } from "@/lib/utils";

const EMPTY_FILTERS: FilterState = { search: "", processingStage: "", preparationStatus: "", currency: "", issueDateFrom: "", issueDateTo: "" };
const EMPTY_OPTIONS: FilterOptions = { processingStages: [], preparationStatuses: [], currencies: [] };
const EMPTY_STATS: InvoiceStats = { totalCount: 0, processingStages: [], preparationStatuses: [], currencyTotals: [] };

export function ApprovalDeskClient() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryFilters = useMemo(() => ({
    processingStage: filters.processingStage || undefined,
    preparationStatus: filters.preparationStatus || undefined,
    currency: filters.currency || undefined,
    issueDateFrom: filters.issueDateFrom || undefined,
    issueDateTo: filters.issueDateTo || undefined,
    search: filters.search || undefined,
    cursor,
  }), [filters, cursor]);
  const list = useInvoicesQuery(queryFilters);
  const detail = useInvoiceDetailQuery(selectedId);
  const data = list.data?.data ?? [];

  const changeFilters = (next: FilterState) => {
    setFilters(next);
    setCursor(undefined);
    setCursorStack([]);
  };
  const selectInvoice = (invoice: InvoiceSummary) => setSelectedId(invoice.universalRawId);
  const nextPage = () => {
    if (!list.data?.nextCursor) return;
    setCursorStack((stack) => [...stack, cursor]);
    setCursor(list.data.nextCursor);
  };
  const previousPage = () => {
    setCursorStack((stack) => {
      const next = [...stack];
      setCursor(next.pop());
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Header />
      <main className="mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-xl font-bold">Facturas WF05</h1><p className="text-xs text-zinc-500">Read model de solo lectura · revisión vigente</p></div>
          <div className="flex items-center gap-3 text-xs text-zinc-500"><span>Actualizado: {list.data ? formatDateTime(list.data.lastUpdatedAt) : "—"}</span><button className="rounded-md border border-zinc-300 px-3 py-2 font-mono hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900" onClick={() => list.refetch()}>Actualizar</button></div>
        </div>
        <KPIBar stats={list.data?.stats ?? EMPTY_STATS} />
        <FilterBar onChange={changeFilters} options={list.data?.filterOptions ?? EMPTY_OPTIONS} totalResults={data.length} value={filters} />
        {list.isError && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm">{list.error.message}</div>}
        <InvoiceTable invoices={data} isLoading={list.isLoading} onSelectInvoice={selectInvoice} selectedInvoiceId={selectedId} />
        <div className="flex justify-end gap-2">
          <button className="rounded border px-3 py-2 text-xs disabled:opacity-40" disabled={cursorStack.length === 0} onClick={previousPage}>Anterior</button>
          <button className="rounded border px-3 py-2 text-xs disabled:opacity-40" disabled={!list.data?.nextCursor} onClick={nextPage}>Siguiente</button>
        </div>
      </main>
      <InvoiceDetailDrawer invoice={detail.data?.data ?? null} isLoading={detail.isLoading} onOpenChange={(open) => { if (!open) setSelectedId(null); }} open={selectedId !== null} />
    </div>
  );
}
