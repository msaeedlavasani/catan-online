import test, { after } from "node:test";
import assert from "node:assert/strict";

// Start a fresh server on an OS-assigned ephemeral port.  We import
// app/server from index.js; the module-level isMain guard prevents
// auto-listen during test runs.
const { server } = await import("../src/index.js");

await new Promise((resolve, reject) => {
  server.listen(0, () => resolve());
  server.once("error", reject);
});

const baseUrl = `http://localhost:${server.address().port}`;

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// ── Tests ────────────────────────────────────────────────────────────

test("health endpoint returns 200 and ok:true", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test("health response identifies the service", async () => {
  const res = await fetch(`${baseUrl}/health`);
  const body = await res.json();
  assert.equal(body.service, "catan-server");
});

test("health response includes uptime (non-negative number)", async () => {
  const res = await fetch(`${baseUrl}/health`);
  const body = await res.json();
  assert.equal(typeof body.uptime, "number");
  assert.ok(body.uptime >= 0);
});

test("health response includes pid (positive integer)", async () => {
  const res = await fetch(`${baseUrl}/health`);
  const body = await res.json();
  assert.equal(typeof body.pid, "number");
  assert.ok(Number.isInteger(body.pid) && body.pid > 0);
});

test("health Content-Type is application/json", async () => {
  const res = await fetch(`${baseUrl}/health`);
  const ct = res.headers.get("content-type") || "";
  assert.ok(ct.includes("application/json"));
});

// ── Liveness probe (/health/live) ────────────────────────────────────

test("/health/live returns 200", async () => {
  const res = await fetch(`${baseUrl}/health/live`);
  assert.equal(res.status, 200);
});

test("/health/live returns status ok", async () => {
  const res = await fetch(`${baseUrl}/health/live`);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.service, "catan-server");
});

test("/health/live Content-Type is application/json", async () => {
  const res = await fetch(`${baseUrl}/health/live`);
  const ct = res.headers.get("content-type") || "";
  assert.ok(ct.includes("application/json"));
});

// ── Readiness probe (/health/ready) ──────────────────────────────────

test("/health/ready returns 200 when dependencies are healthy", async () => {
  const res = await fetch(`${baseUrl}/health/ready`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.service, "catan-server");
});

test("/health/ready includes checks object with room-store and memory", async () => {
  const res = await fetch(`${baseUrl}/health/ready`);
  const body = await res.json();
  assert.ok(typeof body.checks === "object" && body.checks !== null);
  assert.ok("room-store" in body.checks);
  assert.ok("memory" in body.checks);
});

test("/health/ready room-store check is ok", async () => {
  const res = await fetch(`${baseUrl}/health/ready`);
  const body = await res.json();
  assert.equal(body.checks["room-store"], "ok");
});

test("/health/ready memory check is ok under normal conditions", async () => {
  const res = await fetch(`${baseUrl}/health/ready`);
  const body = await res.json();
  // Heap usage should be well below the 90 % threshold for a fresh test process.
  assert.equal(body.checks.memory, "ok");
});

test("/health/ready includes uptime and pid", async () => {
  const res = await fetch(`${baseUrl}/health/ready`);
  const body = await res.json();
  assert.equal(typeof body.uptime, "number");
  assert.ok(body.uptime >= 0);
  assert.equal(typeof body.pid, "number");
  assert.ok(Number.isInteger(body.pid) && body.pid > 0);
});

test("/health/ready Content-Type is application/json", async () => {
  const res = await fetch(`${baseUrl}/health/ready`);
  const ct = res.headers.get("content-type") || "";
  assert.ok(ct.includes("application/json"));
});

// ── Backward-compatibility ───────────────────────────────────────────

test("/health is backward-compatible and still returns 200 with ok:true", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, "catan-server");
  assert.equal(typeof body.uptime, "number");
  assert.equal(typeof body.pid, "number");
});
