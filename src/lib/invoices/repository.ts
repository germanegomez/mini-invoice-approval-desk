import type { InvoiceReadScope } from "./scope";
import { decodeInvoiceCursor, encodeInvoiceCursor } from "./cursor";
import type {
  CurrencyTotal,
  FilterOptions,
  InvoiceDetail,
  InvoiceFilters,
  InvoiceItem,
  InvoiceStats,
  InvoiceSummary,
  HumanTask,
  HumanOutcome,
  Wf05Continuation,
  PreparationStatus,
  ProcessingStage,
  StageCount,
} from "@/types/invoice";

export interface QueryExecutor {
  <T extends Record<string, unknown>>(
    text: string,
    parameters: readonly unknown[],
  ): Promise<T[]>;
}

interface HeaderRow extends Record<string, unknown> {
  universal_raw_id: number;
  extraction_revision: number;
  processing_stage: ProcessingStage;
  preparation_status: PreparationStatus;
  requires_human_review: boolean;
  classification_complete: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  file_name: string;
  tipo_comprobante: string | null;
  tipo_factura: string | null;
  punto_de_venta: string | null;
  comp_nro: string | null;
  fecha_emision: string | null;
  fecha_vencimiento_pago: string | null;
  moneda: string | null;
  importe_total: string | null;
  cuit_emisor: string | null;
  razon_social_emisor: string | null;
  cuit_receptor: string | null;
  razon_social_receptor: string | null;
}

interface ItemRow extends Record<string, unknown> {
  universal_raw_id: number;
  extraction_revision: number;
  numero_linea: number;
  codigo: string | null;
  descripcion: string | null;
  cantidad: string | null;
  unidad_medida: string | null;
  precio_unitario: string | null;
  porcentaje_bonificacion: string | null;
  importe_bonificacion: string | null;
  subtotal: string | null;
  iva_categoria: string | null;
  iva_alicuota: string | null;
  importe_iva: string | null;
  subtotal_con_iva: string | null;
  centro_costo: string | null;
  sub_centro_costo: string | null;
  cuenta_contable: string | null;
  updated_at: Date | string;
}

interface TaskRow extends Record<string, unknown> {
  id: number | string;
  stage: HumanTask["stage"];
  queue_role: string;
  assignee_user_id: number | string | null;
  status: HumanTask["status"];
  outcome: string | null;
  updated_at: Date | string;
}

interface OutcomeRow extends Record<string, unknown> {
  id: number | string;
  outcome: HumanOutcome["outcome"];
  source_task_id: number | string;
  created_at: Date | string;
}

interface ContinuationRow extends Record<string, unknown> {
  id: string;
  contract_version: number;
  status: Wf05Continuation["status"];
  attempts: number;
  result: Record<string, unknown> | string | null;
  error_code: string | null;
  error_detail: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
}

const HEADER_COLUMNS = `
  i.universal_raw_id,
  i.extraction_revision,
  i.processing_stage,
  i.preparation_status,
  i.requires_human_review,
  i.classification_complete,
  i.created_at,
  i.updated_at,
  i.file_name,
  i.tipo_comprobante,
  i.tipo_factura,
  i.punto_de_venta,
  i.comp_nro,
  i.fecha_emision,
  i.fecha_vencimiento_pago,
  i.moneda,
  i.importe_total,
  i.cuit_emisor,
  i.razon_social_emisor,
  i.cuit_receptor,
  i.razon_social_receptor`;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapInvoiceSummary(row: HeaderRow): InvoiceSummary {
  return {
    universalRawId: Number(row.universal_raw_id),
    extractionRevision: Number(row.extraction_revision),
    processingStage: row.processing_stage,
    preparationStatus: row.preparation_status,
    requiresHumanReview: row.requires_human_review,
    classificationComplete: row.classification_complete,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    fileName: row.file_name,
    documentType: row.tipo_comprobante,
    invoiceLetter: row.tipo_factura,
    pointOfSale: row.punto_de_venta,
    documentNumber: row.comp_nro,
    issueDate: row.fecha_emision,
    dueDate: row.fecha_vencimiento_pago,
    currency: row.moneda,
    totalAmount: row.importe_total,
    issuerTaxId: row.cuit_emisor,
    issuerName: row.razon_social_emisor,
    receiverTaxId: row.cuit_receptor,
    receiverName: row.razon_social_receptor,
  };
}

