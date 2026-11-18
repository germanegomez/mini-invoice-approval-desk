"use client";

import { useId, useState } from "react";
import type { HumanOutcome, InvoiceDetail } from "@/types/invoice";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const reviewResults: Record<HumanOutcome["outcome"], string> = {
  ready_for_post_approval_processing: "Factura aprobada",
  rejected_final: "Factura rechazada",
  cancelled_internal: "Factura anulada internamente",
  exception_closed: "Revisión cerrada por excepción",
};

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

export function TaskActionPanel({ invoice, onChanged, guard = action => action() }: {
  invoice: InvoiceDetail;
  guard?(action: () => void): void;
  onChanged(): Promise<void> | void;
}) {
  const task = invoice.task;
  const can = (code: string) => invoice.allowedActions.includes(code);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sectorId = useId();
  const [sectorRole, setSectorRole] = useState("purchasing");
  const startCircuit = async () => {
    setBusy(true); setMessage(null);
    try {
      await request("/api/circuits", "POST", {
        universalRawId: invoice.universalRawId,
        expectedRevision: invoice.extractionRevision,
        sectorRole,
        idempotencyKey: crypto.randomUUID(),
      });
      setMessage("Factura enviada a revisión."); await onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error"); }
    finally { setBusy(false); }
  };

  const processApprovedInvoice = async () => {
    if (!invoice.humanOutcome) return;
    setBusy(true); setMessage(null);
    try {
      await request("/api/continuations", "POST", {
        humanOutcomeId: invoice.humanOutcome.id,
        expectedRevision: invoice.extractionRevision,
        idempotencyKey: crypto.randomUUID(),
        contractVersion: 1,
      });
      setMessage("Factura aprobada encolada para procesamiento."); await onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Error"); }
    finally { setBusy(false); }
  };

  const canStart = !invoice.humanOutcome && can("task.start");
  if (!task && !canStart && !invoice.humanOutcome && !invoice.continuation) return null;
  if (!task) return <section className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
    <div>
      <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-400">Revisión de la factura</h3>
      {invoice.humanOutcome && <p>{reviewResults[invoice.humanOutcome.outcome]}</p>}
    </div>
    {invoice.continuation ? <div className="rounded border p-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500">Procesamiento posterior a la aprobación</h4>
      <p className="mt-1 font-mono text-xs">{invoice.continuation.status} · intento {invoice.continuation.attempts}/3</p>
      {invoice.continuation.errorCode && <p className="mt-1 text-xs text-rose-600">{invoice.continuation.errorCode}: {invoice.continuation.errorDetail}</p>}
    </div> : can("continuation.enqueue") ?
      <button disabled={busy} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 font-mono text-xs font-bold text-white" onClick={processApprovedInvoice}>Procesar factura aprobada</button> :
      canStart && <div className="space-y-2">
        <p className="text-zinc-600 dark:text-zinc-300">Elegí el sector que va a revisar primero esta factura.</p>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={sectorId} className="text-xs">Sector</label>
          <Select value={sectorRole} onValueChange={setSectorRole} disabled={busy}>
            <SelectTrigger id={sectorId} className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent updatePositionStrategy="always">
              <SelectItem value="purchasing">Compras</SelectItem>
              <SelectItem value="maintenance">Mantenimiento</SelectItem>
              <SelectItem value="billing">Facturación</SelectItem>
            </SelectContent>
          </Select>
          <button disabled={busy} className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 font-mono text-xs font-bold text-black" onClick={startCircuit}>Enviar a revisión</button>
        </div>
      </div>}
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

  const isAccounting = task.stage === "accounting_classification";
  const Operations = isAccounting ? "details" : "div";
  return (
    <section className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div><h3 className="text-xs font-mono uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-400">{isAccounting ? "Tarea de Contabilidad" : "Tarea humana"}</h3><p className="text-xs text-zinc-600 dark:text-zinc-400">{isAccounting ? (task.status === "available" ? "Disponible para tomar" : "Asignada") : [task.stage, task.queueRole, task.status, task.outcome].filter(Boolean).join(" · ")}</p></div>
      {can("task.claim") && <button disabled={busy} className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 font-mono text-xs font-bold text-black" onClick={() => guard(() => act("claim_task"))}>Tomar tarea</button>}
      {invoice.allowedActions.some(code => code !== "task.claim" && !code.startsWith("classification.")) && <Operations className="space-y-2">
        {isAccounting && <summary className="cursor-pointer text-xs font-medium">Otras acciones de la tarea</summary>}
        <label className="block text-xs">Motivo para devoluciones o acciones excepcionales<textarea className="mt-1 w-full rounded border bg-transparent p-2" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          {can("stage.approve") && <button disabled={busy} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 font-mono text-xs text-white" onClick={() => guard(() => act("approve_stage"))}>Aprobar etapa</button>}
          {can("correction.request") && <button disabled={busy || !reason.trim()} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-3 py-1.5 font-mono text-xs" onClick={() => guard(() => act("request_correction"))}>Solicitar corrección</button>}
          {task.stage === "sector_approval" && <>
            {can("supplier.credit_note.request") && <button disabled={busy || !reason.trim()} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-3 py-1.5 font-mono text-xs" onClick={() => guard(() => act("request_credit_note"))}>Solicitar nota de crédito</button>}
            {can("supplier.corrected_invoice.request") && <button disabled={busy || !reason.trim()} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-3 py-1.5 font-mono text-xs" onClick={() => guard(() => act("request_corrected_invoice"))}>Solicitar factura corregida</button>}
            {can("circuit.cancel_internal") && <button disabled={busy || !reason.trim()} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-3 py-1.5 font-mono text-xs" onClick={() => guard(() => act("cancel_internal"))}>Anular internamente</button>}
            {can("exception.resolve") && <button disabled={busy || !reason.trim()} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-3 py-1.5 font-mono text-xs" onClick={() => guard(() => act("resolve_exception", { resolutionCode: "advance_to_direction" }))}>Resolver excepción y avanzar</button>}
          </>}
          {can("task.return") && <button disabled={busy || !reason.trim()} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-3 py-1.5 font-mono text-xs" onClick={() => guard(() => act("return_task"))}>Devolver a bandeja</button>}
          {can("circuit.reject_final") && <button disabled={busy || !reason.trim()} className="rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 font-mono text-xs text-rose-600 dark:text-rose-400" onClick={() => guard(() => act("reject_final"))}>Rechazar definitivamente</button>}
        </div>
      </Operations>}
      {message && <p className="text-xs">{message}</p>}
    </section>
  );
}
