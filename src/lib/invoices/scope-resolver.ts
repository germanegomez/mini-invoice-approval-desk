import "server-only";

import { client } from "@/db";
import type { AuthenticatedPortalUser } from "@/lib/auth/guard";
import { invoiceIdsReadScope, type InvoiceReadScope } from "./scope";

export async function resolveInvoiceReadScope(
  user: AuthenticatedPortalUser,
): Promise<InvoiceReadScope> {
  const rows = await client`
    SELECT universal_raw_id
      FROM portal.resolve_invoice_read_scope(${user.id}::bigint)
     ORDER BY universal_raw_id
  ` as unknown as Array<{ universal_raw_id: number | string }>;
  return invoiceIdsReadScope(rows.map((row) => Number(row.universal_raw_id)));
}
