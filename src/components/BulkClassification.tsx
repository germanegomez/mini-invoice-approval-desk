import { useState } from "react";
import type { InvoiceItem } from "@/types/invoice";
import type { ClassificationCatalogs } from "@/lib/tasks/repository";
import { emptyAssignment, sameAssignment, type Assignment } from "@/lib/tasks/classification";
import { ClassificationFields } from "./ClassificationFields";

export const secondaryButton = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800";

export function BulkClassification({ items, values, catalog, onApply, onClose }: {
  items: InvoiceItem[]; values: Assignment[]; catalog: ClassificationCatalogs;
  onApply(lines: number[], value: Assignment): void; onClose(): void;
}) {
  const [value, setValue] = useState(emptyAssignment);
  const [scope, setScope] = useState("empty");
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmation, setConfirmation] = useState("");
  const targets = items.filter((item, i) => scope === "all" ||
    (scope === "selected" ? selected.includes(item.lineNumber) : sameAssignment(values[i], emptyAssignment)));
  const lines = targets.map(item => item.lineNumber);
  const replaced = items.filter((item, i) => lines.includes(item.lineNumber) &&
    !sameAssignment(values[i], emptyAssignment) && !sameAssignment(values[i], value)).length;
  const signature = JSON.stringify([lines, value, replaced]);
  const confirm = replaced > 0 && confirmation === signature;
  function apply() {
    if (replaced && !confirm) { setConfirmation(signature); return; }
    onApply(lines, value);
  }
  return <section aria-label="Aplicar a varios" className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-50/50 p-3 dark:bg-amber-950/20">
    <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Aplicar a varios</h4>
      <button type="button" className="text-xs underline" onClick={onClose}>Cerrar</button></div>
    <ClassificationFields value={value} catalog={catalog} onChange={setValue} />
    <label className="flex flex-wrap items-center gap-2 text-xs">Aplicar en
      <select value={scope} className={secondaryButton} onChange={event => setScope(event.target.value)}>
        <option value="empty">Ítems vacíos</option><option value="all">Todos los ítems</option><option value="selected">Ítems seleccionados</option>
      </select>
    </label>
    {scope === "selected" && <fieldset className="max-h-40 space-y-1 overflow-y-auto rounded border border-zinc-300 p-2 dark:border-zinc-700">
      <legend className="px-1 text-xs">Elegí los renglones</legend>
      {items.map(item => <label key={item.lineNumber} className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={selected.includes(item.lineNumber)} onChange={event => setSelected(event.target.checked ?
          [...selected, item.lineNumber] : selected.filter(n => n !== item.lineNumber))} />
        Línea {item.lineNumber} · {[item.code, item.description].filter(Boolean).join(" · ")}
      </label>)}
    </fieldset>}
    {replaced > 0 && <p role="status" className="text-xs">Se reemplazará la asignación de {replaced} {replaced === 1 ? "renglón" : "renglones"} con valores previos.</p>}
    <button type="button" className={secondaryButton} disabled={!value.costCenter || !value.accountingAccount || !targets.length}
      onClick={apply}>{confirm ? "Confirmar reemplazo" : "Aplicar a " + targets.length + (targets.length === 1 ? " ítem" : " ítems")}</button>
  </section>;
}
