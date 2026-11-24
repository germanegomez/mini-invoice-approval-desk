import { z } from "zod";

export const idempotencyKeySchema = z.string().uuid();

export const extractionDecisionSchema = z.object({
  caseId: z.string().min(1).max(255),
  expectedRevision: z.number().int().positive(),
  decision_id: idempotencyKeySchema,
  decision: z.enum(["match", "difference", "report_field", "propose", "confirm", "request_copy", "request_supplier", "link_supplier", "regularize"]),
  value: z.string().trim().min(1).max(1000).optional(),
  field: z.string().trim().min(1).max(160),
  difference: z.string().trim().min(1).max(160).optional(),
  reason: z.string().trim().max(1000).optional(),
  approvalTask: z.number().int().positive().optional(),
}).strict().refine(input => !input.difference || input.decision === "propose" || input.decision === "confirm")
  .refine(input => input.decision === "match" || (input.reason && !input.approvalTask))
  .refine(input => ["propose", "confirm", "link_supplier", "regularize"].includes(input.decision) ? Boolean(input.value) : input.value === undefined);
export type ExtractionDecisionInput = z.infer<typeof extractionDecisionSchema>;

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

const assignmentSchema = z.object({
  costCenter: z.string().trim().max(100).nullable(),
  subCostCenter: z.string().trim().max(100).nullable(),
  accountingAccount: z.string().trim().max(100).nullable(),
}).strict();

const classificationItemSchema = assignmentSchema.extend({
  lineNumber: z.number().int().positive(),
  expected: assignmentSchema.optional(),
});

export const classificationSchema = z.object({
  expectedRevision: z.number().int().positive(),
  idempotencyKey: idempotencyKeySchema,
  complete: z.boolean(),
  items: z.array(classificationItemSchema).max(500).refine(
    (items) => new Set(items.map((item) => item.lineNumber)).size === items.length,
    "Duplicate line number",
  ),
}).strict().refine(input => input.complete || input.items.length > 0, "Draft requires changes");

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

export const continuationSchema = z.object({
  humanOutcomeId: z.number().int().positive(),
  expectedRevision: z.number().int().positive(),
  idempotencyKey: idempotencyKeySchema,
  contractVersion: z.literal(1),
}).strict();

export type TaskActionInput = z.infer<typeof taskActionSchema>;
export type ClassificationInput = z.infer<typeof classificationSchema>;
export type StartCircuitInput = z.infer<typeof startCircuitSchema>;
export type ReplacementInput = z.infer<typeof replacementSchema>;
export type ContinuationInput = z.infer<typeof continuationSchema>;
