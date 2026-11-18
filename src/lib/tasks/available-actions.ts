import type { InvoiceDetail } from "@/types/invoice";

export interface PermissionRow extends Record<string, unknown> { role: string; permission: string }

// UI affordances only. Each command checks the session, revision and permissions again in PostgreSQL.
export function availableActions(
  invoice: Pick<InvoiceDetail, "task" | "humanOutcome" | "classificationComplete" | "continuation">,
  actor: string, memberships: PermissionRow[], sourceAssignee: string | null,
): string[] {
  const permissions = new Set(memberships.map(row => row.permission));
  const roles = new Set(memberships.map(row => row.role));
  const admin = roles.has("admin");
  const {task, humanOutcome} = invoice;
  const candidates: string[] = [];
  if (!task) {
    if (!humanOutcome) candidates.push("task.start");
    if (!invoice.continuation && humanOutcome?.outcome === "ready_for_post_approval_processing"
      && invoice.classificationComplete && (admin || sourceAssignee === actor)) candidates.push("continuation.enqueue");
  } else {
    const available = task.status === "available";
    const claimed = task.status === "claimed";
    if (available && (admin || roles.has(task.queueRole))) candidates.push("task.claim");
    if (admin || task.assigneeUserId === actor) {
      candidates.push("circuit.reject_final");
      if (claimed) candidates.push("task.return");
      if (task.stage === "sector_approval") {
        candidates.push("circuit.cancel_internal");
        if (admin) candidates.push("exception.resolve");
        if (claimed || (admin && available)) candidates.push("supplier.credit_note.request", "supplier.corrected_invoice.request");
      }
      if (claimed && task.stage !== "sector_approval") candidates.push("correction.request");
      if (claimed || (admin && available)) {
        if (task.stage === "accounting_classification") candidates.push("classification.save", "classification.complete");
        else candidates.push("stage.approve");
      }
    }
  }
  return candidates.filter(code => permissions.has(code));
}
