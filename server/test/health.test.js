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
