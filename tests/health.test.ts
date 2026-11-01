import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/health/route";

test("health endpoint reports only process availability", async () => {
  const response = GET();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ok" });
});
