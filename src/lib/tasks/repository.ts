import type { QueryExecutor } from "@/lib/invoices/repository";
import type {
  ClassificationInput,
  ContinuationInput,
  ReplacementInput,
  StartCircuitInput,
  TaskActionInput,
} from "./contracts";

export interface TaskOperationResult {
  ok: boolean;
  status: number;
  result: string;
  taskId?: number;
  nextTaskId?: number | null;
  operationId?: string;
  operationStatus?: string;
}

interface ResultRow extends Record<string, unknown> {
  result: TaskOperationResult | string;
}

function normalize(row: ResultRow | undefined): TaskOperationResult {
  if (!row) return { ok: false, status: 503, result: "unavailable" };
  const value = typeof row.result === "string" ? JSON.parse(row.result) : row.result;
  return {
    ...value,
    taskId: value.taskId === undefined ? undefined : Number(value.taskId),
    nextTaskId: value.nextTaskId === undefined || value.nextTaskId === null
      ? value.nextTaskId
      : Number(value.nextTaskId),
  };
}

export async function performTaskAction(
  query: QueryExecutor,
  actorUserId: string,
  taskId: number,
  input: TaskActionInput,
): Promise<TaskOperationResult> {
  const rows = await query<ResultRow>(`
    SELECT portal.perform_task_action(
      $1::bigint, $2::bigint, $3::integer, $4::text, $5::text,
      $6::text, $7::bigint, $8::text
    ) AS result
  `, [actorUserId, taskId, input.expectedRevision, input.action,
    input.idempotencyKey, input.reason ?? null, input.targetUserId ?? null,
    input.resolutionCode ?? null]);
  return normalize(rows[0]);
}

export async function saveTaskClassification(
  query: QueryExecutor,
  actorUserId: string,
  taskId: number,
  input: ClassificationInput,
): Promise<TaskOperationResult> {
  const rows = await query<ResultRow>(`
    SELECT portal.save_task_classification(
      $1::bigint, $2::bigint, $3::integer, $4::jsonb, $5::boolean, $6::text
    ) AS result
  `, [actorUserId, taskId, input.expectedRevision, JSON.stringify(input.items),
    input.complete, input.idempotencyKey]);
  return normalize(rows[0]);
}

export async function startHumanCircuit(
  query: QueryExecutor,
  actorUserId: string,
  input: StartCircuitInput,
): Promise<TaskOperationResult> {
  const rows = await query<ResultRow>(`
    SELECT portal.start_human_circuit(
      $1::bigint, $2::integer, $3::integer, $4::text, $5::text, $5::text
    ) AS result
  `, [actorUserId, input.universalRawId, input.expectedRevision,
    input.sectorRole, input.idempotencyKey]);
  return normalize(rows[0]);
}

export async function linkReplacement(
  query: QueryExecutor,
  actorUserId: string,
  input: ReplacementInput,
): Promise<TaskOperationResult> {
  const rows = await query<ResultRow>(`
    SELECT portal.link_replacement_and_restart(
      $1::bigint, $2::integer, $3::integer, $4::text,
      $5::text, $6::text, $7::text
    ) AS result
  `, [actorUserId, input.originalUniversalRawId, input.replacementUniversalRawId,
    input.linkType, input.sectorRole, input.reason, input.idempotencyKey]);
  return normalize(rows[0]);
}

export async function enqueueContinuation(
  query: QueryExecutor,
  actorUserId: string,
  input: ContinuationInput,
): Promise<TaskOperationResult> {
  const rows = await query<ResultRow>(`
    SELECT portal.enqueue_wf05_continuation(
      $1::bigint, $2::bigint, $3::integer, $4::uuid, $5::integer
    ) AS result
  `, [actorUserId, input.humanOutcomeId, input.expectedRevision,
    input.idempotencyKey, input.contractVersion]);
  return normalize(rows[0]);
}

export interface ClassificationCatalogs {
  costCenters: Array<{ code: string; displayName: string }>;
  subCostCenters: Array<{ costCenterCode: string; code: string; displayName: string }>;
  accounts: Array<{ code: string; displayName: string }>;
}

export async function getClassificationCatalogs(query: QueryExecutor): Promise<ClassificationCatalogs> {
  const [costCenters, subCostCenters, accounts] = await Promise.all([
    query<{ code: string; display_name: string }>(`
      SELECT code, display_name FROM portal.classification_cost_centers
       WHERE active ORDER BY code
    `, []),
    query<{ cost_center_code: string; code: string; display_name: string }>(`
      SELECT cost_center_code, code, display_name
        FROM portal.classification_subcost_centers WHERE active
       ORDER BY cost_center_code, code
    `, []),
    query<{ code: string; display_name: string }>(`
      SELECT code, display_name FROM portal.classification_accounts
       WHERE active ORDER BY code
    `, []),
  ]);
  return {
    costCenters: costCenters.map((row) => ({ code: row.code, displayName: row.display_name })),
    subCostCenters: subCostCenters.map((row) => ({
      costCenterCode: row.cost_center_code, code: row.code, displayName: row.display_name,
    })),
    accounts: accounts.map((row) => ({ code: row.code, displayName: row.display_name })),
  };
}
