import "server-only";

import { client } from "@/db";
import type { QueryExecutor } from "./repository";

export const postgresQuery: QueryExecutor = async <T extends Record<string, unknown>>(
  text: string,
  parameters: readonly unknown[],
): Promise<T[]> => client.unsafe(text, parameters as never[]) as unknown as Promise<T[]>;

export {
  getFilterOptions,
  getInvoiceDetail,
  getInvoiceStats,
  listInvoices,
  recordInvoiceDetailAudit,
} from "./repository";
