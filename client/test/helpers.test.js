import test from "node:test";
import assert from "node:assert/strict";
import { emptyResources, totalResources, shade } from "../src/game/helpers.js";

test("creates an empty resource hand", () => {
  assert.deepEqual(emptyResources(), { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 });
});

test("counts resources across all resource types", () => {
  assert.equal(totalResources({ wood: 2, brick: 1, wheat: 0, sheep: 3, ore: 4 }), 10);
});

test("shades a hex color", () => {
  assert.equal(shade("#000000", 1), "#ffffff");
  assert.equal(shade("#ffffff", -1), "#000000");
});
