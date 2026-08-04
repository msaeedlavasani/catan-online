// Contract test — verifies the shared game constants module is
// importable and has the expected shape. Run independently with
// `node --test shared/game-constants.test.mjs`.
// Also ensures both client and server see the same frozen values.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RESOURCE_TYPES, BUILD_COST } from "./game-constants.mjs";

describe("shared/game-constants (contract)", () => {
  describe("RESOURCE_TYPES", () => {
    it("is the canonical five resources", () => {
      assert.deepEqual(RESOURCE_TYPES, ["wood", "brick", "wheat", "sheep", "ore"]);
      assert.equal(RESOURCE_TYPES.length, 5);
    });

    it("is frozen (immutable)", () => {
      assert.throws(() => { RESOURCE_TYPES[0] = "gold"; }, TypeError);
      assert.throws(() => { RESOURCE_TYPES.push("gold"); }, TypeError);
    });

    it("contains only known Catan resources", () => {
      const valid = new Set(["wood", "brick", "wheat", "sheep", "ore"]);
      RESOURCE_TYPES.forEach((r) => assert.ok(valid.has(r), `unexpected resource: ${r}`));
    });
  });

  describe("BUILD_COST", () => {
    it("road costs 1 brick + 1 wood", () => {
      assert.deepEqual(BUILD_COST.road, { brick: 1, wood: 1 });
    });

    it("settlement costs 1 brick + 1 wood + 1 wheat + 1 sheep", () => {
      assert.deepEqual(BUILD_COST.settlement, { brick: 1, wood: 1, wheat: 1, sheep: 1 });
    });

    it("city costs 2 wheat + 3 ore", () => {
      assert.deepEqual(BUILD_COST.city, { wheat: 2, ore: 3 });
    });

    it("devCard costs 1 wheat + 1 sheep + 1 ore", () => {
      assert.deepEqual(BUILD_COST.devCard, { wheat: 1, sheep: 1, ore: 1 });
    });

    it("all cost keys reference only resources in RESOURCE_TYPES", () => {
      const valid = new Set(RESOURCE_TYPES);
      for (const [item, cost] of Object.entries(BUILD_COST)) {
        for (const r of Object.keys(cost)) {
          assert.ok(valid.has(r), `BUILD_COST.${item} references unknown resource "${r}"`);
        }
      }
    });

    it("is frozen (immutable)", () => {
      assert.throws(() => { BUILD_COST.road.wood = 99; }, TypeError);
      assert.throws(() => { BUILD_COST.foo = {}; }, TypeError);
    });
  });
});
