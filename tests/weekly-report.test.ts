import assert from "node:assert/strict";
import test from "node:test";
import { lastCompletedMonday, validWeek } from "../src/lib/reports/period";
test("the last completed local week changes at Buenos Aires midnight", () => {
  assert.equal(lastCompletedMonday(new Date("2026-11-23T02:59:59Z")), "2026-11-09");
  assert.equal(lastCompletedMonday(new Date("2026-11-23T03:00:00Z")), "2026-11-16");
  assert.equal(validWeek("2026-11-16", "2026-11-16"), true);
  for (const day of ["2026-11-17","2026-11-23","2025-02-31","0000-01-01",["2026-11-16"]])
    assert.equal(validWeek(day,"2026-11-16"), false);
});
