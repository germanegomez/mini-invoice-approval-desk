import "server-only";

import { client } from "@/db";
import type { AuthenticatedPortalUser } from "@/lib/auth/guard";
import {
  resolvedInvoiceReadScope,
  type InvoiceReadScope,
  type ResolvedInvoiceReadScopeRow,
} from "./scope";

export async function resolveInvoiceReadScope(
  user: AuthenticatedPortalUser,
): Promise<InvoiceReadScope> {
  const rows = await client`
    SELECT scope_kind, universal_raw_id
      FROM portal.resolve_invoice_read_scope_v2(${user.id}::bigint)
     ORDER BY universal_raw_id NULLS FIRST
  ` as unknown as ResolvedInvoiceReadScopeRow[];
  return resolvedInvoiceReadScope(rows);
}
