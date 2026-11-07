"use client";

import type { FilterOptions, PreparationStatus, ProcessingStage } from "@/types/invoice";

export interface FilterState {
  search: string;
  processingStage: ProcessingStage | "";
  preparationStatus: PreparationStatus | "";
  currency: string;
  issueDateFrom: string;
  issueDateTo: string;
}

interface FilterBarProps {
  value: FilterState;
  options: FilterOptions;
  totalResults: number;
  onChange(value: FilterState): void;
}

const selectClass = "h-9 rounded-md border border-zinc-300 bg-white px-2 text-xs font-mono dark:border-zinc-700 dark:bg-zinc-950";

export function FilterBar({ value, options, totalResults, onChange }: FilterBarProps) {
  const update = (key: keyof FilterState, next: string) => onChange({ ...value, [key]: next });
  const active = Object.values(value).some(Boolean);
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="grid gap-2 md:grid-cols-3">
        <input
          aria-label="Buscar por CUIT, razón social o clave natural"
          className={`${selectClass} md:col-span-2`}
          maxLength={100}
          onChange={(event) => update("search", event.target.value)}
          placeholder="CUIT, razón social, punto de venta o comprobante"
          type="search"
          value={value.search}
        />
        <select
          aria-label="Estado de procesamiento"
          className={selectClass}
          onChange={(event) => update("processingStage", event.target.value)}
          value={value.processingStage}
        >
          <option value="">Todos los estados de procesamiento</option>
          {options.processingStages.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select
          aria-label="Estado de preparación"
          className={selectClass}
          onChange={(event) => update("preparationStatus", event.target.value)}
          value={value.preparationStatus}
        >
          <option value="">Todos los estados de preparación</option>
          {options.preparationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select
          aria-label="Moneda"
          className={selectClass}
          onChange={(event) => update("currency", event.target.value)}
          value={value.currency}
        >
          <option value="">Todas las monedas</option>
          {options.currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Emisión desde" className={selectClass} onChange={(event) => update("issueDateFrom", event.target.value)} type="date" value={value.issueDateFrom} />
          <input aria-label="Emisión hasta" className={selectClass} onChange={(event) => update("issueDateTo", event.target.value)} type="date" value={value.issueDateTo} />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{totalResults} facturas en esta página</span>
        {active && <button className="font-mono text-amber-700 hover:underline dark:text-amber-400" onClick={() => onChange({ search: "", processingStage: "", preparationStatus: "", currency: "", issueDateFrom: "", issueDateTo: "" })}>Limpiar filtros</button>}
      </div>
    </div>
  );
}
