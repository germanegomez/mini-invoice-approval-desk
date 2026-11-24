import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { availableActions } from "../src/lib/tasks/available-actions";
import { displayCategory, tabCategories } from "../src/lib/invoices/presentation";
import { KPIBar } from "../src/components/KPIBar";
import { formatCurrency, formatDate, formatDateTime } from "../src/lib/utils";
import type { HumanTask, CurrencyTotal, HumanOutcome } from "../src/types/invoice";

test("the decision table partitions all signal combinations and the three tabs exactly once", () => {
  for (const rejected of [true, false]) for (const needsReview of [true, false]) for (const approved of [true, false]) {
    const category = displayCategory({rejected, needsReview, approved});
    assert.equal(category, rejected ? "REJECTED" : needsReview ? "NEEDS_REVIEW" : approved ? "APPROVED" : "PROCESSING");
    assert.equal(Object.values(tabCategories).filter(values => values.includes(category)).length, 1);
  }
});

test("currency cards distinguish missing, zero, invalid and multiple amounts", () => {
  const money = (currency: string | null, amount: string | null): CurrencyTotal => ({
    currency, amount, includedCount: amount === null ? 0 : 1, excludedCount: amount === null ? 1 : 0,
  });
  const card = (totals: CurrencyTotal[]) => renderToStaticMarkup(createElement(KPIBar, {
    stats: [{code: "APPROVED", count: 12, currencyTotals:totals}],
  }));
  assert.match(card([money("ARS", "5054.59")]), /\$5\.054,59/);
  const mixed = card([money("USD", "120.50"), money("ARS", "11.22")]);
  assert.match(mixed, /\$11,22<\/div><div>USD\s120,50/);
  assert.equal(mixed.match(/12 invs/g)?.length, 1);
  assert.doesNotMatch(mixed, /131,72|Multiple currencies|ARS/);
  assert.match(card([money("USD", null)]), /USD —/);
  assert.match(card([money(null,null)]), /—/);
  assert.equal(formatCurrency("5oops","USD"), "—");
  assert.equal(formatCurrency("0.00", "USD"), "USD\u00a00,00");
  assert.equal(formatCurrency("6528.94", "USD"), "USD\u00a06.528,94");
  assert.equal(formatCurrency("-1200.45", "ARS"), "-$1.200,45");
  assert.equal(formatCurrency("9007199254740993.17", "ARS"), "$9.007.199.254.740.993,17");
  assert.equal(formatCurrency("25.00", null), "—");
});

test("continuation display requires the current classified outcome and the authorized actor", () => {
  const invoice = {task:null, humanOutcome: {outcome:"ready_for_post_approval_processing"} as HumanOutcome, classificationComplete:true, continuation:null};
  const accounting = [{role:"accounting",permission:"continuation.enqueue"}];
  assert.deepEqual(availableActions(invoice, "7", accounting, "7"), ["continuation.enqueue"]);
  assert.deepEqual(availableActions(invoice, "8", accounting, "7"), []);
  assert.deepEqual(availableActions({...invoice,classificationComplete:false}, "7", accounting, "7"), []);
  assert.deepEqual(availableActions({...invoice,humanOutcome:{...invoice.humanOutcome,outcome:"exception_closed"}}, "7", accounting, "7"), []);
});

test("only queue owners claim available work and only assignees or admins see stage commands", () => {
  const task: HumanTask = {id:1,stage:"direction_approval",status:"available",queueRole:"direction",assigneeUserId:null,outcome:null,updatedAt:"2026-11-01"};
  const invoice = {task,humanOutcome:null,classificationComplete:false,continuation:null};
  const grants = [{role:"direction",permission:"task.claim"},{role:"direction",permission:"stage.approve"}];
  assert.deepEqual(availableActions(invoice,"7",grants,null),["task.claim"]);
  assert.deepEqual(availableActions(invoice,"7",[{role:"accounting",permission:"task.claim"}],null),[]);
  const claimed = {...invoice,task:{...task,status:"claimed" as const,assigneeUserId:"7"}};
  assert.deepEqual(availableActions(claimed,"7",grants,null),["stage.approve"]);
  assert.deepEqual(availableActions(claimed,"8",grants,null),[]);
});

test("calendar dates keep their printed precision and instants use Buenos Aires time", () => {
  assert.equal(formatDate("2020-02-29"), "29/02/2020");
  assert.equal(formatDate("2020-02"), "02/2020");
  assert.equal(formatDate(null), "-");
  assert.match(formatDateTime("2020-03-01T01:20:00Z"), /29\/02\/2020.*22:20/);
});