export function mapInvoiceItem(row: ItemRow): InvoiceItem {
  return {
    universalRawId: Number(row.universal_raw_id),
    extractionRevision: Number(row.extraction_revision),
    lineNumber: Number(row.numero_linea),
    code: row.codigo,
    description: row.descripcion,
    quantity: row.cantidad,
    unit: row.unidad_medida,
    unitPrice: row.precio_unitario,
    discountPercentage: row.porcentaje_bonificacion,
    discountAmount: row.importe_bonificacion,
    subtotal: row.subtotal,
    vatCategory: row.iva_categoria,
    vatRate: row.iva_alicuota,
    vatAmount: row.importe_iva,
    totalWithVat: row.subtotal_con_iva,
    costCenter: row.centro_costo,
    subCostCenter: row.sub_centro_costo,
    accountingAccount: row.cuenta_contable,
    updatedAt: iso(row.updated_at),
  };
}

interface QueryParts {
  clauses: string[];
  parameters: unknown[];
}

function pushParameter(parts: QueryParts, value: unknown): string {
  parts.parameters.push(value);
  return `$${parts.parameters.length}`;
}

function addScope(parts: QueryParts, scope: InvoiceReadScope, alias = "i"): void {
  if (scope.kind === "none") {
    parts.clauses.push("FALSE");
  } else if (scope.kind === "ids") {
    const parameter = pushParameter(parts, scope.universalRawIds);
    parts.clauses.push(`${alias}.universal_raw_id = ANY(${parameter}::integer[])`);
  } else {
    parts.clauses.push("TRUE");
  }
}

