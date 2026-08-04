import test from "node:test";
import assert from "node:assert/strict";
import { createCorsOptions, getAllowedOrigins, isOriginAllowed } from "../src/cors.js";

test("uses localhost as the default development origin", () => {
  assert.deepEqual(getAllowedOrigins(undefined), ["http://localhost:5173"]);
});

test("parses a comma-separated origin allowlist", () => {
  assert.deepEqual(getAllowedOrigins("https://game.example, https://admin.example"), [
    "https://game.example",
    "https://admin.example",
  ]);
});

test("allows configured origins and rejects unknown origins", () => {
  const allowed = ["https://game.example"];
  assert.equal(isOriginAllowed("https://game.example", allowed), true);
  assert.equal(isOriginAllowed("https://evil.example", allowed), false);
  assert.equal(isOriginAllowed(undefined, allowed), true);
});

test("returns a CORS error for an unknown origin", () => {
  const options = createCorsOptions(["https://game.example"]);
  let receivedError;

  options.origin("https://evil.example", (error) => {
    receivedError = error;
  });

  assert.equal(receivedError?.message, "Origin not allowed by CORS");
});
