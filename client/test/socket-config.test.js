import test from "node:test";
import assert from "node:assert/strict";
import { resolveServerUrl } from "../src/socket-config.js";

test("uses the configured server URL in development and production", () => {
  assert.equal(
    resolveServerUrl({ configuredUrl: " https://api.example.com/// ", isDev: false, origin: "https://game.example" }),
    "https://api.example.com",
  );
});

test("uses localhost in development when no URL is configured", () => {
  assert.equal(resolveServerUrl({ configuredUrl: "", isDev: true, origin: "http://localhost:5173" }), "http://localhost:4000");
});

test("uses the current origin for same-origin production deployments", () => {
  assert.equal(resolveServerUrl({ configuredUrl: undefined, isDev: false, origin: "https://game.example/" }), "https://game.example");
});

test("fails clearly when production has no URL or browser origin", () => {
  assert.throws(
    () => resolveServerUrl({ configuredUrl: undefined, isDev: false, origin: "" }),
    /VITE_SERVER_URL is required/,
  );
});
