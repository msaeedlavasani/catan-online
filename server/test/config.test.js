import test from "node:test";
import assert from "node:assert/strict";
import { getPort, getRoomTTL } from "../src/config.js";

// ─── Default / fallback ──────────────────────────────────────────────

test("getPort returns 4000 when no PORT is set", () => {
  assert.equal(getPort(undefined), 4000);
});

test("getPort returns 4000 when PORT is null", () => {
  assert.equal(getPort(null), 4000);
});

test("getPort returns 4000 when PORT is empty string", () => {
  assert.equal(getPort(""), 4000);
});

test("getPort returns 4000 when PORT is whitespace only", () => {
  assert.equal(getPort("   "), 4000);
});

// ─── Valid numeric ports ─────────────────────────────────────────────

test("getPort parses a valid numeric string", () => {
  assert.equal(getPort("3000"), 3000);
});

test("getPort parses 80 (privileged port)", () => {
  assert.equal(getPort("80"), 80);
});

test("getPort parses 443", () => {
  assert.equal(getPort("443"), 443);
});

test("getPort parses 8080", () => {
  assert.equal(getPort("8080"), 8080);
});

test("getPort parses port 1 (lowest valid)", () => {
  assert.equal(getPort("1"), 1);
});

test("getPort parses port 65535 (highest valid)", () => {
  assert.equal(getPort("65535"), 65535);
});

// ─── Invalid values — fall back to 4000 ──────────────────────────────

test("getPort falls back on non-numeric string", () => {
  assert.equal(getPort("abc"), 4000);
});

test("getPort falls back on float (not integer)", () => {
  assert.equal(getPort("3000.5"), 4000);
});

test("getPort falls back on zero", () => {
  assert.equal(getPort("0"), 4000);
});

test("getPort falls back on negative port", () => {
  assert.equal(getPort("-1"), 4000);
});

test("getPort falls back on port > 65535", () => {
  assert.equal(getPort("65536"), 4000);
});

test("getPort falls back on very large number", () => {
  assert.equal(getPort("99999"), 4000);
});

test("getPort returns a number, not a string", () => {
  const port = getPort("8080");
  assert.equal(typeof port, "number");
  assert.equal(port, 8080);
});

// ═══════════════════════════════════════════════════════════════════════════
// getRoomTTL
// ═══════════════════════════════════════════════════════════════════════════

// ─── Default / fallback ─────────────────────────────────────────────

test("getRoomTTL returns 300000 (5 min) when ROOM_TTL_MS is unset", () => {
  assert.equal(getRoomTTL(undefined), 300_000);
});

test("getRoomTTL returns 300000 when ROOM_TTL_MS is null", () => {
  assert.equal(getRoomTTL(null), 300_000);
});

test("getRoomTTL returns 300000 when ROOM_TTL_MS is empty string", () => {
  assert.equal(getRoomTTL(""), 300_000);
});

test("getRoomTTL returns 300000 when ROOM_TTL_MS is whitespace only", () => {
  assert.equal(getRoomTTL("   "), 300_000);
});

// ─── Valid values ───────────────────────────────────────────────────

test("getRoomTTL parses a valid numeric string (10 seconds)", () => {
  assert.equal(getRoomTTL("10000"), 10_000);
});

test("getRoomTTL parses 1 hour", () => {
  assert.equal(getRoomTTL("3600000"), 3_600_000);
});

test("getRoomTTL parses the minimum allowed (1000 ms)", () => {
  assert.equal(getRoomTTL("1000"), 1_000);
});

test("getRoomTTL parses exactly the default", () => {
  assert.equal(getRoomTTL("300000"), 300_000);
});

// ─── Invalid values — fall back to 300000 ───────────────────────────

test("getRoomTTL falls back on non-numeric string", () => {
  assert.equal(getRoomTTL("abc"), 300_000);
});

test("getRoomTTL falls back on float (not integer)", () => {
  assert.equal(getRoomTTL("5000.5"), 300_000);
});

test("getRoomTTL falls back on zero", () => {
  assert.equal(getRoomTTL("0"), 300_000);
});

test("getRoomTTL falls back on negative value", () => {
  assert.equal(getRoomTTL("-5000"), 300_000);
});

test("getRoomTTL falls back on value < 1000 (500 ms)", () => {
  assert.equal(getRoomTTL("500"), 300_000);
});

test("getRoomTTL returns a number, not a string", () => {
  const ttl = getRoomTTL("60000");
  assert.equal(typeof ttl, "number");
  assert.equal(ttl, 60_000);
});
