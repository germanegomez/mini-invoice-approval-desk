import test from "node:test";
import assert from "node:assert/strict";
import { serveOriginal } from "../src/lib/invoices/original";

test("both actions resolve the same stored Drive file and preserve its resource key", async () => {
  const deps = {
    authenticate: async () => ({ id: "7" }),
    async resolveLink(actor: string, id: number) {
      assert.equal(actor, "7");
      assert.equal(id, 41);
      return "https://drive.google.com/file/d/fixture/view?resourcekey=key-A";
    },
  };
  for (const [search, mode] of [["?url=https://example.invalid&file_id=other", "view"], ["?preview=1", "preview"]]) {
    const result = await serveOriginal(new Request("https://portal.invalid/original" + search), "41", deps);
    assert.equal(result.status, 302);
    assert.equal(result.headers.get("location"), `https://drive.google.com/file/d/fixture/${mode}?resourcekey=key-A`);
    assert.match(result.headers.get("cache-control")!, /private, no-store/);
    assert.equal(result.body, null);
  }
});

test("missing, invalid and revoked associations never redirect; anonymous access skips the lookup", async () => {
  const req = new Request("https://portal.invalid/original?preview=1");
  let link: string | null = "https://drive.google.com/file/d/shared/view";
  const deps = { authenticate: async () => ({ id: "7" }), resolveLink: async () => link };
  assert.equal((await serveOriginal(req, "41", deps)).status, 302);
  for (link of [null, "https://drive.google.com.example.invalid/file/d/test/view", "https://drive.google.com/redirect?url=elsewhere"]) {
    const result = await serveOriginal(req, "41", deps);
    assert.equal(result.status, 404);
    assert.equal(result.headers.get("location"), null);
    assert.equal(await result.text(), "Original no disponible");
  }
  const anonymous = await serveOriginal(req, "41", {
    authenticate: async () => { throw Object.assign(new Error(), { status: 401 }); },
    resolveLink: async () => assert.fail("anonymous lookup"),
  });
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.headers.get("location"), null);
});
