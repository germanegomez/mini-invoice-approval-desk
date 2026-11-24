"use client";

import { useRef, useState } from "react";
import type { ExtractionReview, InvoiceDetail } from "@/types/invoice";

const labels: Record<string, string> = {
  importe_total: "Importe total", subtotal: "Subtotal", punto_de_venta: "Punto de venta",
  comp_nro: "Número de comprobante", fecha_emision: "Fecha de emisión", moneda: "Moneda", cae: "CAE",
};

export function ExtractionReviewPanel({ invoice, review, guard, onChanged }: {
  invoice: InvoiceDetail; review: ExtractionReview;
  guard(action: () => void): void; onChanged(): Promise<void> | void;
}) {
  const firstObserved = review.observedFields[0]?.split("/").at(-1) ?? "";
  const [field, setField] = useState(Object.hasOwn(review.values, firstObserved) ? firstObserved : "");
  const [other, setOther] = useState("");
  const [reason, setReason] = useState("");
  const [approve, setApprove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const retry = useRef<{ body: string; id: string } | null>(null);
  const selected = field === "other" ? other.trim() : field;
  async function send(decision: "match" | "difference") {
    const body = {
      caseId: review.caseId, expectedRevision: review.revision, decision, field: selected,
      reason: decision === "difference" ? reason.trim() : undefined,
      approvalTask: decision === "match" && approve ? invoice.task?.id : undefined,
    };
    const fingerprint = JSON.stringify(body);
    if (retry.current?.body !== fingerprint) retry.current = { body: fingerprint, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/invoices/${invoice.universalRawId}/extraction-review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, decision_id: retry.current.id }),
      });
      if (!response.ok) {
        if (response.status === 409) await onChanged();
        throw new Error(response.status === 409 ? "El caso o la etapa cambió. Revisá el detalle actualizado."
          : response.status === 403 ? "Tu usuario no puede decidir sobre este caso." : "No se pudo confirmar el envío. Podés reintentarlo.");
      }
      await onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Error de conexión. Podés reintentar el envío."); }
    finally { setBusy(false); }
  }
  const actionable = review.canDecide && review.current && review.status === "pending" && !review.referral;
  return <section className="space-y-2 rounded-lg border p-3 text-sm">
    <h3 className="font-semibold">Advertencia de extracción · Revisión {review.revision}</h3>
    {review.warnings.map((warning, i) => <p key={i}>{typeof warning === "string" ? warning : JSON.stringify(warning)}</p>)}
    {review.observedFields.length > 0 && <p>Campos de la advertencia · {review.observedFields.join(", ")}</p>}
    {review.referral ? <p role="status">{review.referral === "correction"
      ? "Derivada a corrección. La contabilización está bloqueada." : "Derivada a Contaduría para regularización."}</p>
      : review.status !== "pending" ? <p>Caso cerrado</p> : !review.current ? <p>La revisión del caso ya no está vigente.</p> : null}
    <label className="block">Campo observado
      <select className="ml-2 rounded border bg-transparent p-1" value={field} onChange={e => setField(e.target.value)}>
        <option value="">Elegí el campo</option>
        {Object.keys(review.values).map(key => <option key={key} value={key}>{labels[key] ?? key}</option>)}
        <option value="other">Otro campo</option>
      </select>
    </label>
    {field === "other" && <label className="block">Nombre del campo <input maxLength={160} value={other}
      onChange={e => setOther(e.target.value)} className="rounded border bg-transparent p-1" /></label>}
    {field && field !== "other" && <p>{review.posted ? "Valor contabilizado" : "Valor extraído"} · <strong>{review.values[field]}</strong></p>}
    {actionable && <fieldset disabled={busy} className="space-y-2">
      <label className="block">Motivo de la diferencia <textarea maxLength={1000} value={reason}
        onChange={e => setReason(e.target.value)} className="block w-full rounded border bg-transparent p-2" /></label>
      {!review.posted && invoice.task && invoice.allowedActions.includes("stage.approve") && <label className="block">
        <input type="checkbox" checked={approve} onChange={e => setApprove(e.target.checked)} /> Aprobar también la etapa si el dato coincide
      </label>}
      <div className="flex flex-wrap gap-2">
        <button disabled={!field || field === "other"} className="rounded border px-3 py-2 disabled:opacity-50"
          onClick={() => guard(() => { void send("match"); })}>Verifiqué el dato y coincide</button>
        <button disabled={!selected || !reason.trim()} className="rounded border px-3 py-2 disabled:opacity-50"
          onClick={() => guard(() => { void send("difference"); })}>Encontré una diferencia</button>
      </div>
    </fieldset>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
