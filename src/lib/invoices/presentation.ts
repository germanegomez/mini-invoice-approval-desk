import type { DisplayCategory, TabType } from "@/types/invoice";

export const tabCategories: Record<TabType, DisplayCategory[]> = {
  processing: ["PROCESSING"],
  needs_review: ["NEEDS_REVIEW"],
  approved_rejected: ["APPROVED", "REJECTED"],
};

// The same ordered decision table drives SQL (before pagination) and the pure view model.
const rules = [
  ["rejected", "REJECTED"],
  ["needsReview", "NEEDS_REVIEW"],
  ["approved", "APPROVED"],
] as const;
type Signal = typeof rules[number][0];

export function displayCategory(signals: Record<Signal, boolean>): DisplayCategory {
  return rules.find(([signal]) => signals[signal])?.[1] ?? "PROCESSING";
}

const matchRevision = "t.universal_raw_id = i.universal_raw_id AND t.extraction_revision = i.extraction_revision";
const openTask = `EXISTS (SELECT 1 FROM portal.human_tasks t WHERE ${matchRevision}
               AND t.status IN ('available', 'claimed', 'waiting_for_document'))`;
const outcome = (code: "rejected_final" | "ready_for_post_approval_processing" | "cancelled_internal" | "exception_closed") =>
  `EXISTS (SELECT 1 FROM portal.invoice_outcomes_v1 t WHERE ${matchRevision} AND t.outcome = '${code}')`;
const signals: Record<Signal, string> = {
  rejected: `i.processing_stage = 'rejected' OR ${outcome("rejected_final")}
    OR (NOT ${openTask} AND (${outcome("cancelled_internal")} OR ${outcome("exception_closed")}))`,
  needsReview: `i.requires_human_review OR i.processing_stage = 'requires_human_review'
    OR ((i.processing_stage = 'awaiting_classification' OR i.preparation_status = 'awaiting_classification')
        AND NOT i.classification_complete)
    OR ${openTask}`,
  approved: outcome("ready_for_post_approval_processing"),
};

export const categorySql = `CASE
  ${rules.map(([signal, category]) => `WHEN (${signals[signal]}) THEN '${category}'`).join("\n  ")}
  ELSE 'PROCESSING' END`;
