import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { cpSync, existsSync } from "node:fs";
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
const standaloneDirectory = resolve(".next/standalone");
if (existsSync(resolve("public"))) {
  cpSync(resolve("public"), resolve(standaloneDirectory, "public"), { recursive: true });
}
cpSync(resolve(".next/static"), resolve(standaloneDirectory, ".next/static"), { recursive: true });
const child = spawn(
  process.execPath,
  [resolve(standaloneDirectory, "server.js")],
  {
    cwd: standaloneDirectory,
    env: {
      ...process.env,
      HOSTNAME: host,
      PORT: String(port),
      DATABASE_URL: "postgres://smoke:smoke@127.0.0.1:1/smoke",
      NEXTAUTH_URL: origin,
      NEXTAUTH_SECRET: "synthetic-smoke-secret-that-is-long-enough",
      GOOGLE_CLIENT_ID: "synthetic.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "synthetic-google-secret",
      GOOGLE_WORKSPACE_DOMAIN: "clinicacruzceleste.com",
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
  await waitForServer(`${origin}/api/health`, child, sanitizedLog);
  const home = await fetch(`${origin}/`, { redirect: "manual", signal: AbortSignal.timeout(5_000) });
  assert(home.status === 307, `Protected home route returned ${home.status}`);
  assert(home.headers.get("location") === "/login", "Protected home route did not redirect to login");

  const login = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(5_000) });
  assert(login.status === 200, `Login route returned ${login.status}`);
  assert((await login.text()).includes("Sign in with Google"), "Login page lost its Google action");

  const icon = await fetch(`${origin}/icon.svg`, { signal: AbortSignal.timeout(5_000) });
  assert(icon.status === 200, `Icon route returned ${icon.status}`);
  assert(icon.headers.get("content-type")?.includes("image/svg+xml"), "Icon route lost its SVG content type");

  const invoices = await fetch(`${origin}/api/invoices`, { signal: AbortSignal.timeout(5_000) });
  const invoicesBody = await invoices.json();
  assert(invoices.status === 401, `Anonymous invoice API returned ${invoices.status}`);
  assert(invoicesBody.success === false && typeof invoicesBody.error === "string", "Invoice API lost its controlled error contract");

  const stats = await fetch(`${origin}/api/stats`, { signal: AbortSignal.timeout(5_000) });
  const statsBody = await stats.json();
  assert(stats.status === 401, `Anonymous stats API returned ${stats.status}`);
  assert(statsBody.success === false && typeof statsBody.error === "string", "Stats API lost its controlled error contract");

  const mutation = await fetch(`${origin}/api/invoices/00000000-0000-0000-0000-000000000000/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "APPROVED", actor: "browser-controlled" }),
    signal: AbortSignal.timeout(5_000),
  });
  assert(mutation.status === 401, `Anonymous mutation route returned ${mutation.status}`);

  for (const response of [invoices, stats, mutation]) {
    assert(response.headers.get("cache-control")?.includes("private"), "Protected API cache is not private");
    assert(response.headers.get("cache-control")?.includes("no-store"), "Protected API cache is not no-store");
  }

  console.log("Smoke passed: public health/login, protected page/API, private caches, and disabled mutation boundary.");
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => child.once("exit", resolveExit)),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
}
