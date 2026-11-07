import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const image = process.argv.slice(2).find((argument) => argument !== "--")
  ?? "mini-invoice-approval-desk:ticket-55";
const name = `invoice-desk-${randomUUID().slice(0, 8)}`;

function docker(args, { allowFailure = false } = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8" });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`docker ${args.join(" ")} failed\n${result.stdout}${result.stderr}`);
  }
  return result;
}

function inspect(format) {
  return docker(["inspect", "--format", format, name]).stdout.trim();
}

async function waitFor(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return response;
    } catch {
      // Startup can legitimately refuse connections until Next.js is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Container did not serve ${url} within ${timeoutMs}ms`);
}

try {
  const imageMetadata = JSON.parse(docker(["image", "inspect", image]).stdout)[0];
  assert.equal(imageMetadata.Os, "linux");
  assert.equal(imageMetadata.Architecture, "amd64");
  assert.equal(imageMetadata.Config.User, "node");
  assert.ok(imageMetadata.Config.Healthcheck?.Test?.join(" ").includes("/api/health"));

  docker([
    "run",
    "--detach",
    "--name", name,
    "--publish", "127.0.0.1::3000",
    "--env", "NEXTAUTH_URL=http://127.0.0.1:3000",
    "--env", "NEXTAUTH_SECRET=synthetic-container-secret-that-is-long-enough",
    "--env", "GOOGLE_CLIENT_ID=synthetic.apps.googleusercontent.com",
    "--env", "GOOGLE_CLIENT_SECRET=synthetic-google-secret",
    "--env", "GOOGLE_WORKSPACE_DOMAIN=clinicacruzceleste.com",
    image,
  ]);

  const portOutput = docker(["port", name, "3000/tcp"]).stdout.trim();
  const port = Number(portOutput.match(/:(\d+)$/)?.[1]);
  assert.ok(Number.isInteger(port) && port > 0, `Unexpected port mapping: ${portOutput}`);

  const health = await waitFor(`http://127.0.0.1:${port}/api/health`);
  assert.deepEqual(await health.json(), { status: "ok" });

  const home = await fetch(`http://127.0.0.1:${port}/`, {
    redirect: "manual",
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(home.status, 307);
  assert.equal(home.headers.get("location"), "/login");

  const login = await fetch(`http://127.0.0.1:${port}/login`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(login.status, 200);
  assert.match(await login.text(), /Sign in with Google/);

  const invoices = await fetch(`http://127.0.0.1:${port}/api/invoices`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(invoices.status, 401);
  assert.match(invoices.headers.get("cache-control") ?? "", /private/);
  assert.match(invoices.headers.get("cache-control") ?? "", /no-store/);

  const mutation = await fetch(`http://127.0.0.1:${port}/api/invoices/41/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "attempted-client-mutation" }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(mutation.status, 401);

  const runtime = docker([
    "exec",
    name,
    "node",
    "-e",
    "const fs=require('node:fs'); const forbidden=['/app/.git','/app/.env','/app/.env.local','/app/tests','/app/src','/app/node_modules/eslint','/app/node_modules/typescript','/pnpm']; if(process.getuid()===0||forbidden.some(fs.existsSync)) process.exit(1); console.log(process.getuid());",
  ]).stdout.trim();
  assert.equal(runtime, "1000");

  const startedAt = Date.now();
  docker(["stop", "--time", "10", name]);
  const elapsedMs = Date.now() - startedAt;
  assert.ok(elapsedMs < 10_000, `Graceful stop exceeded the configured timeout: ${elapsedMs}ms`);
  const exitCode = inspect("{{.State.ExitCode}}");
  assert.ok(exitCode === "0" || exitCode === "143", `Unexpected stop exit code: ${exitCode}`);
  assert.equal(inspect("{{.State.OOMKilled}}"), "false");

  console.log(`Container verification passed for ${image}: linux/amd64, non-root, public health/login, protected app/API, exclusions, and SIGTERM stop (${elapsedMs}ms, exit ${exitCode}).`);
} finally {
  docker(["rm", "--force", name], { allowFailure: true });
}
