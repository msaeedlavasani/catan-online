// Contract test — verifies the shared game constants module is
// importable and has the expected shape. Run independently with
// `node --test shared/game-constants.test.mjs`.
// Also ensures both client and server see the same frozen values.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RESOURCE_TYPES,
  BUILD_COST,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  COLOR_ASSET_NAME,
} from "./game-constants.mjs";

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

  // ── Player capacity and color/asset mapping (Batch 3.3) ──────────

  describe("MAX_PLAYERS / MIN_PLAYERS", () => {
    it("MAX_PLAYERS is 4 (matching available piece art)", () => {
      assert.equal(MAX_PLAYERS, 4);
    });

    it("MIN_PLAYERS is 2", () => {
      assert.equal(MIN_PLAYERS, 2);
    });

    it("MIN_PLAYERS is less than MAX_PLAYERS", () => {
      assert.ok(MIN_PLAYERS < MAX_PLAYERS);
    });

    it("both are positive integers", () => {
      assert.ok(Number.isInteger(MAX_PLAYERS) && MAX_PLAYERS > 0);
      assert.ok(Number.isInteger(MIN_PLAYERS) && MIN_PLAYERS > 0);
    });
  });

  describe("PLAYER_COLORS", () => {
    it("has exactly MAX_PLAYERS entries", () => {
      assert.equal(PLAYER_COLORS.length, MAX_PLAYERS);
    });

    it("contains the four canonical Catan player colors", () => {
      assert.deepEqual(PLAYER_COLORS, ["#b23a2e", "#2b6ca3", "#e0952b", "#3f7d4a"]);
    });

    it("is frozen (immutable)", () => {
      assert.throws(() => { PLAYER_COLORS[0] = "#000000"; }, TypeError);
      assert.throws(() => { PLAYER_COLORS.push("#000000"); }, TypeError);
    });

    it("every entry is a valid 7-character hex color", () => {
      const HEX_RE = /^#[0-9a-fA-F]{6}$/;
      PLAYER_COLORS.forEach((c) => assert.match(c, HEX_RE, `not a hex color: ${c}`));
    });

    it("all colors are unique", () => {
      assert.equal(new Set(PLAYER_COLORS).size, PLAYER_COLORS.length);
    });
  });

  describe("COLOR_ASSET_NAME", () => {
    it("maps every PLAYER_COLORS entry to a name", () => {
      PLAYER_COLORS.forEach((c) => {
        assert.ok(c in COLOR_ASSET_NAME, `no asset name for color ${c}`);
        assert.equal(typeof COLOR_ASSET_NAME[c], "string");
      });
    });

    it("does not map colors outside PLAYER_COLORS", () => {
      const colorSet = new Set(PLAYER_COLORS);
      for (const key of Object.keys(COLOR_ASSET_NAME)) {
        assert.ok(colorSet.has(key), `COLOR_ASSET_NAME maps unknown color: ${key}`);
      }
    });

    it("is frozen (immutable)", () => {
      assert.throws(() => { COLOR_ASSET_NAME["#b23a2e"] = "pink"; }, TypeError);
      assert.throws(() => { COLOR_ASSET_NAME["#ffffff"] = "white"; }, TypeError);
    });

    it("asset names match the piece-art directories", () => {
      const validNames = new Set(["red", "blue", "orange", "green"]);
      for (const name of Object.values(COLOR_ASSET_NAME)) {
        assert.ok(validNames.has(name), `unknown asset name: ${name}`);
      }
    });
  });
});
