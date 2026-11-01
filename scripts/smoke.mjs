import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";

const host = "127.0.0.1";
const startupTimeoutMs = 30_000;

async function reservePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to reserve a loopback port"));
        return;
      }
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

async function waitForServer(url, child, log) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited before startup (code ${child.exitCode})\n${log()}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.status === 200) return response;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`Next.js did not start within ${startupTimeoutMs}ms\n${log()}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const port = await reservePort();
const origin = `http://${host}:${port}`;
const output = [];
const child = spawn(
  process.execPath,
  [resolve("node_modules/next/dist/bin/next"), "start", "--hostname", host, "--port", String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: "postgres://smoke:smoke@127.0.0.1:1/smoke",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

child.stdout.on("data", (chunk) => output.push(chunk.toString()));
child.stderr.on("data", (chunk) => output.push(chunk.toString()));
const sanitizedLog = () => output.join("").slice(-4_000);

try {
  const home = await waitForServer(`${origin}/`, child, sanitizedLog);
  const homeText = await home.text();
  assert(homeText.includes("Mini Invoice Approval Desk"), "Home page lost its title");

  const icon = await fetch(`${origin}/icon.svg`, { signal: AbortSignal.timeout(5_000) });
  assert(icon.status === 200, `Icon route returned ${icon.status}`);
  assert(icon.headers.get("content-type")?.includes("image/svg+xml"), "Icon route lost its SVG content type");

  const invoices = await fetch(`${origin}/api/invoices`, { signal: AbortSignal.timeout(5_000) });
  const invoicesBody = await invoices.json();
  assert(invoices.status === 500, `Database-free invoice API returned ${invoices.status}`);
  assert(invoicesBody.success === false && Array.isArray(invoicesBody.data), "Invoice API lost its controlled error contract");

  const stats = await fetch(`${origin}/api/stats`, { signal: AbortSignal.timeout(5_000) });
  const statsBody = await stats.json();
  assert(stats.status === 500, `Database-free stats API returned ${stats.status}`);
  assert(statsBody.success === false && typeof statsBody.error === "string", "Stats API lost its controlled error contract");

  console.log("Smoke passed: home, icon, invoice API, and stats API routes are reachable without real data or credentials.");
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => child.once("exit", resolveExit)),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
}
