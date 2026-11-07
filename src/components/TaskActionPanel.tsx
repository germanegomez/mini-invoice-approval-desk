"use client";

import { useEffect, useState } from "react";
import type { InvoiceDetail } from "@/types/invoice";
import type { ClassificationCatalogs } from "@/lib/tasks/repository";

interface ItemDraft {
  lineNumber: number;
  costCenter: string;
  subCostCenter: string;
  accountingAccount: string;
}

async function request(path: string, method: string, body: unknown) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.result || payload.error || "La operación no pudo completarse");
  return payload;
}

export function TaskActionPanel({ invoice, onChanged }: {
  invoice: InvoiceDetail;
  onChanged(): Promise<void> | void;
}) {
  const task = invoice.task;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<ClassificationCatalogs | null>(null);
  const [sectorRole, setSectorRole] = useState<"purchasing" | "maintenance" | "billing">("purchasing");
  const [drafts, setDrafts] = useState<ItemDraft[]>(() => invoice.items.map((item) => ({
    lineNumber: item.lineNumber,
    costCenter: item.costCenter ?? "",
    subCostCenter: item.subCostCenter ?? "",
    accountingAccount: item.accountingAccount ?? "",
  })));

  useEffect(() => {
    if (task?.stage !== "accounting_classification") return;
    void fetch("/api/classification-catalogs", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => { if (payload.success) setCatalogs(payload.data); });
  }, [task?.stage]);

  const startCircuit = async () => {
    setBusy(true); setMessage(null);
    try {
      await request("/api/circuits", "POST", {
        universalRawId: invoice.universalRawId,
        expectedRevision: invoice.extractionRevision,
        sectorRole,
        idempotencyKey: crypto.randomUUID(),
      });
      setMessage("Circuito humano iniciado."); await onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error"); }
    finally { setBusy(false); }
  };

  if (!task) return <section className="space-y-3 rounded-lg border p-3 text-sm">
    <p className="text-zinc-500">No hay una tarea humana abierta para esta revisión.</p>
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs">Sector inicial<select className="ml-2 rounded border bg-transparent p-2" value={sectorRole} onChange={(event) => setSectorRole(event.target.value as typeof sectorRole)}><option value="purchasing">Compras</option><option value="maintenance">Mantenimiento</option><option value="billing">Facturación</option></select></label>
      <button disabled={busy} className="rounded bg-amber-500 px-3 py-2 text-xs font-bold text-black" onClick={startCircuit}>Iniciar circuito</button>
    </div>
    {message && <p className="text-xs">{message}</p>}
  </section>;

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true); setMessage(null);
    try {
      await request(`/api/tasks/${task.id}/actions`, "POST", {
        expectedRevision: invoice.extractionRevision,
        action,
        idempotencyKey: crypto.randomUUID(),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...extra,
      });
      setReason(""); setMessage("Operación registrada."); await onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error"); }
    finally { setBusy(false); }
  };

  const classify = async (complete: boolean) => {
    setBusy(true); setMessage(null);
    try {
      await request(`/api/tasks/${task.id}/classification`, "PATCH", {
        expectedRevision: invoice.extractionRevision,
        idempotencyKey: crypto.randomUUID(),
        complete,
        items: drafts.map((item) => ({
          lineNumber: item.lineNumber,
          costCenter: item.costCenter.trim() || null,
          subCostCenter: item.subCostCenter.trim() || null,
          accountingAccount: item.accountingAccount.trim() || null,
        })),
      });
      setMessage(complete ? "Clasificación completada." : "Borrador guardado.");
      await onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error"); }
    finally { setBusy(false); }
  };

  const updateDraft = (lineNumber: number, field: keyof Omit<ItemDraft, "lineNumber">, value: string) =>
    setDrafts((current) => current.map((item) => item.lineNumber === lineNumber ? { ...item, [field]: value } : item));

  return (
    <section className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div><h3 className="text-sm font-bold">Tarea humana #{task.id}</h3><p className="text-xs text-zinc-500">{task.stage} · {task.queueRole} · {task.status}</p></div>
      {task.status === "available" && <button disabled={busy} className="rounded bg-amber-500 px-3 py-2 text-xs font-bold text-black" onClick={() => act("claim_task")}>Tomar tarea</button>}
      {task.status !== "available" && <>
        {task.stage === "accounting_classification" && <div className="space-y-2">
          {drafts.map((item) => <div className="grid grid-cols-1 gap-2 rounded border p-2 sm:grid-cols-3" key={item.lineNumber}>
            <label className="text-xs">Centro · línea {item.lineNumber}<input list="cost-centers" className="mt-1 w-full rounded border bg-transparent p-2" value={item.costCenter} onChange={(event) => updateDraft(item.lineNumber,"costCenter",event.target.value)} /></label>
            <label className="text-xs">Subcentro<input list="subcost-centers" className="mt-1 w-full rounded border bg-transparent p-2" value={item.subCostCenter} onChange={(event) => updateDraft(item.lineNumber,"subCostCenter",event.target.value)} /></label>
            <label className="text-xs">Cuenta<input list="accounts" className="mt-1 w-full rounded border bg-transparent p-2" value={item.accountingAccount} onChange={(event) => updateDraft(item.lineNumber,"accountingAccount",event.target.value)} /></label>
          </div>)}
          <datalist id="cost-centers">{catalogs?.costCenters.map((entry) => <option key={entry.code} value={entry.code}>{entry.displayName}</option>)}</datalist>
          <datalist id="subcost-centers">{catalogs?.subCostCenters.map((entry) => <option key={`${entry.costCenterCode}:${entry.code}`} value={entry.code}>{entry.displayName}</option>)}</datalist>
          <datalist id="accounts">{catalogs?.accounts.map((entry) => <option key={entry.code} value={entry.code}>{entry.displayName}</option>)}</datalist>
          <div className="flex gap-2"><button disabled={busy} className="rounded border px-3 py-2 text-xs" onClick={() => classify(false)}>Guardar borrador</button><button disabled={busy} className="rounded bg-emerald-600 px-3 py-2 text-xs text-white" onClick={() => classify(true)}>Completar clasificación</button></div>
        </div>}
        <label className="block text-xs">Motivo para devoluciones o acciones excepcionales<textarea className="mt-1 w-full rounded border bg-transparent p-2" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          {(task.stage === "sector_approval" || task.stage === "direction_approval") && <button disabled={busy} className="rounded bg-emerald-600 px-3 py-2 text-xs text-white" onClick={() => act("approve_stage")}>Aprobar etapa</button>}
          {task.stage !== "sector_approval" && <button disabled={busy || !reason.trim()} className="rounded border px-3 py-2 text-xs" onClick={() => act("request_correction")}>Solicitar corrección</button>}
          {task.stage === "sector_approval" && <>
            <button disabled={busy || !reason.trim()} className="rounded border px-3 py-2 text-xs" onClick={() => act("request_credit_note")}>Solicitar nota de crédito</button>
            <button disabled={busy || !reason.trim()} className="rounded border px-3 py-2 text-xs" onClick={() => act("request_corrected_invoice")}>Solicitar factura corregida</button>
            <button disabled={busy || !reason.trim()} className="rounded border px-3 py-2 text-xs" onClick={() => act("cancel_internal")}>Anular internamente</button>
            <button disabled={busy || !reason.trim()} className="rounded border px-3 py-2 text-xs" onClick={() => act("resolve_exception", { resolutionCode: "advance_to_direction" })}>Resolver excepción y avanzar</button>
          </>}
          {task.status === "claimed" && <button disabled={busy || !reason.trim()} className="rounded border px-3 py-2 text-xs" onClick={() => act("return_task")}>Devolver a bandeja</button>}
          <button disabled={busy || !reason.trim()} className="rounded border border-rose-500 px-3 py-2 text-xs text-rose-600" onClick={() => act("reject_final")}>Rechazar definitivamente</button>
        </div>
      </>}
      {message && <p className="text-xs">{message}</p>}
    </section>
  );
}
