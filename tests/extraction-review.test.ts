import assert from "node:assert/strict";
import { test } from "node:test";
import { handleExtractionDecision } from "../src/lib/tasks/controller";

const valid = { caseId: "wf05-122003", expectedRevision: 1, decision_id: "00000000-0000-4000-8000-000000001223",
  decision: "match", field: "importe_total", approvalTask: 17 };

function request(body: object) {
  return new Request("https://portal.test/api/invoices/122003/extraction-review", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

test("review handler uses the authenticated actor, invoice, case, revision and stable decision UUID", async () => {
  const dependencies = {
    authenticate: async () => ({ id: "1221" }),
    decide: async (actor: string, invoice: number, input: unknown) => {
      assert.equal(actor, "1221"); assert.equal(invoice, 122003); assert.deepEqual(input, valid);
      return { ok: true, status: 200, result: "match" };
    },
  };
  for (let i = 0; i < 2; i++) {
    assert.equal((await handleExtractionDecision(request(valid), "122003", dependencies)).status, 200);
  }
  for (const status of [403, 409]) {
    const denied = await handleExtractionDecision(request(valid), "122003", {
      ...dependencies, decide: async () => ({ ok: false, status, result: "denied" }),
    });
    assert.equal(denied.status, status);
    assert.match(denied.headers.get("cache-control") ?? "", /no-store/);
  }
});

test("incomplete differences and client-supplied actors never reach the mutation", async () => {
  const invalid = [{ ...valid, actor: 99 }, { ...valid, decision: "difference" },
    { ...valid, approvalTask: undefined, decision: "difference", reason: " " },
    { ...valid, approvalTask: undefined, decision: "difference", reason: "Total distinto", field: "" }];
  for (const body of invalid) {
    let calls = 0;
    const response = await handleExtractionDecision(request(body), "122003", {
      authenticate: async () => ({ id: "1221" }),
      decide: async () => { calls++; return { ok: true, status: 200, result: "unexpected" }; },
    });
    assert.equal(response.status, 400); assert.equal(calls, 0);
  }
});

test("referral actions keep their authenticated actor, request identity and PostgreSQL status", async () => {
  for (const decision of ["propose", "confirm", "report_field", "request_copy", "request_supplier", "link_supplier", "regularize"]) {
    const value = ({ propose: "18500", confirm: "18500", regularize: "REG-129", link_supplier: "129099" } as Record<string,string>)[decision];
    const input = { ...valid, decision, reason: "Contraste con el original", value, approvalTask: undefined };
    for (const status of [200, 403, 409]) {
      const response = await handleExtractionDecision(request(input), "122003", {
        authenticate: async () => ({ id: "1222" }),
        async decide(actor, invoice, command) {
          assert.equal(actor, "1222"); assert.equal(invoice, 122003);
          assert.deepEqual(command, JSON.parse(JSON.stringify(input)));
          return { ok: status === 200, status, result: decision };
        },
      });
      assert.equal(response.status, status);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    }
  }
});
