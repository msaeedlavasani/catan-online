import test from "node:test";
import assert from "node:assert/strict";
import { getPort } from "../src/config.js";

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
