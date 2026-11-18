"use client";

import type { FilterOptions, PreparationStatus, ProcessingStage } from "@/types/invoice";

export interface FilterState {
  processingStage: ProcessingStage | "";
  preparationStatus: PreparationStatus | "";
  currency: string;
  issueDateFrom: string;
  issueDateTo: string;
}

interface AdvancedFiltersProps {
  value: FilterState;
  options?: FilterOptions;
  onChange(value: FilterState): void;
}

const selectClass = "w-full min-w-0 h-9 rounded-md border border-zinc-300 bg-white px-2 text-xs font-mono dark:border-zinc-700 dark:bg-zinc-950";

export function AdvancedFilters({ value, options, onChange }: AdvancedFiltersProps) {
  const update = (key: keyof FilterState, next: string) => onChange({ ...value, [key]: next });
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 sm:p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="grid gap-2 md:grid-cols-3">
        <select
          aria-label="Estado de procesamiento"
          className={selectClass}
          onChange={(event) => update("processingStage", event.target.value)}
          value={value.processingStage}
        >
          <option value="">Todos los estados de procesamiento</option>
          {options?.processingStages.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select
          aria-label="Estado de preparación"
          className={selectClass}
          onChange={(event) => update("preparationStatus", event.target.value)}
          value={value.preparationStatus}
        >
          <option value="">Todos los estados de preparación</option>
          {options?.preparationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select
          aria-label="Moneda"
          className={selectClass}
          onChange={(event) => update("currency", event.target.value)}
          value={value.currency}
        >
          <option value="">Todas las monedas</option>
          {options?.currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Emisión desde" className={selectClass} onChange={(event) => update("issueDateFrom", event.target.value)} type="date" value={value.issueDateFrom} />
          <input aria-label="Emisión hasta" className={selectClass} onChange={(event) => update("issueDateTo", event.target.value)} type="date" value={value.issueDateTo} />
        </div>
      </div>

    </div>
  );
}
