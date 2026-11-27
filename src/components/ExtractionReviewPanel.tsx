"use client";

import { formatDate } from "@/lib/utils";
import { useRef, useState } from "react";
import type { ExtractionReview, InvoiceDetail } from "@/types/invoice";
import type { ExtractionDecisionInput } from "@/lib/tasks/contracts";

const labels: Record<string, string> = {
  razon_social_emisor: "Razón social del emisor", nombre_comercial_emisor: "Nombre comercial",
  importe_total: "Importe total", subtotal: "Subtotal", punto_de_venta: "Punto de venta",
  comp_nro: "Número de comprobante", fecha_emision: "Fecha de emisión", moneda: "Moneda", cae: "CAE",
};

function displayValue(field: string, value: string | null | undefined) {
  if (!value) return "Sin dato";
  if (/^(fecha_|periodo_(desde|hasta)$)/.test(field) && /^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return formatDate(value);
  return value;
}

export function ExtractionReviewPanel({ invoice, review, guard, onChanged }: {
  invoice: InvoiceDetail; review: ExtractionReview;
  guard(action: () => void): void; onChanged(): Promise<void> | void;
}) {
  const firstObserved = review.sourceField || review.observedFields[0]?.split("/").at(-1) || "";
  const fields = Array.from(new Set([...Object.keys(review.values), ...Object.keys(review.proposals ?? {}),
    ...(review.sourceField ? [review.sourceField] : [])]));
  const [field, setField] = useState(fields.includes(firstObserved) ? firstObserved : "");
  const [other, setOther] = useState("");
  const [linkSource, setLinkSource] = useState(false);
  const [reason, setReason] = useState("");
  const [value, setValue] = useState("");
  const [replacement, setReplacement] = useState("");
  const [reference, setReference] = useState("");
  const [approve, setApprove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const retry = useRef<{ body: string; id: string } | null>(null);
  const selected = field === "other" ? other.trim() : field;
  const proposals = Object.entries(review.proposals ?? {}).filter(([difference, proposal]) =>
    proposal && (difference === selected || proposal.field === selected));
  const source = review.sourceField;
  const canLinkSource = source && !Object.hasOwn(review.values, source) && selected !== source
    && (!review.proposals || Object.hasOwn(review.proposals, source));
  const proposalDifference = canLinkSource && linkSource ? source : selected;
  async function send(decision: ExtractionDecisionInput["decision"], confirmation?: { difference: string; field: string; value: string }) {
    const typed = value.trim();
    let proposedValue = /^(fecha_|periodo_(desde|hasta)$)/.test(selected)
      ? typed.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$2-$1")
      : typed;
    if (selected === "fecha_inicio_actividades") proposedValue = proposedValue.replace(/^(\d{2})\/(\d{4})$/, "$2-$1");
    const values: Partial<Record<ExtractionDecisionInput["decision"], string>> = {
      confirm: confirmation?.value, propose: proposedValue, link_supplier: replacement.trim(), regularize: reference.trim(),
    };
    const body = {
      caseId: review.caseId, expectedRevision: review.revision, decision, field: confirmation?.field ?? (selected || "documento"),
      reason: decision !== "match" ? reason.trim() : undefined,
      value: values[decision],
      difference: decision === "propose" ? proposalDifference
        : confirmation?.difference,
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
        throw new Error(response.status === 422 ? "Revisá el campo, el valor y el original antes de enviar."
          : response.status === 409 ? "El caso o la etapa cambió. Revisá el detalle actualizado."
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
    {review.sourceField && <p>Campo indicado en la derivación · {labels[review.sourceField] ?? review.sourceField}</p>}
    {review.status !== "pending" ? <p>Caso cerrado</p> : review.referral ? <p role="status">{review.referral === "correction"
      ? "Derivada a corrección. La contabilización está bloqueada." : "Derivada a Contaduría para regularización."}</p>
      : !review.current ? <p>La revisión del caso ya no está vigente.</p> : null}
    <label className="block">Campo observado
      <select className="ml-2 rounded border bg-transparent p-1" value={field} onChange={e => {
        setField(e.target.value);
        setLinkSource(false);
        setValue("");
      }}>
        <option value="">Elegí el campo</option>
        {fields.map(key => <option key={key} value={key}>{labels[key] ?? key}</option>)}
        <option value="other">Otro campo</option>
      </select>
    </label>
    {field === "other" && <label className="block">Nombre del campo <input maxLength={160} value={other}
      onChange={e => setOther(e.target.value)} className="rounded border bg-transparent p-1" /></label>}
    {field && field !== "other" && <p>{review.posted ? "Valor contabilizado" : "Valor extraído"} · <strong>{displayValue(field, review.values[field])}</strong></p>}
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
    {review.referral === "regularization" && review.posted && review.current && review.accounting && review.status === "pending" &&
      <fieldset disabled={busy} className="space-y-2">
        <label className="block">Resultado de la regularización <textarea value={reason} maxLength={1000}
          onChange={e => setReason(e.target.value)} className="block w-full rounded border p-2" /></label>
        <label className="block">Referencia verificable del trámite <input value={reference} maxLength={1000}
          onChange={e => setReference(e.target.value)} className="block w-full rounded border p-1" /></label>
        <button disabled={!reason.trim() || !reference.trim()} className="rounded border px-3 py-2 disabled:opacity-50"
          onClick={() => guard(() => { void send("regularize"); })}>Cerrar regularización</button>
      </fieldset>}
    {review.documentWait && <p role="status">{{
      legible_copy: "Pendiente de copia legible.", supplier_document: "Pendiente del comprobante corregido del proveedor.",
      replacement_linked: "Comprobante corregido vinculado al original.",
    }[review.documentWait]}</p>}
    {review.referral === "correction" && !review.documentWait && review.canDecide && review.current && review.status === "pending" &&
      <fieldset disabled={busy} className="space-y-2">
        <label className="block">Valor que figura en el original
          <input value={value} maxLength={1000} onChange={e => setValue(e.target.value)} className="block rounded border p-1" />
        </label>
        {/(^| · )(importe_total|subtotal|precio_unitario|cantidad)$/.test(selected) && <p>Sin separador de miles. Por ejemplo, 18500,00.</p>}
        <label className="block">Motivo de la propuesta o confirmación
          <textarea value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} className="block w-full rounded border p-2" />
        </label>
        {canLinkSource && Object.hasOwn(review.values, selected) && <label className="block">
          <input type="checkbox" checked={linkSource} onChange={e => setLinkSource(e.target.checked)} /> Vincular esta propuesta con la observación «{source}»
        </label>}
        <button disabled={!Object.hasOwn(review.values, selected) || !reason.trim() || !value.trim()}
          className="rounded border px-3 py-2 disabled:opacity-50"
          onClick={() => guard(() => { void send("propose"); })}>Proponer corrección</button>
        {proposals.map(([difference, proposal]) => proposal && <div key={difference}>
          <p>{labels[proposal.field] ?? proposal.field} · Valor propuesto · <strong>{displayValue(proposal.field, proposal.value)}</strong>.
            {" "}Diferencia que se resolverá · {difference}</p>
          {review.accounting && <button disabled={!reason.trim()} className="rounded border px-3 py-2 disabled:opacity-50"
            onClick={() => guard(() => { void send("confirm", { difference, field: proposal.field, value: proposal.value }); })}>
            Contrasté el original y confirmo {displayValue(proposal.field, proposal.value)}
          </button>}
        </div>)}
        <button disabled={!selected || field === "other" || !reason.trim()} className="rounded border px-3 py-2 disabled:opacity-50"
          onClick={() => guard(() => { void send("report_field"); })}>Registrar otra diferencia</button>
        <button disabled={!reason.trim()} className="rounded border px-3 py-2 disabled:opacity-50"
          onClick={() => guard(() => { void send("request_copy"); })}>Solicitar copia legible</button>
        {review.canRequestSupplier && <button disabled={!reason.trim()} className="rounded border px-3 py-2 disabled:opacity-50"
          onClick={() => guard(() => { void send("request_supplier"); })}>Registrar solicitud de comprobante corregido</button>}
      </fieldset>}
    {review.current && review.canLink && review.documentWait === "supplier_document" && <fieldset disabled={busy} className="space-y-2">
      <label className="block">ID de la factura corregida <input inputMode="numeric" value={replacement}
        onChange={e => setReplacement(e.target.value)} className="rounded border p-1" /></label>
      <label className="block">Motivo del vínculo <textarea value={reason} maxLength={1000} onChange={e => setReason(e.target.value)}
        className="block w-full rounded border p-2" /></label>
      <button disabled={!/^[1-9][0-9]{0,8}$/.test(replacement) || !reason.trim()} className="rounded border px-3 py-2 disabled:opacity-50"
        onClick={() => guard(() => { void send("link_supplier"); })}>Vincular comprobante corregido</button>
    </fieldset>}
  </section>;
}
