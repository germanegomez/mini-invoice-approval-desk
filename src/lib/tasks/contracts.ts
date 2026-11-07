import { z } from "zod";

export const idempotencyKeySchema = z.string().uuid();

export const taskActionSchema = z.object({
  expectedRevision: z.number().int().positive(),
  action: z.enum([
    "claim_task",
    "return_task",
    "reassign_task",
    "approve_stage",
    "request_correction",
    "request_credit_note",
    "request_corrected_invoice",
    "cancel_internal",
    "resolve_exception",
    "reject_final",
  ]),
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().min(1).max(1000).optional(),
  targetUserId: z.string().regex(/^[1-9][0-9]*$/).optional(),
  resolutionCode: z.enum(["advance_to_direction", "close_internal"]).optional(),
}).strict();

const classificationItemSchema = z.object({
  lineNumber: z.number().int().positive(),
  costCenter: z.string().trim().max(100).nullable(),
  subCostCenter: z.string().trim().max(100).nullable(),
  accountingAccount: z.string().trim().max(100).nullable(),
}).strict();

export const classificationSchema = z.object({
  expectedRevision: z.number().int().positive(),
  idempotencyKey: idempotencyKeySchema,
  complete: z.boolean(),
  items: z.array(classificationItemSchema).min(1).max(500).refine(
    (items) => new Set(items.map((item) => item.lineNumber)).size === items.length,
    "Duplicate line number",
  ),
}).strict();

export const startCircuitSchema = z.object({
  universalRawId: z.number().int().positive(),
  expectedRevision: z.number().int().positive(),
  sectorRole: z.enum(["purchasing", "maintenance", "billing"]),
  idempotencyKey: idempotencyKeySchema,
}).strict();

export const replacementSchema = z.object({
  originalUniversalRawId: z.number().int().positive(),
  replacementUniversalRawId: z.number().int().positive(),
  linkType: z.enum(["credit_note", "corrected_invoice"]),
  sectorRole: z.enum(["purchasing", "maintenance", "billing"]),
  reason: z.string().trim().min(1).max(1000),
  idempotencyKey: idempotencyKeySchema,
}).strict();

export type TaskActionInput = z.infer<typeof taskActionSchema>;
export type ClassificationInput = z.infer<typeof classificationSchema>;
export type StartCircuitInput = z.infer<typeof startCircuitSchema>;
export type ReplacementInput = z.infer<typeof replacementSchema>;
