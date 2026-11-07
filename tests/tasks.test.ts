import test from "node:test";
import assert from "node:assert/strict";
import {
  classificationSchema,
  replacementSchema,
  startCircuitSchema,
  taskActionSchema,
} from "../src/lib/tasks/contracts";
import {
  getClassificationCatalogs,
  linkReplacement,
  performTaskAction,
  saveTaskClassification,
  startHumanCircuit,
} from "../src/lib/tasks/repository";
import type { QueryExecutor } from "../src/lib/invoices/repository";
import { handleClassification, handleTaskAction, type TaskControllerDependencies } from "../src/lib/tasks/controller";

const key = "00000000-0000-4000-8000-000000000061";

function queued(responses: unknown[][]) {
  const calls: Array<{ text: string; parameters: readonly unknown[] }> = [];
  const query = (async <T extends Record<string, unknown>>(text: string, parameters: readonly unknown[]) => {
    calls.push({ text, parameters });
    return (responses.shift() ?? []) as T[];
  }) as QueryExecutor;
  return { query, calls };
}

test("task contracts accept only named actions, revisions and UUID idempotency keys", () => {
  assert.equal(taskActionSchema.parse({ expectedRevision: 3, action: "claim_task", idempotencyKey: key }).action, "claim_task");
  assert.throws(() => taskActionSchema.parse({ expectedRevision: 3, action: "set_status", idempotencyKey: key }));
  assert.throws(() => taskActionSchema.parse({ expectedRevision: 0, action: "claim_task", idempotencyKey: "retry" }));
  assert.throws(() => taskActionSchema.parse({ expectedRevision: 3, action: "claim_task", idempotencyKey: key, actor: "browser" }));
  assert.equal(startCircuitSchema.parse({ universalRawId: 41, expectedRevision: 3, sectorRole: "purchasing", idempotencyKey: key }).sectorRole, "purchasing");
  assert.throws(() => startCircuitSchema.parse({ universalRawId: 41, expectedRevision: 3, sectorRole: "direction", idempotencyKey: key }));
});

test("classification validates bounded per-item fields and replacement preserves distinct identities", () => {
  assert.equal(classificationSchema.parse({ expectedRevision: 3, idempotencyKey: key, complete: false, items: [{ lineNumber: 1, costCenter: "CC", subCostCenter: null, accountingAccount: null }] }).items.length, 1);
  assert.throws(() => classificationSchema.parse({ expectedRevision: 3, idempotencyKey: key, complete: true, items: [] }));
  assert.throws(() => classificationSchema.parse({ expectedRevision: 3, idempotencyKey: key, complete: false, items: [
    { lineNumber: 1, costCenter: "CC", subCostCenter: null, accountingAccount: null },
    { lineNumber: 1, costCenter: "CC-2", subCostCenter: null, accountingAccount: null },
  ] }));
  assert.equal(replacementSchema.parse({ originalUniversalRawId: 41, replacementUniversalRawId: 42, linkType: "credit_note", sectorRole: "billing", reason: "Documento sintético", idempotencyKey: key }).linkType, "credit_note");
});

test("repository calls only allowlisted portal functions with session actor", async () => {
  const { query, calls } = queued([
    [{ result: { ok: true, status: 200, result: "accepted", taskId: 9 } }],
    [{ result: { ok: true, status: 200, result: "accepted", taskId: 9 } }],
    [{ result: { ok: true, status: 201, result: "created", taskId: 10 } }],
    [{ result: { ok: true, status: 200, result: "linked", taskId: 11 } }],
  ]);
  await performTaskAction(query, "7", 9, { expectedRevision: 3, action: "claim_task", idempotencyKey: key });
  await saveTaskClassification(query, "7", 9, { expectedRevision: 3, idempotencyKey: key, complete: false, items: [{ lineNumber: 1, costCenter: null, subCostCenter: null, accountingAccount: null }] });
  await startHumanCircuit(query, "7", { universalRawId: 41, expectedRevision: 3, sectorRole: "purchasing", idempotencyKey: key });
  await linkReplacement(query, "7", { originalUniversalRawId: 41, replacementUniversalRawId: 42, linkType: "corrected_invoice", sectorRole: "purchasing", reason: "synthetic", idempotencyKey: key });
  assert.match(calls[0].text, /portal\.perform_task_action/);
  assert.match(calls[1].text, /portal\.save_task_classification/);
  assert.match(calls[2].text, /portal\.start_human_circuit/);
  assert.match(calls[3].text, /portal\.link_replacement_and_restart/);
  assert.equal(calls.every((call) => call.parameters[0] === "7"), true);
  assert.equal(calls.some((call) => /n8n|payment|txt|etl/i.test(call.text)), false);
});

test("catalog queries expose only active allowlisted codes", async () => {
  const { query, calls } = queued([
    [{ code: "CC-1", display_name: "Centro" }],
    [{ cost_center_code: "CC-1", code: "SC-1", display_name: "Subcentro" }],
    [{ code: "AC-1", display_name: "Cuenta" }],
  ]);
  const catalogs = await getClassificationCatalogs(query);
  assert.equal(catalogs.costCenters[0].code, "CC-1");
  assert.equal(catalogs.subCostCenters[0].costCenterCode, "CC-1");
  assert.equal(catalogs.accounts[0].code, "AC-1");
  assert.equal(calls.every((call) => /WHERE active/.test(call.text)), true);
});

function dependencies(overrides: Partial<TaskControllerDependencies> = {}): TaskControllerDependencies {
  return {
    authenticate: async () => ({ id: "7" }),
    perform: async () => ({ ok: true, status: 200, result: "accepted", taskId: 9 }),
    classify: async () => ({ ok: true, status: 200, result: "accepted", taskId: 9 }),
    start: async () => ({ ok: true, status: 201, result: "created", taskId: 9 }),
    link: async () => ({ ok: true, status: 200, result: "linked", taskId: 9 }),
    catalogs: async () => ({ costCenters: [], subCostCenters: [], accounts: [] }),
    ...overrides,
  };
}

test("controllers take actor from the session and reject browser actor/state fields", async () => {
  const calls: unknown[][] = [];
  const accepted = await handleTaskAction(new Request("http://portal/api/tasks/9/actions", {
    method: "POST", body: JSON.stringify({ expectedRevision: 3, action: "claim_task", idempotencyKey: key }),
  }), "9", dependencies({ perform: async (...args) => { calls.push(args); return { ok: true, status: 200, result: "accepted" }; } }));
  assert.equal(accepted.status, 200);
  assert.equal(calls[0][0], "7");
  const rejected = await handleTaskAction(new Request("http://portal/api/tasks/9/actions", {
    method: "POST", body: JSON.stringify({ expectedRevision: 3, action: "set_status", idempotencyKey: key, actor: "8" }),
  }), "9", dependencies());
  assert.equal(rejected.status, 400);
});

test("classification controller preserves conflict status without external side effects", async () => {
  const response = await handleClassification(new Request("http://portal/api/tasks/9/classification", {
    method: "PATCH", body: JSON.stringify({ expectedRevision: 3, idempotencyKey: key, complete: true, items: [{ lineNumber: 1, costCenter: "CC", subCostCenter: null, accountingAccount: "AC" }] }),
  }), "9", dependencies({ classify: async () => ({ ok: false, status: 409, result: "classification_incomplete" }) }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).result, "classification_incomplete");
  assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);
});
