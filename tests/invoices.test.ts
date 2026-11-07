import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceTable } from "../src/components/InvoiceTable";
import { decodeInvoiceCursor, encodeInvoiceCursor } from "../src/lib/invoices/cursor";
import {
  getInvoiceDetail,
  getInvoiceStats,
  listInvoices,
  mapInvoiceSummary,
  recordInvoiceDetailAudit,
  type QueryExecutor,
} from "../src/lib/invoices/repository";
import {
  allInvoiceReadScope,
  invoiceIdsReadScope,
  noInvoiceReadScope,
} from "../src/lib/invoices/scope";
import {
  handleInvoiceDetail,
  handleInvoiceList,
  type InvoiceControllerDependencies,
} from "../src/lib/invoices/controller";
import { parseInvoiceFilters } from "../src/lib/invoices/validation";
import type { InvoiceDetail, InvoiceStats, InvoiceSummary } from "../src/types/invoice";

const headerRow = {
  universal_raw_id: 41,
  extraction_revision: 3,
  processing_stage: "linked_duplicate" as const,
  preparation_status: "classified" as const,
  requires_human_review: true,
  classification_complete: false,
  created_at: "2026-11-01T10:00:00.000Z",
  updated_at: "2026-11-02T10:00:00.000Z",
  file_name: "synthetic-invoice.pdf",
  tipo_comprobante: "Factura",
  tipo_factura: "A",
  punto_de_venta: "0001",
  comp_nro: "00000042",
  fecha_emision: "2026-10-31",
  fecha_vencimiento_pago: null,
  moneda: "ARS",
  importe_total: "1200.50",
  cuit_emisor: "20111111112",
  razon_social_emisor: "Proveedor sintético",
  cuit_receptor: null,
  razon_social_receptor: null,
  raw_text: "must-never-leave-the-repository",
  llm_raw_response: { secret: true },
  source_reference: "drive://forbidden",
};

const summary = mapInvoiceSummary(headerRow);
const detail: InvoiceDetail = { ...summary, items: [], task: null };
const stats: InvoiceStats = {
  totalCount: 1,
  processingStages: [{ code: "linked_duplicate", count: 1 }],
  preparationStatuses: [{ code: "classified", count: 1 }],
  currencyTotals: [{ currency: "ARS", amount: "1200.50", includedCount: 1, excludedCount: 0 }],
};

function queuedQuery(responses: unknown[][]) {
  const calls: Array<{ text: string; parameters: readonly unknown[] }> = [];
  const query = (async <T extends Record<string, unknown>>(text: string, parameters: readonly unknown[]) => {
    calls.push({ text, parameters });
    return (responses.shift() ?? []) as T[];
  }) as QueryExecutor;
  return { query, calls };
}

function dependencies(overrides: Partial<InvoiceControllerDependencies> = {}): InvoiceControllerDependencies {
  return {
    authenticate: async () => ({ id: "7" }),
    resolveScope: async () => allInvoiceReadScope(),
    list: async () => ({ data: [summary], nextCursor: null }),
    detail: async () => detail,
    filterOptions: async () => ({ processingStages: ["linked_duplicate"], preparationStatuses: ["classified"], currencies: ["ARS"] }),
    stats: async () => stats,
    audit: async () => undefined,
    createRequestId: () => "00000000-0000-4000-8000-000000000059",
    now: () => new Date("2026-11-07T12:00:00.000Z"),
    ...overrides,
  };
}

test("cursor is opaque, versioned, canonical and rejects malformed values", () => {
  const encoded = encodeInvoiceCursor({ updatedAt: "2026-11-02T10:00:00.000Z", universalRawId: 41 });
  assert.deepEqual(decodeInvoiceCursor(encoded), { updatedAt: "2026-11-02T10:00:00.000Z", universalRawId: 41 });
  assert.throws(() => decodeInvoiceCursor("not-a-cursor"), /Invalid cursor/);
  const futureVersion = Buffer.from(JSON.stringify({ v: 2, updatedAt: "2026-11-02T10:00:00.000Z", universalRawId: 41 })).toString("base64url");
  assert.throws(() => decodeInvoiceCursor(futureVersion), /Invalid cursor/);
});