function escapeLike(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

function scopedWhere(
  scope: InvoiceReadScope,
  filters?: InvoiceFilters,
  alias = "i",
): QueryParts {
  const parts: QueryParts = { clauses: [], parameters: [] };
  addScope(parts, scope, alias);
  if (!filters) return parts;

  if (filters.processingStage) {
    parts.clauses.push(`${alias}.processing_stage = ${pushParameter(parts, filters.processingStage)}`);
  }
  if (filters.preparationStatus) {
    parts.clauses.push(`${alias}.preparation_status = ${pushParameter(parts, filters.preparationStatus)}`);
  }
  if (filters.currency) {
    parts.clauses.push(`${alias}.moneda = ${pushParameter(parts, filters.currency)}`);
  }
  if (filters.issueDateFrom) {
    parts.clauses.push(`${alias}.fecha_emision >= ${pushParameter(parts, filters.issueDateFrom)}`);
  }
  if (filters.issueDateTo) {
    parts.clauses.push(`${alias}.fecha_emision <= ${pushParameter(parts, filters.issueDateTo)}`);
  }
  if (filters.search) {
    const search = pushParameter(parts, escapeLike(filters.search));
    parts.clauses.push(`(
      ${alias}.cuit_emisor ILIKE ${search} ESCAPE '\\'
      OR ${alias}.razon_social_emisor ILIKE ${search} ESCAPE '\\'
      OR ${alias}.cuit_receptor ILIKE ${search} ESCAPE '\\'
      OR ${alias}.razon_social_receptor ILIKE ${search} ESCAPE '\\'
      OR ${alias}.punto_de_venta ILIKE ${search} ESCAPE '\\'
      OR ${alias}.comp_nro ILIKE ${search} ESCAPE '\\'
      OR concat_ws('-', ${alias}.punto_de_venta, ${alias}.comp_nro) ILIKE ${search} ESCAPE '\\'
    )`);
  }
  if (filters.cursor) {
    const cursor = decodeInvoiceCursor(filters.cursor);
    const updatedAt = pushParameter(parts, cursor.updatedAt);
    const universalRawId = pushParameter(parts, cursor.universalRawId);
    parts.clauses.push(`(
      ${alias}.updated_at < ${updatedAt}::timestamptz
      OR (${alias}.updated_at = ${updatedAt}::timestamptz AND ${alias}.universal_raw_id < ${universalRawId})
    )`);
  }
  return parts;
}

export interface InvoicePage {
  data: InvoiceSummary[];
  nextCursor: string | null;
}

export async function listInvoices(
  query: QueryExecutor,
  scope: InvoiceReadScope,
  filters: InvoiceFilters,
): Promise<InvoicePage> {
  const parts = scopedWhere(scope, filters);
  const limit = pushParameter(parts, filters.limit + 1);
  const rows = await query<HeaderRow>(`
    SELECT ${HEADER_COLUMNS}
      FROM portal.wf05_invoices_v1 i
     WHERE ${parts.clauses.join(" AND ")}
     ORDER BY i.updated_at DESC, i.universal_raw_id DESC
     LIMIT ${limit}
  `, parts.parameters);
  const hasNextPage = rows.length > filters.limit;
  const visible = rows.slice(0, filters.limit).map(mapInvoiceSummary);
  const last = hasNextPage ? visible.at(-1) : undefined;
  return {
    data: visible,
    nextCursor: last
      ? encodeInvoiceCursor({ updatedAt: last.updatedAt, universalRawId: last.universalRawId })
      : null,
  };
}

export async function getInvoiceDetail(
  query: QueryExecutor,
  scope: InvoiceReadScope,
  universalRawId: number,
): Promise<InvoiceDetail | null> {
  const headerParts = scopedWhere(scope);
  headerParts.clauses.push(`i.universal_raw_id = ${pushParameter(headerParts, universalRawId)}`);
  const headers = await query<HeaderRow>(`
    SELECT ${HEADER_COLUMNS}
      FROM portal.wf05_invoices_v1 i
     WHERE ${headerParts.clauses.join(" AND ")}
     LIMIT 1
  `, headerParts.parameters);
  const header = headers[0];
  if (!header) return null;

  const itemParts = scopedWhere(scope);
  itemParts.clauses.push(`i.universal_raw_id = ${pushParameter(itemParts, universalRawId)}`);
  itemParts.clauses.push(`item.extraction_revision = ${pushParameter(itemParts, header.extraction_revision)}`);
  const items = await query<ItemRow>(`
    SELECT
      item.universal_raw_id,
      item.extraction_revision,
      item.numero_linea,
      item.codigo,
      item.descripcion,
      item.cantidad,
      item.unidad_medida,
      item.precio_unitario,
      item.porcentaje_bonificacion,
      item.importe_bonificacion,
      item.subtotal,
      item.iva_categoria,
      item.iva_alicuota,
      item.importe_iva,
      item.subtotal_con_iva,
      item.centro_costo,
      item.sub_centro_costo,
      item.cuenta_contable,
      item.updated_at
    FROM portal.wf05_invoice_items_v1 item
    JOIN portal.wf05_invoices_v1 i
      ON i.universal_raw_id = item.universal_raw_id
     AND i.extraction_revision = item.extraction_revision
    WHERE ${itemParts.clauses.join(" AND ")}
    ORDER BY item.numero_linea
  `, itemParts.parameters);
  const taskRows = await query<TaskRow>(`
    SELECT task.id, task.stage, role.code AS queue_role,
           task.assignee_user_id, task.status, task.outcome, task.updated_at
      FROM portal.human_tasks task
      JOIN portal.roles role ON role.id = task.queue_role_id
     WHERE task.universal_raw_id = $1
       AND task.extraction_revision = $2
       AND task.status IN ('available','claimed','waiting_for_document')
     ORDER BY task.id DESC
     LIMIT 1
  `, [universalRawId, header.extraction_revision]);
  const taskRow = taskRows[0];
  const task: HumanTask | null = taskRow ? {
    id: Number(taskRow.id),
    stage: taskRow.stage,
    queueRole: taskRow.queue_role,
    assigneeUserId: taskRow.assignee_user_id === null ? null : String(taskRow.assignee_user_id),
    status: taskRow.status,
    outcome: taskRow.outcome,
    updatedAt: iso(taskRow.updated_at),
  } : null;
  const outcomeRows = await query<OutcomeRow>(`
    SELECT id, outcome, source_task_id, created_at
      FROM portal.human_outcomes
     WHERE universal_raw_id = $1 AND extraction_revision = $2
     ORDER BY id DESC LIMIT 1
  `, [universalRawId, header.extraction_revision]);
  const outcomeRow = outcomeRows[0];
  const humanOutcome: HumanOutcome | null = outcomeRow ? {
    id: Number(outcomeRow.id), outcome: outcomeRow.outcome,
    sourceTaskId: Number(outcomeRow.source_task_id), createdAt: iso(outcomeRow.created_at),
  } : null;
  const continuationRows = await query<ContinuationRow>(`
    SELECT id, contract_version, status, attempts, result, error_code, error_detail,
           created_at, updated_at, completed_at
      FROM portal.wf05_continuation_operations
     WHERE universal_raw_id = $1 AND extraction_revision = $2
     ORDER BY created_at DESC LIMIT 1
  `, [universalRawId, header.extraction_revision]);
  const continuationRow = continuationRows[0];
  const continuation: Wf05Continuation | null = continuationRow ? {
    id: continuationRow.id,
    contractVersion: Number(continuationRow.contract_version),
    status: continuationRow.status,
    attempts: Number(continuationRow.attempts),
    result: typeof continuationRow.result === "string" ? JSON.parse(continuationRow.result) : continuationRow.result,
    errorCode: continuationRow.error_code,
    errorDetail: continuationRow.error_detail,
    createdAt: iso(continuationRow.created_at),
    updatedAt: iso(continuationRow.updated_at),
    completedAt: continuationRow.completed_at === null ? null : iso(continuationRow.completed_at),
  } : null;
  return { ...mapInvoiceSummary(header), items: items.map(mapInvoiceItem), task, humanOutcome, continuation };
}

export async function getFilterOptions(
  query: QueryExecutor,
  scope: InvoiceReadScope,
): Promise<FilterOptions> {
  const stageParts = scopedWhere(scope);
  const preparationParts = scopedWhere(scope);
  const currencyParts = scopedWhere(scope);
  const [stages, preparations, currencies] = await Promise.all([
    query<{ value: ProcessingStage }>(`
      SELECT DISTINCT i.processing_stage AS value
        FROM portal.wf05_invoices_v1 i
       WHERE ${stageParts.clauses.join(" AND ")}
       ORDER BY value
    `, stageParts.parameters),
    query<{ value: PreparationStatus }>(`
      SELECT DISTINCT i.preparation_status AS value
        FROM portal.wf05_invoices_v1 i
       WHERE ${preparationParts.clauses.join(" AND ")}
       ORDER BY value
    `, preparationParts.parameters),
    query<{ value: string }>(`
      SELECT DISTINCT i.moneda AS value
        FROM portal.wf05_invoices_v1 i
       WHERE ${currencyParts.clauses.join(" AND ")} AND i.moneda ~ '^[A-Z]{3}$'
       ORDER BY value
    `, currencyParts.parameters),
  ]);
  return {
    processingStages: stages.map((row) => row.value),
    preparationStatuses: preparations.map((row) => row.value),
    currencies: currencies.map((row) => row.value),
  };
}

interface CountRow extends Record<string, unknown> {
  code: string;
  count: string | number;
}

interface CurrencyRow extends Record<string, unknown> {
  currency: string | null;
  amount: string | null;
  included_count: string | number;
  excluded_count: string | number;
}

function mapCounts(rows: CountRow[]): StageCount[] {
  return rows.map((row) => ({ code: row.code, count: Number(row.count) }));
}

export async function getInvoiceStats(
  query: QueryExecutor,
  scope: InvoiceReadScope,
): Promise<InvoiceStats> {
  const processingParts = scopedWhere(scope);
  const preparationParts = scopedWhere(scope);
  const currencyParts = scopedWhere(scope);
  const [processingRows, preparationRows, currencyRows] = await Promise.all([
    query<CountRow>(`
      SELECT i.processing_stage AS code, count(*)::bigint AS count
        FROM portal.wf05_invoices_v1 i
       WHERE ${processingParts.clauses.join(" AND ")}
       GROUP BY i.processing_stage
       ORDER BY i.processing_stage
    `, processingParts.parameters),
    query<CountRow>(`
      SELECT i.preparation_status AS code, count(*)::bigint AS count
        FROM portal.wf05_invoices_v1 i
       WHERE ${preparationParts.clauses.join(" AND ")}
       GROUP BY i.preparation_status
       ORDER BY i.preparation_status
    `, preparationParts.parameters),
    query<CurrencyRow>(`
      SELECT
        i.moneda AS currency,
        CASE WHEN i.moneda ~ '^[A-Z]{3}$'
          THEN sum(i.importe_total::numeric) FILTER (
            WHERE i.importe_total ~ '^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$'
          )::text
          ELSE NULL
        END AS amount,
        count(*) FILTER (
          WHERE i.moneda ~ '^[A-Z]{3}$'
            AND i.importe_total ~ '^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$'
        )::bigint AS included_count,
        count(*) FILTER (
          WHERE i.moneda IS NULL
             OR i.moneda !~ '^[A-Z]{3}$'
             OR i.importe_total IS NULL
             OR i.importe_total !~ '^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$'
        )::bigint AS excluded_count
      FROM portal.wf05_invoices_v1 i
      WHERE ${currencyParts.clauses.join(" AND ")}
      GROUP BY i.moneda
      ORDER BY i.moneda NULLS LAST
    `, currencyParts.parameters),
  ]);
  const processingStages = mapCounts(processingRows);
  const currencyTotals: CurrencyTotal[] = currencyRows.map((row) => ({
    currency: row.currency,
    amount: row.amount,
    includedCount: Number(row.included_count),
    excludedCount: Number(row.excluded_count),
  }));
  return {
    totalCount: processingStages.reduce((total, row) => total + row.count, 0),
    processingStages,
    preparationStatuses: mapCounts(preparationRows),
    currencyTotals,
  };
}

export type InvoiceReadAuditResult = "success" | "denied" | "not_found_or_out_of_scope";

export async function recordInvoiceDetailAudit(
  query: QueryExecutor,
  actorUserId: string,
  universalRawId: number,
  result: InvoiceReadAuditResult,
  requestId: string,
): Promise<void> {
  await query(`
    INSERT INTO portal.audit_events(
      actor_user_id, action, resource_type, resource_id, result, request_id
    ) VALUES ($1::bigint, 'invoice.detail.read', 'wf05_invoice', $2::text, $3, $4)
  `, [actorUserId, universalRawId, result, requestId]);
}
