import assert from "node:assert/strict";
import test from "node:test";
import { formatDuration } from "../src/lib/reports/duration";

test("weekly durations and median changes round once at minute precision", () => {
  for (const [hours, expected] of [
    [9.590615, "9 h 35 min"], [48, "48 h"], [0.999, "1 h"], [0, "0 min"],
    [-0.001, "0 min"], [-0.5, "−30 min"], [-1.25, "−1 h 15 min"],
  ] as const) assert.equal(formatDuration(hours), expected);
});
