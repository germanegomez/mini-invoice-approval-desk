"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { InvoiceDetail } from "@/types/invoice";
import type { ClassificationCatalogs } from "@/lib/tasks/repository";
import { emptyAssignment, invalidField, sameAssignment, type Assignment, type Field } from "@/lib/tasks/classification";
import { formatCurrency } from "@/lib/utils";
import { ClassificationFields } from "./ClassificationFields";
import { InvoiceTotal } from "./InvoiceTotal";
import { BulkClassification, secondaryButton } from "./BulkClassification";

export interface DraftHandle { dirty: boolean; busy: boolean; save(): Promise<boolean>; discard(): void }
interface Edit { expected: Assignment; value: Assignment }
type Edits = Record<number, Edit>;
const requiredMessages = {
  costCenter: "Elegí un centro de costo vigente.",
  subCostCenter: "Elegí un subcentro vigente o dejalo vacío.",
  accountingAccount: "Elegí una cuenta contable vigente.",
};

function assignment({ costCenter, subCostCenter, accountingAccount }: Assignment): Assignment {
  return { costCenter, subCostCenter, accountingAccount };
}

export function ClassificationEditor({ invoice, onChanged, onDirtyChange, ref }: {
  invoice: InvoiceDetail; onChanged(): Promise<void> | void; onDirtyChange(value: boolean): void; ref: Ref<DraftHandle>;
}) {
  const prefix = useId();
  const catalogQuery = useQuery<ClassificationCatalogs>({
    queryKey: ["classification-catalogs", invoice.task?.id], staleTime: 0,
    queryFn: async () => {
      const response = await fetch("/api/classification-catalogs", { cache: "no-store" });
      if (!response.ok) throw new Error("Catálogo no disponible.");
      return (await response.json()).data;
    },
  });
  const catalog = catalogQuery.data;
  const [edits, setEdits] = useState<Edits>({});
  const [undo, setUndo] = useState<Edits | null>(null);
  const [bulk, setBulk] = useState(false);
  const [openLine, setOpenLine] = useState<number | null>(null);
  const [error, setError] = useState<{ line: number; field: Field } | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const { items } = invoice;
  const values = items.map(item => edits[item.lineNumber]?.value ?? assignment(item));
  const dirty = Object.keys(edits).length > 0;
  const canSave = invoice.allowedActions.includes("classification.save");
  const canComplete = invoice.allowedActions.includes("classification.complete");
  const ready = catalog ? values.filter(value => !invalidField(value, catalog, true)).length : 0;
  const money = (amount: string | null) => invoice.currency ? formatCurrency(amount, invoice.currency) : "—";
  useEffect(() => {
    onDirtyChange(dirty || busy);
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (dirty || busy) window.addEventListener("beforeunload", protect);
    return () => { window.removeEventListener("beforeunload", protect); onDirtyChange(false); };
  }, [dirty, busy, onDirtyChange]);

  function editLines(lines: number[], value: Assignment, batch = false) {
    const next = { ...edits };
    for (const item of items) {
      if (!lines.includes(item.lineNumber)) continue;
      const expected = next[item.lineNumber]?.expected ?? assignment(item);
      if (sameAssignment(expected, value)) delete next[item.lineNumber];
      else next[item.lineNumber] = { expected, value };
    }
    setEdits(next); setError(null); setUndo(batch ? edits : null);
    setNotice(batch ? "Asignación aplicada en borrador." : "");
    if (batch) setBulk(false);
  }
  function showField(line: number, field: Field) {
    setOpenLine(line); setError({ line, field });
    requestAnimationFrame(() => document.getElementById(prefix + "-" + line + "-" + field)?.focus());
  }
  async function save(complete = false) {
    if (!catalog || !invoice.task || pending.current || !(complete ? canComplete : canSave)) return false;
    for (const [index, item] of items.entries()) {
      if (!complete && !edits[item.lineNumber]) continue;
      const field = invalidField(values[index], catalog, complete);
      if (field) { showField(item.lineNumber, field); return false; }
    }
    if (!dirty && !complete) return true;
    const changes = Object.entries(edits).map(([line, edit]) => ({
      lineNumber: Number(line), ...edit.value, expected: edit.expected,
    }));
    const command = { expectedRevision: invoice.extractionRevision, complete, items: changes };
    const body = JSON.stringify(command);
    if (attempt.current?.body !== body) attempt.current = { body, key: crypto.randomUUID() };
    pending.current = true; setBusy(true); setNotice(""); setError(null);
    try {
      const response = await fetch("/api/tasks/" + invoice.task.id + "/classification", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...command, idempotencyKey: attempt.current.key }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        if (response.status < 500) attempt.current = null;
        if (payload.result?.startsWith("invalid_")) await catalogQuery.refetch();
        throw new Error(response.status === 403 ? "Ya no tenés permiso para editar esta tarea." :
          response.status === 409 ? "Cambió la tarea o su clasificación. Revisá la versión guardada antes de continuar." :
          "No se pudo guardar. Revisá los valores del catálogo y volvé a intentar.");
      }
      await onChanged();
      setEdits({}); setUndo(null); attempt.current = null;
      setNotice(complete ? "Clasificación completada." : "Borrador guardado.");
      return true;
    } catch (cause) {
      setNotice(cause instanceof TypeError ? "Falló la conexión. Podés reintentar sin perder el borrador." :
        cause instanceof Error ? cause.message : "No se pudo guardar el borrador.");
      return false;
    } finally { pending.current = false; setBusy(false); }
  }
  useImperativeHandle(ref, () => ({ dirty, busy, save: () => save(false), discard() { setEdits({}); setUndo(null); } }));

  return <section aria-label="Clasificación contable" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-bold">Clasificación contable</h3>
        {catalog && <p className="text-xs text-zinc-600 dark:text-zinc-400">{ready} de {items.length} ítems listos</p>}</div>
      {catalog && !bulk && <button type="button" disabled={busy} className={secondaryButton} onClick={() => setBulk(true)}>Aplicar a varios</button>}
    </div>
    {catalogQuery.isError && <div role="alert" className="text-xs">No se pudo cargar el catálogo. <button className="underline" onClick={() => void catalogQuery.refetch()}>Reintentar</button></div>}
    {catalogQuery.isPending && <p role="status" className="text-xs">Cargando catálogo…</p>}
    <fieldset disabled={busy} className="min-w-0 space-y-3">
      {catalog && bulk && <BulkClassification items={items} values={values} catalog={catalog} onClose={() => setBulk(false)} onApply={(lines, value) => editLines(lines, value, true)} />}
      {undo && <button type="button" className="text-xs underline" onClick={() => { setEdits(undo); setUndo(null); setNotice("Aplicación en bloque deshecha."); }}>Deshacer aplicación</button>}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {items.map((item, index) => {
            const n = item.lineNumber, expanded = n === openLine, value = values[index];
            const groupId = prefix + "-" + n;
            return <li key={n} className="p-3">
              <button type="button" className="flex w-full items-start justify-between gap-3 rounded text-left focus-visible:ring-2 focus-visible:ring-amber-500"
                aria-label={"Editar línea " + n} aria-expanded={expanded} aria-controls={expanded ? groupId : undefined}
                disabled={!catalog} onClick={() => setOpenLine(expanded ? null : n)}>
                <span className="min-w-0">
                  <span className="block font-mono text-[11px] text-zinc-600 dark:text-zinc-400">Línea {n}{item.code && " · " + item.code}</span>
                  <span className="block break-words text-sm font-medium">{item.description || "Sin descripción"}</span>
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400">{[item.quantity && "Cant. " + item.quantity, item.unit, item.unitPrice && money(item.unitPrice) + " c/u", item.vatCategory, item.vatRate].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="shrink-0 text-right"><span className="block font-mono text-xs font-semibold">{money(item.totalWithVat ?? item.subtotal)}</span>
                  <span className="mt-1 flex items-center justify-end gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {expanded ? <>Cerrar <ChevronUp aria-hidden size={14} /></> : <>Editar <ChevronDown aria-hidden size={14} /></>}</span></span>
              </button>
              {!expanded && !sameAssignment(value, emptyAssignment) && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{[value.costCenter, value.subCostCenter, value.accountingAccount].filter(Boolean).join(" · ")}</p>}
              {expanded && catalog && <div id={groupId} className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                <ClassificationFields value={value} catalog={catalog} groupId={groupId} error={error?.line === n ? error.field : undefined}
                  onChange={next => editLines([n], next)} />
                {error?.line === n && <p id={groupId + "-" + error.field + "-error"} role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">
                  Línea {n} · {item.description}. {requiredMessages[error.field]}</p>}
              </div>}
            </li>;
          })}
        </ol>
        <InvoiceTotal>{money(invoice.totalAmount)}</InvoiceTotal>
      </div>
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-zinc-200 bg-white py-2 dark:border-zinc-800 dark:bg-zinc-950">
        {canSave && <button type="button" className={secondaryButton} disabled={!catalog || !dirty} onClick={() => void save()}>Guardar borrador</button>}
        {canComplete && <button type="button" className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          disabled={!catalog || !items.length} onClick={() => void save(true)}>Completar clasificación</button>}
        {ready < items.length && catalog && <button type="button" className="text-xs underline" onClick={() => {
          const idx = values.findIndex(value => invalidField(value, catalog, true));
          if (idx >= 0) showField(items[idx].lineNumber, invalidField(values[idx], catalog, true)!);
        }}>Ir al próximo pendiente</button>}
      </div>
    </fieldset>
    <p role="status" className="text-xs">{notice || (dirty ? "Cambios sin guardar" : "")}</p>
  </section>;
}
