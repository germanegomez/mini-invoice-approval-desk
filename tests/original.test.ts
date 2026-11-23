import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { serveOriginal } from "../src/lib/invoices/original";
import samples from "./original-fixtures.mjs";
import { readDriveMedia } from "../src/lib/invoices/drive-media";

test("Drive reader uses the technical grant, checks private file metadata, then streams the exact bytes", async () => {
  const signal = new AbortController().signal;
  for (const [type, sample] of [["application/pdf", samples.pdf], ["image/png", samples.png]] as const) {
    const calls: string[] = [];
    let trashed = false;
    const transport: typeof fetch = async (input, options) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://www.googleapis.com");
      assert.equal(url.pathname, "/drive/v3/files/fixture");
      assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer fixture-technical-grant");
      if (url.searchParams.get("alt") === "media") {
        calls.push("bytes");
        return new Response(new Uint8Array(sample), { headers: { "Content-Type": type } });
      }
      calls.push("metadata");
      return Response.json({ trashed, mimeType: type, capabilities: { canDownload: true } });
    };
    const read = (head: boolean) => readDriveMedia("fixture", head, signal, "fixture-technical-grant", transport);
    assert.equal((await read(true))?.headers.get("Content-Type"), type);
    const response = await read(false);
    assert.ok(response);
    assert.equal(digest(new Uint8Array(await response.arrayBuffer())), digest(sample));
    trashed = true;
    assert.equal(await read(false), null);
    assert.deepEqual(calls, ["metadata", "metadata", "bytes", "metadata"]);
  }
});

const digest = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
test("original checks the current actor and invoice on GET and HEAD, even for copied URLs", async () => {
  const url = "https://portal.invalid/api/invoices/41/original?file_id=other&url=ignored";
  let signedIn = true, permitted = true, reads = 0;
  const deps = {
    async authenticate() {
      if (!signedIn) throw Object.assign(new Error(), { status: 401 });
      return { id: "buyer" };
    },
    async resolveFile(actor: string, invoice: number) {
      assert.equal(actor, "buyer");
      return permitted && invoice === 41 ? "associated" : null;
    },
    async readFile(id: string, head: boolean) {
      assert.equal(id, "associated");
      reads++;
      return new Response(head ? null : new Uint8Array(samples.pdf), { headers: { "Content-Type": "application/pdf" } });
    },
  };
  const get = (id = "41", method = "GET") => serveOriginal(new Request(url, { method }), id, deps);
  const response = await get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.match(response.headers.get("cache-control")!, /private, no-store/);
  assert.equal(digest(new Uint8Array(await response.arrayBuffer())), digest(samples.pdf));
  assert.equal((await get("41", "HEAD")).body, null);
  const outside = await get("42");
  permitted = false;
  const revoked = await get();
  assert.equal(revoked.status, 404);
  assert.equal(outside.status, revoked.status);
  assert.equal(await outside.text(), await revoked.text());
  signedIn = false;
  assert.equal((await get()).status, 401);
  assert.equal((await get("41", "HEAD")).status, 401);
  assert.equal(reads, 2);
});

test("image bytes match and unavailable or unsupported originals deliver no file", async () => {
  const request = new Request("https://portal.invalid/api/invoices/41/original");
  const get = (file: Response | null) => serveOriginal(request, "41", {
    authenticate: async () => ({ id: "7" }), resolveFile: async () => "associated",
    readFile: async () => file,
  });
  const image = await get(new Response(new Uint8Array(samples.png), { headers: { "Content-Type": "image/png" } }));
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal(digest(new Uint8Array(await image.arrayBuffer())), digest(samples.png));
  assert.equal((await get(null)).status, 404);
  assert.equal((await get(new Response("<html>", { headers: { "Content-Type": "text/html" } }))).status, 404);
});
