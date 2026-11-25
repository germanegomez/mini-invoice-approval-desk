"use client";

import { useState } from "react";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { deskContent, secondary } from "./deskStyles";
import { Header } from "./Header";
import { KPIBar } from "./KPIBar";
import { TabsNav } from "./TabsNav";
import { FilterBar } from "./FilterBar";
import { AdvancedFilters, type FilterState } from "./AdvancedFilters";
import { InvoiceTable } from "./InvoiceTable";
import { InvoiceDetailDrawer } from "./InvoiceDetailDrawer";
import { useInvoiceDetailQuery, useInvoicesQuery } from "@/hooks/useInvoices";
import { formatDateTime } from "@/lib/utils";
import type { TabType, DisplayCategory } from "@/types/invoice";

const emptyFilters: FilterState = { processingStage: "", preparationStatus: "", currency: "", issueDateFrom: "", issueDateTo: "" };

export function ApprovalDeskClient({ weeklyReport = false, initialInvoice = null }: { weeklyReport?: boolean; initialInvoice?: number | null }) {
  const [tab, setTab] = useState<TabType>("processing");
  const [search, setSearch] = useState("");
  const [vendor, setVendor] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [advanced, setAdvanced] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [selectedId, select] = useState<number | null>(initialInvoice);
  const list = useInvoicesQuery({
    tab, search, vendor, cursor: pages.at(-1),
    ...filters, processingStage: filters.processingStage || undefined,
    preparationStatus: filters.preparationStatus || undefined,
  });
  const [editing, setEditing] = useState(false);
  const detail = useInvoiceDetailQuery(selectedId, editing);
  const data = list.data;
  const rows = data?.data ?? [];
  const groups = data?.stats.categories ?? [];
  const counts: Record<DisplayCategory, number> = { PROCESSING: 0, NEEDS_REVIEW: 0, APPROVED: 0, REJECTED: 0 };
  for (const group of groups) counts[group.code] = group.count;
  const next = data?.nextCursor;
  function resetPage(update: () => void) { update(); setPages([]); }
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors duration-150">
      {/* Top Header */}
      <Header weeklyReport={weeklyReport} />

      {/* Main Container */}
      <main className={deskContent}>
        <section aria-label="Key Performance Indicators" className="w-full">
          <KPIBar stats={groups} />
        </section>
        <div className="space-y-2.5 sm:space-y-4 pt-1 sm:pt-2 w-full">
          <TabsNav currentTab={tab} counts={counts} onTabChange={value => resetPage(() => setTab(value))} />
          <FilterBar search={search} onSearchChange={value => resetPage(() => setSearch(value))}
            selectedVendor={vendor ? "vendor:" + vendor : "ALL"} onVendorChange={value => resetPage(() => setVendor(value === "ALL" ? "" : value.slice(7)))}
            vendors={data?.filterOptions.vendors ?? []} totalResults={rows.length} />
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-mono text-zinc-500">
            <span>{data && formatDateTime(data.lastUpdatedAt)}</span>
            <button className={secondary} aria-label="Actualizar" title="Actualizar" disabled={list.isFetching} onClick={() => void list.refetch()}><RefreshCw size={14} /></button>
            <button aria-expanded={advanced} aria-controls="advanced-filters" className={secondary} onClick={() => setAdvanced(!advanced)}><SlidersHorizontal size={14} />Filtros avanzados</button>
          </div>
          <div id="advanced-filters" hidden={!advanced}><AdvancedFilters value={filters} options={data?.filterOptions} onChange={value => resetPage(() => setFilters(value))} /></div>
          <section aria-label="Invoice List" className="w-full">
            {list.isError ? <div role="alert" className="rounded-xl border border-rose-500/30 p-6 text-sm text-center">
              <p>Unable to load invoices. Check the database connection and try again.</p>
              <button onClick={() => void list.refetch()} className="mt-3 underline underline-offset-4">Try again</button>
            </div> : <InvoiceTable invoices={rows} selectedInvoiceId={selectedId} isLoading={list.isLoading}
              emptyScope={data?.stats.totalCount === 0} onSelectInvoice={invoice => select(invoice.universalRawId)} />}
          </section>
          {(next || pages.length > 0) && <nav aria-label="Paginación" className="flex justify-end gap-2">
            <button className={secondary} disabled={!pages.length} onClick={() => setPages(history => history.slice(0,-1))}>Anterior</button>
            <button className={secondary} disabled={!next} onClick={() => next && setPages(history => [...history,next])}>Siguiente</button>
          </nav>}
        </div>
      </main>
      <InvoiceDetailDrawer onDirtyChange={setEditing} invoice={detail.data?.data ?? null} isLoading={detail.isLoading} open={selectedId !== null}
        onOpenChange={open => { if (!open) select(null); }}
        onChanged={async () => { await Promise.all([list.refetch(), detail.refetch()]); }} />
      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-900 bg-white/70 dark:bg-zinc-950/80 py-3.5 sm:py-4 text-center text-[11px] sm:text-xs font-mono text-zinc-500 dark:text-zinc-600 transition-colors px-3">
        <p>Mini Invoice Approval Desk &bull; Built by <a className="underline underline-offset-4" href="https://github.com/mussaddiqmahmood7">Mussaddiq Mahmood</a></p>
      </footer>
    </div>
  );
}
