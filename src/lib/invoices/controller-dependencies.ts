import "server-only";

import { randomUUID } from "node:crypto";
import { requireAuthenticatedUser } from "@/lib/auth/guard";
import { resolveInvoiceReadScope } from "./scope-resolver";
import {
  getFilterOptions,
  getInvoiceDetail,
  getInvoiceStats,
  listInvoices,
  postgresQuery,
  recordInvoiceDetailAudit,
} from "./server-repository";
import type { InvoiceControllerDependencies } from "./controller";

export const invoiceControllerDependencies: InvoiceControllerDependencies = {
  authenticate: requireAuthenticatedUser,
  resolveScope: resolveInvoiceReadScope,
  list: (scope, filters) => listInvoices(postgresQuery, scope, filters),
  detail: (scope, id) => getInvoiceDetail(postgresQuery, scope, id),
  filterOptions: (scope) => getFilterOptions(postgresQuery, scope),
  stats: (scope) => getInvoiceStats(postgresQuery, scope),
  audit: (actor, id, result, requestId) =>
    recordInvoiceDetailAudit(postgresQuery, actor, id, result, requestId),
  createRequestId: randomUUID,
  now: () => new Date(),
};