test("filters are allowlisted, bounded and default to 25 rows", () => {
  const parsed = parseInvoiceFilters(new URLSearchParams("processingStage=linked_duplicate&currency=ARS"));
  assert.equal(parsed.limit, 25);
  assert.equal(parsed.processingStage, "linked_duplicate");
  assert.throws(() => parseInvoiceFilters(new URLSearchParams("processingStage=APPROVED")));
  assert.throws(() => parseInvoiceFilters(new URLSearchParams("limit=101")));
  assert.throws(() => parseInvoiceFilters(new URLSearchParams("issueDateFrom=2026-11-03&issueDateTo=2026-11-02")));
  assert.throws(() => parseInvoiceFilters(new URLSearchParams("raw_text=please")));
});

test("scope variants normalize IDs and never default to all", () => {
  assert.deepEqual(noInvoiceReadScope(), { kind: "none" });
  assert.deepEqual(allInvoiceReadScope(), { kind: "all" });
  assert.deepEqual(invoiceIdsReadScope([41, 41, -1, 0, 55]), { kind: "ids", universalRawIds: [41, 55] });
  assert.deepEqual(invoiceIdsReadScope([]), { kind: "none" });
});

test("DTO mapping excludes raw, LLM, source and document fields", () => {
  const json = JSON.stringify(summary);
  for (const forbidden of ["raw_text", "llm_raw_response", "source_reference", "drive://", "secret"]) {
    assert.equal(json.includes(forbidden), false, forbidden);
  }
  assert.equal(summary.universalRawId, 41);
  assert.equal(summary.extractionRevision, 3);
  assert.equal(summary.dueDate, null);
});

test("list query uses the read view, ID scope and deterministic keyset without OFFSET", async () => {
  const { query, calls } = queuedQuery([[headerRow, { ...headerRow, universal_raw_id: 40 }]]);
  const page = await listInvoices(query, invoiceIdsReadScope([41, 55]), { limit: 1 });
  assert.equal(page.data.length, 1);
  assert.ok(page.nextCursor);
  assert.match(calls[0].text, /portal\.wf05_invoices_v1/);
  assert.match(calls[0].text, /updated_at DESC, i\.universal_raw_id DESC/);
  assert.doesNotMatch(calls[0].text, /OFFSET/i);
  assert.deepEqual(calls[0].parameters[0], [41, 55]);
  assert.equal(calls[0].parameters.at(-1), 2);
});

test("search remains parameterized and escapes SQL wildcard characters", async () => {
  const { query, calls } = queuedQuery([[]]);
  await listInvoices(query, allInvoiceReadScope(), { limit: 25, search: "Proveedor%_" });
  assert.doesNotMatch(calls[0].text, /Proveedor/);
  assert.equal(calls[0].parameters[0], "%Proveedor\\%\\_%");
  assert.match(calls[0].text, /concat_ws\('-', i\.punto_de_venta, i\.comp_nro\)/);
});

test("detail joins items to the exact current extraction revision and same scope", async () => {
  const item = {
    universal_raw_id: 41, extraction_revision: 3, numero_linea: 1,
    codigo: null, descripcion: null, cantidad: null, unidad_medida: null,
    precio_unitario: null, porcentaje_bonificacion: null, importe_bonificacion: null,
    subtotal: null, iva_categoria: null, iva_alicuota: null, importe_iva: null,
    subtotal_con_iva: null, centro_costo: null, sub_centro_costo: null,
    cuenta_contable: null, updated_at: "2026-11-02T10:00:00.000Z",
  };
  const { query, calls } = queuedQuery([[headerRow], [item], []]);
  const loaded = await getInvoiceDetail(query, invoiceIdsReadScope([41]), 41);
  assert.equal(loaded?.items[0].lineNumber, 1);
  assert.equal(loaded?.items[0].description, null);
  assert.match(calls[1].text, /portal\.wf05_invoice_items_v1/);
  assert.match(calls[1].text, /i\.extraction_revision = item\.extraction_revision/);
  assert.deepEqual(calls[1].parameters, [[41], 41, 3]);
  assert.equal(loaded?.task, null);
});

