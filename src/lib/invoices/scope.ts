export type InvoiceReadScope =
  | { kind: "none" }
  | { kind: "all" }
  | { kind: "ids"; universalRawIds: readonly number[] };

export class InvoiceScopeError extends Error {
  readonly status = 403;

  constructor() {
    super("Invoice access is not configured");
    this.name = "InvoiceScopeError";
  }
}

export const noInvoiceReadScope = (): InvoiceReadScope => ({ kind: "none" });
export const allInvoiceReadScope = (): InvoiceReadScope => ({ kind: "all" });

export function invoiceIdsReadScope(ids: readonly number[]): InvoiceReadScope {
  const universalRawIds = [...new Set(ids)].filter(
    (id) => Number.isSafeInteger(id) && id > 0,
  );
  return { kind: "ids", universalRawIds };
}

export interface ResolvedInvoiceReadScopeRow {
  scope_kind: unknown;
  universal_raw_id: unknown;
}

export function resolvedInvoiceReadScope(
  rows: readonly ResolvedInvoiceReadScopeRow[],
): InvoiceReadScope {
  if (rows.length === 0) throw new Error("Invalid invoice scope contract");

  const kinds = new Set(rows.map((row) => row.scope_kind));
  if (
    kinds.size !== 1
    || !["all", "ids", "none"].includes(String(rows[0].scope_kind))
  ) {
    throw new Error("Invalid invoice scope contract");
  }

  const kind = rows[0].scope_kind;
  if (kind === "all" || kind === "none") {
    if (rows.some((row) => row.universal_raw_id !== null)) {
      throw new Error("Invalid invoice scope contract");
    }
    return kind === "all" ? allInvoiceReadScope() : noInvoiceReadScope();
  }

  const ids = rows
    .filter((row) => row.universal_raw_id !== null)
    .map((row) => Number(row.universal_raw_id));
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("Invalid invoice scope contract");
  }
  return invoiceIdsReadScope(ids);
}

export function requireConfiguredInvoiceScope(
  scope: InvoiceReadScope,
): Exclude<InvoiceReadScope, { kind: "none" }> {
  if (scope.kind === "none") throw new InvoiceScopeError();
  return scope;
}
