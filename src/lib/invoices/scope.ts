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
  return universalRawIds.length === 0
    ? noInvoiceReadScope()
    : { kind: "ids", universalRawIds };
}

export function requireConfiguredInvoiceScope(
  scope: InvoiceReadScope,
): Exclude<InvoiceReadScope, { kind: "none" }> {
  if (scope.kind === "none") throw new InvoiceScopeError();
  return scope;
}