test("stats apply the same scope and keep currencies and invalid values separate", async () => {
  const calls: Array<{ text: string; parameters: readonly unknown[] }> = [];
  const query = (async <T extends Record<string, unknown>>(text: string, parameters: readonly unknown[]) => {
    calls.push({ text, parameters });
    if (text.includes("processing_stage AS code")) return [{ code: "processed", count: "2" }] as unknown as T[];
    if (text.includes("preparation_status AS code")) return [{ code: "posted", count: "2" }] as unknown as T[];
    return [
      { currency: "ARS", amount: "100.00", included_count: "1", excluded_count: "1" },
      { currency: null, amount: null, included_count: "0", excluded_count: "1" },
    ] as unknown as T[];
  }) as QueryExecutor;
  const result = await getInvoiceStats(query, invoiceIdsReadScope([41, 55]));
  assert.equal(result.totalCount, 2);
  assert.deepEqual(result.currencyTotals.map((row) => row.currency), ["ARS", null]);
  assert.equal(result.currencyTotals[0].excludedCount, 1);
  assert.ok(calls.every((call) => JSON.stringify(call.parameters[0]) === JSON.stringify([41, 55])));
});

test("authenticated users without configured scope receive 403 before list queries", async () => {
  let queried = false;
  const response = await handleInvoiceList(new Request("http://portal.local/api/invoices"), dependencies({
    resolveScope: async () => noInvoiceReadScope(),
    list: async () => { queried = true; return { data: [], nextCursor: null }; },
  }));
  assert.equal(response.status, 403);
  assert.equal(queried, false);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
});

test("list, filter options and indicators receive the exact same server scope", async () => {
  const scope = invoiceIdsReadScope([41]);
  const received: unknown[] = [];
  const response = await handleInvoiceList(
    new Request("http://portal.local/api/invoices?search=0001-00000042"),
    dependencies({
      resolveScope: async () => scope,
      list: async (value) => { received.push(value); return { data: [summary], nextCursor: null }; },
      filterOptions: async (value) => { received.push(value); return { processingStages: [], preparationStatuses: [], currencies: [] }; },
      stats: async (value) => { received.push(value); return stats; },
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(received, [scope, scope, scope]);
});

test("direct detail access conceals missing or out-of-scope IDs and audits only identifiers", async () => {
  const auditCalls: unknown[][] = [];
  const response = await handleInvoiceDetail("41", dependencies({
    resolveScope: async () => invoiceIdsReadScope([55]),
    detail: async () => null,
    audit: async (...args) => { auditCalls.push(args); },
  }));
  assert.equal(response.status, 404);
  assert.deepEqual(auditCalls, [["7", 41, "not_found_or_out_of_scope", "00000000-0000-4000-8000-000000000059"]]);
  assert.equal(JSON.stringify(auditCalls).includes("Proveedor"), false);
});

test("detail denial is 403 and successful detail is private and audited", async () => {
  const denied: unknown[][] = [];
  const deniedResponse = await handleInvoiceDetail("41", dependencies({
    resolveScope: async () => noInvoiceReadScope(),
    audit: async (...args) => { denied.push(args); },
  }));
  assert.equal(deniedResponse.status, 403);
  assert.equal(denied[0][2], "denied");

  const accepted: unknown[][] = [];
  const success = await handleInvoiceDetail("41", dependencies({ audit: async (...args) => { accepted.push(args); } }));
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("x-request-id"), "00000000-0000-4000-8000-000000000059");
  assert.equal(accepted[0][2], "success");
});

test("audit SQL stores only actor, invoice ID, bounded result and request ID", async () => {
  const { query, calls } = queuedQuery([[]]);
  await recordInvoiceDetailAudit(query, "7", 41, "success", "00000000-0000-4000-8000-000000000059");
  assert.deepEqual(calls[0].parameters, ["7", 41, "success", "00000000-0000-4000-8000-000000000059"]);
  assert.match(calls[0].text, /actor_user_id.*resource_id.*result.*request_id/s);
  assert.doesNotMatch(calls[0].text, /cuit|importe|filter|document|reason/i);
});

test("UI renders integer identity, current revision and real WF05 states", () => {
  const html = renderToStaticMarkup(
    createElement(InvoiceTable, {
      invoices: [summary as InvoiceSummary],
      isLoading: false,
      onSelectInvoice: () => undefined,
      selectedInvoiceId: 41,
    }),
  );
  assert.match(html, /ID 41/);
  assert.match(html, /rev\. 3/);
  assert.match(html, /linked duplicate/i);
  assert.match(html, /classified/i);
  assert.doesNotMatch(html, /APPROVED|NEEDS_REVIEW/);
});
