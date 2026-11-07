import "server-only";

import type { AuthenticatedPortalUser } from "@/lib/auth/guard";
import { noInvoiceReadScope, type InvoiceReadScope } from "./scope";

// #61 will replace this resolver with role/task assignment lookup. A valid
// authenticated session intentionally grants no invoice access in #59.
export async function resolveInvoiceReadScope(
  user: AuthenticatedPortalUser,
): Promise<InvoiceReadScope> {
  void user;
  return noInvoiceReadScope();
}
