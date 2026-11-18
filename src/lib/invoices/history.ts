import type { InvoiceHistoryEvent } from "@/types/invoice";
import type { QueryExecutor } from "./repository";
import type { InvoiceReadScope } from "./scope";

const titles = new Map(Object.entries({
  start_human_circuit: "Inicio de la revisión",
  claim_task: "Tarea tomada",
  return_task: "Tarea devuelta",
  reassign_task: "Tarea reasignada",
  approve_stage: "Etapa aprobada",
  request_correction: "Corrección solicitada",
  request_credit_note: "Nota de crédito solicitada",
  request_corrected_invoice: "Factura corregida solicitada",
  cancel_internal: "Cancelación interna",
  resolve_exception: "Excepción resuelta",
  reject_final: "Rechazo definitivo",
  save_classification_draft: "Borrador de clasificación guardado",
  complete_classification: "Clasificación completada",
  credit_note: "Nota de crédito vinculada",
  corrected_invoice: "Factura corregida vinculada",
  revision_changed: "Nueva revisión del comprobante",
  enqueued: "Procesamiento posterior en cola",
  claimed: "Procesamiento posterior asignado",
  recovered: "Procesamiento posterior recuperado",
  running: "Procesamiento posterior iniciado",
  retry_scheduled: "Reintento de procesamiento programado",
  completed: "Procesamiento posterior completado",
  failed: "Procesamiento posterior fallido",
  superseded: "Procesamiento posterior reemplazado",
}));

const stages = new Map(Object.entries({
  sector_approval: "Sector", direction_approval: "Dirección", accounting_classification: "Contabilidad",
}));
const statuses = new Map(Object.entries({
  available: "Disponible", claimed: "Tomada", waiting_for_document: "En espera de documento",
  completed: "Completada", cancelled: "Cancelada", obsolete: "Obsoleta",
}));

interface HistoryRow extends Record<string, unknown> {
  action: string;
  stage: string | null;
  occurred_at: Date | string;
  actor: string | null;
  reason: string | null;
  revision: string | null;
  from_status: string | null;
  to_status: string | null;
  invalidated: boolean;
}

export async function readInvoiceHistory(
  query: QueryExecutor, scope: InvoiceReadScope, invoiceId: number,
): Promise<InvoiceHistoryEvent[]> {
  const allowedIds = scope.kind === "all" ? null : scope.kind === "ids" ? scope.universalRawIds : [];
  const rows = await query<HistoryRow>(`
    WITH selected AS (
      SELECT $1::integer AS id WHERE $2::integer[] IS NULL OR $1 = ANY($2)
    ), events AS (
      SELECT 1 AS source, d.id, d.decided_at AS occurred_at, d.actor_user_id, d.action,
             t.stage, t.extraction_revision::text AS revision, d.reason, d.previous_status AS from_status,
             d.resulting_status AS to_status, invalid.decision_id IS NOT NULL AS invalidated
        FROM selected s
        JOIN portal.human_tasks t ON t.universal_raw_id = s.id
        JOIN portal.human_decisions d ON d.task_id = t.id AND d.result = 'accepted'
        LEFT JOIN portal.human_decision_invalidations invalid ON invalid.decision_id = d.id
      UNION ALL
      SELECT 2, e.id, e.created_at, e.actor_user_id, e.event_type, NULL, j.extraction_revision::text,
             NULL, NULL, NULL, false
        FROM selected s
        JOIN portal.post_approval_jobs_v1 j ON j.universal_raw_id = s.id
        JOIN portal.post_approval_job_events_v1 e ON e.operation_id = j.id
       WHERE e.event_type IN ('enqueued','claimed','recovered','running','retry_scheduled','completed','failed','superseded')
      UNION ALL
      SELECT 3, l.id, l.created_at, l.actor_user_id, l.link_type, NULL, NULL, l.reason, NULL, NULL, false
        FROM selected s
        JOIN portal.document_links l ON s.id IN (l.original_universal_raw_id, l.replacement_universal_raw_id)
       WHERE $2 IS NULL OR (l.original_universal_raw_id = ANY($2) AND l.replacement_universal_raw_id = ANY($2))
      UNION ALL
      SELECT 4, a.id, a.occurred_at, NULL, 'revision_changed', NULL,
             a.new_values->>'extraction_revision', NULL, NULL, NULL, false
        FROM selected s
        JOIN portal.audit_events a ON a.resource_type = 'wf05_invoice' AND a.resource_id = s.id::text
       WHERE a.action = 'task.revision_obsolete' AND a.result = 'success'
    )
    SELECT e.action, e.stage, e.occurred_at, e.revision,
           CASE WHEN position('@' IN u.display_name) = 0 THEN u.display_name END AS actor, e.reason,
           e.from_status, e.to_status, e.invalidated
      FROM events e LEFT JOIN portal.users u ON u.id = e.actor_user_id
     ORDER BY e.occurred_at DESC, e.source, e.id DESC
  `, [invoiceId, allowedIds]);
  return rows.map(row => {
    const stage = stages.get(row.stage ?? "");
    const action = titles.get(row.action) ?? "Decisión registrada";
    return {
      title: stage ? `${stage} · ${action}` : action,
      occurredAt: new Date(row.occurred_at).toISOString(),
      actor: row.actor,
      reason: row.reason,
      revision: row.revision === null ? null : Number(row.revision),
      fromStatus: row.from_status !== row.to_status ? statuses.get(row.from_status ?? "") ?? null : null,
      toStatus: statuses.get(row.to_status ?? "") ?? null,
      invalidated: row.invalidated,
    };
  });
}
