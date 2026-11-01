import test from "node:test";
import assert from "node:assert/strict";
import { calculateStats } from "../src/lib/stats";
import { formatCurrency } from "../src/lib/utils";

test("invoice amounts use the invoice currency", () => {
  assert.equal(formatCurrency("120.50", "EUR"), "€120.50");
});

test("single-currency statistics add decimal amounts without floating-point drift", () => {
  const stats = calculateStats([
    { status: "PROCESSING", totalAmount: "0.10", currency: "EUR" },
    { status: "PROCESSING", totalAmount: "0.20", currency: "EUR" },
  ]);
  assert.equal(stats.totalAmount, 0.3);
  assert.equal(stats.processingCount, 2);
  assert.equal(stats.currency, "EUR");
});

test("mixed currencies retain counts and omit misleading monetary totals", () => {
  const stats = calculateStats([
    { status: "APPROVED", totalAmount: "100", currency: "USD" },
    { status: "REJECTED", totalAmount: "200", currency: "EUR" },
  ]);
  assert.equal(stats.totalCount, 2);
  assert.equal(stats.approvedCount, 1);
  assert.equal(stats.currency, null);
  assert.equal(stats.totalAmount, null);
  assert.equal(stats.approvedAmount, null);
});
