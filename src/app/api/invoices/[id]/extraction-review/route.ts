import { client } from "@/db";
import { requireAuthenticatedUser } from "@/lib/auth/guard";
import { handleExtractionDecision } from "@/lib/tasks/controller";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleExtractionDecision(request, (await params).id, {
    authenticate: requireAuthenticatedUser,
    async decide(actor, invoice, input) {
      const [row] = await client`SELECT portal.decide_extraction_review(
        ${actor}::bigint, ${invoice}::integer, ${input.caseId}::text, ${input.expectedRevision}::integer,
        ${input.decision_id}::uuid, ${input.decision}::text, ${input.field}::text,
        ${input.reason ?? null}::text, ${input.approvalTask ?? null}::bigint) AS result`;
      return row.result;
    },
  });
}
