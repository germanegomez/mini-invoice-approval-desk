import { z } from "zod";
import {
  PREPARATION_STATUSES,
  PROCESSING_STAGES,
  type InvoiceFilters,
} from "@/types/invoice";
import { decodeInvoiceCursor } from "./cursor";

const canonicalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid date");

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || undefined);

const filterSchema = z.object({
  processingStage: z.enum(PROCESSING_STAGES).optional(),
  preparationStatus: z.enum(PREPARATION_STATUSES).optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  issueDateFrom: canonicalDate.optional(),
  issueDateTo: canonicalDate.optional(),
  search: optionalTrimmed(100),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict().superRefine((value, context) => {
  if (value.issueDateFrom && value.issueDateTo && value.issueDateFrom > value.issueDateTo) {
    context.addIssue({ code: "custom", message: "Invalid issue date range", path: ["issueDateTo"] });
  }
  if (value.cursor) {
    try {
      decodeInvoiceCursor(value.cursor);
    } catch {
      context.addIssue({ code: "custom", message: "Invalid cursor", path: ["cursor"] });
    }
  }
});

export function parseInvoiceFilters(params: URLSearchParams): InvoiceFilters {
  return filterSchema.parse(Object.fromEntries(params.entries()));
}

export function parseUniversalRawId(value: string): number {
  return z.coerce.number().int().positive().safe().parse(value);
}
