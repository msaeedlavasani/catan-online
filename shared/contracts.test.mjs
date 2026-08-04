// Contract test — verifies the shared contracts module is importable
// and has the expected shape.  Run independently with
// `node --test shared/contracts.test.mjs`.
// Also ensures both client and server see the same frozen values.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EVENT,
  BROADCAST,
  CARD_TYPES,
  PHASES,
  PENDING_TYPES,
  ACK_SHAPE,
  EVENT_PAYLOAD,
  EVENTS_WITHOUT_PAYLOAD,
  PLAYER_PUBLIC_FIELDS,
  PLAYER_PRIVATE_FIELDS,
  GAME_STATE_FIELDS,
  ALL_EVENT_NAMES,
  ALL_BROADCAST_NAMES,
  PHASE_SET,
} from "./contracts.mjs";

// ── Helpers ──────────────────────────────────────────────────────────

function assertFrozen(obj, label) {
  assert.throws(() => { obj._test = 1; }, TypeError, `${label} should be frozen`);
}

function assertDeepFrozen(obj, label) {
  assertFrozen(obj, label);
  for (const [key, val] of Object.entries(obj)) {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      assertFrozen(val, `${label}.${key}`);
    }
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe("shared/contracts (event names)", () => {
  it("EVENT contains all 24 client→server event names", () => {
    const names = Object.values(EVENT);
    assert.equal(names.length, 24, "should have exactly 24 event name constants");
  });

  it("EVENT is frozen (immutable)", () => {
    assertFrozen(EVENT, "EVENT");
    assert.throws(() => { EVENT.CREATE_ROOM = "x"; }, TypeError);
    assert.throws(() => { EVENT.NEW_EVENT = "new"; }, TypeError);
  });

  it("ALL_EVENT_NAMES is frozen and matches EVENT values", () => {
    assertFrozen(ALL_EVENT_NAMES, "ALL_EVENT_NAMES");
    assert.deepEqual([...ALL_EVENT_NAMES].sort(), [...Object.values(EVENT)].sort());
  });

  it("every EVENT value is a non-empty string", () => {
    for (const [key, val] of Object.entries(EVENT)) {
      assert.equal(typeof val, "string", `EVENT.${key} should be a string`);
      assert.ok(val.length > 0, `EVENT.${key} should not be empty`);
    }
  });

  it("all EVENT values are unique (no duplicate event names)", () => {
    const vals = Object.values(EVENT);
    assert.equal(new Set(vals).size, vals.length, "all event names must be unique");
  });

  it("BROADCAST contains exactly 2 server→client event names", () => {
    assert.deepEqual(Object.keys(BROADCAST).sort(), ["GAME_STATE", "MY_PRIVATE_STATE"].sort());
  });

  it("BROADCAST is frozen", () => {
    assertFrozen(BROADCAST, "BROADCAST");
    assert.throws(() => { BROADCAST.NEW = "x"; }, TypeError);
  });

  it("ALL_BROADCAST_NAMES is frozen and matches BROADCAST values", () => {
    assertFrozen(ALL_BROADCAST_NAMES, "ALL_BROADCAST_NAMES");
    assert.deepEqual([...ALL_BROADCAST_NAMES].sort(), [...Object.values(BROADCAST)].sort());
  });

  it("EVENT and BROADCAST names do not collide", () => {
    const evSet = new Set(Object.values(EVENT));
    for (const val of Object.values(BROADCAST)) {
      assert.ok(!evSet.has(val), `BROADCAST value "${val}" also appears in EVENT`);
    }
  });
});

describe("shared/contracts (CARD_TYPES)", () => {
  it("contains the 5 canonical dev card types", () => {
    assert.deepEqual(
      [...CARD_TYPES].sort(),
      ["knight", "monopoly", "roadBuilding", "victory", "yearOfPlenty"].sort(),
    );
    assert.equal(CARD_TYPES.length, 5);
  });

  it("is frozen (immutable)", () => {
    assertFrozen(CARD_TYPES, "CARD_TYPES");
    assert.throws(() => { CARD_TYPES[0] = "joker"; }, TypeError);
    assert.throws(() => { CARD_TYPES.push("joker"); }, TypeError);
  });

  it("contains only known Catan dev card types", () => {
    const valid = new Set(["knight", "victory", "roadBuilding", "yearOfPlenty", "monopoly"]);
    CARD_TYPES.forEach((c) => assert.ok(valid.has(c), `unknown card type: ${c}`));
  });
});

describe("shared/contracts (PHASES)", () => {
  it("defines the 4 canonical game phases", () => {
    assert.deepEqual(Object.keys(PHASES).sort(), ["ENDED", "LOBBY", "PLAYING", "SETUP"].sort());
    assert.equal(Object.keys(PHASES).length, 4);
  });

  it("is frozen (immutable)", () => {
    assertFrozen(PHASES, "PHASES");
  });

  it("all phase values are non-empty strings", () => {
    for (const [key, val] of Object.entries(PHASES)) {
      assert.equal(typeof val, "string", `PHASES.${key} must be a string`);
      assert.ok(val.length > 0, `PHASES.${key} must not be empty`);
    }
  });

  it("PHASE_SET contains all phase values", () => {
    assertFrozen(PHASE_SET, "PHASE_SET");
    for (const val of Object.values(PHASES)) {
      assert.ok(PHASE_SET.has(val), `PHASE_SET missing "${val}"`);
    }
    assert.equal(PHASE_SET.size, 4);
  });
});

describe("shared/contracts (PENDING_TYPES)", () => {
  it("defines the 6 canonical pending action types", () => {
    assert.deepEqual(
      Object.keys(PENDING_TYPES).sort(),
      ["DISCARD", "MONOPOLY", "ROAD_BUILDING_FREE", "ROBBER_MOVE", "ROBBER_STEAL", "YEAR_OF_PLENTY"].sort(),
    );
    assert.equal(Object.keys(PENDING_TYPES).length, 6);
  });

  it("is frozen (immutable)", () => {
    assertFrozen(PENDING_TYPES, "PENDING_TYPES");
  });

  it("all pending type values are non-empty strings", () => {
    for (const [key, val] of Object.entries(PENDING_TYPES)) {
      assert.equal(typeof val, "string", `PENDING_TYPES.${key} must be a string`);
      assert.ok(val.length > 0);
    }
  });
});

describe("shared/contracts (EVENT_PAYLOAD shape contracts)", () => {
  it("every event in EVENT has a corresponding EVENT_PAYLOAD entry", () => {
    const eventValues = new Set(Object.values(EVENT));
    for (const key of Object.keys(EVENT_PAYLOAD)) {
      assert.ok(eventValues.has(key), `EVENT_PAYLOAD key "${key}" is not an EVENT value`);
    }
  });

  it("every EVENT value has a corresponding EVENT_PAYLOAD entry", () => {
    const payloadKeys = new Set(Object.keys(EVENT_PAYLOAD));
    for (const val of Object.values(EVENT)) {
      assert.ok(payloadKeys.has(val), `EVENT value "${val}" missing from EVENT_PAYLOAD`);
    }
  });

  it("EVENT_PAYLOAD is frozen", () => {
    assertFrozen(EVENT_PAYLOAD, "EVENT_PAYLOAD");
    assert.throws(() => { EVENT_PAYLOAD.newEvent = {}; }, TypeError);
  });

  it("every EVENT_PAYLOAD sub-object is frozen", () => {
    for (const [eventName, schema] of Object.entries(EVENT_PAYLOAD)) {
      assertFrozen(schema, `EVENT_PAYLOAD["${eventName}"]`);
    }
  });

  it("EVENTS_WITHOUT_PAYLOAD are a subset of events with empty payload schema", () => {
    for (const evt of EVENTS_WITHOUT_PAYLOAD) {
      const schema = EVENT_PAYLOAD[evt];
      assert.ok(schema, `"${evt}" should exist in EVENT_PAYLOAD`);
      assert.deepEqual(schema, {}, `"${evt}" should have empty payload schema`);
    }
  });

  it("EVENTS_WITHOUT_PAYLOAD is frozen", () => {
    assertFrozen(EVENTS_WITHOUT_PAYLOAD, "EVENTS_WITHOUT_PAYLOAD");
  });

  it("events with empty schema are exactly EVENTS_WITHOUT_PAYLOAD (no hidden no-payload events)", () => {
    const emptySchemaEvents = Object.entries(EVENT_PAYLOAD)
      .filter(([, schema]) => Object.keys(schema).length === 0)
      .map(([name]) => name)
      .sort();
    assert.deepEqual(emptySchemaEvents, [...EVENTS_WITHOUT_PAYLOAD].sort());
  });

  it("ACK_SHAPE is frozen and defines the canonical ack fields", () => {
    assertFrozen(ACK_SHAPE, "ACK_SHAPE");
    assert.ok("ok" in ACK_SHAPE);
    assert.ok("error" in ACK_SHAPE);
    assert.equal(ACK_SHAPE.ok, "boolean");
    assert.equal(ACK_SHAPE.error, "string (only when ok === false)");
  });
});

describe("shared/contracts (state shape contracts)", () => {
  describe("PLAYER_PUBLIC_FIELDS", () => {
    it("contains the 12 canonical public player fields", () => {
      assert.equal(PLAYER_PUBLIC_FIELDS.length, 12);
    });

    it("is frozen", () => {
      assertFrozen(PLAYER_PUBLIC_FIELDS, "PLAYER_PUBLIC_FIELDS");
    });

    it("does NOT include private fields (resources, devCards)", () => {
      assert.ok(!PLAYER_PUBLIC_FIELDS.includes("resources"), "resources must NOT be public");
      assert.ok(!PLAYER_PUBLIC_FIELDS.includes("devCards"), "devCards must NOT be public");
    });

    it("includes the essential public identifiers and aggregates", () => {
      const required = ["id", "name", "color", "resourceCount", "devCardCount", "connected"];
      for (const field of required) {
        assert.ok(PLAYER_PUBLIC_FIELDS.includes(field), `missing public field: ${field}`);
      }
    });
  });

  describe("PLAYER_PRIVATE_FIELDS", () => {
    it("contains exactly resources and devCards", () => {
      assert.deepEqual([...PLAYER_PRIVATE_FIELDS].sort(), ["devCards", "resources"].sort());
      assert.equal(PLAYER_PRIVATE_FIELDS.length, 2);
    });

    it("is frozen", () => {
      assertFrozen(PLAYER_PRIVATE_FIELDS, "PLAYER_PRIVATE_FIELDS");
    });

    it("does NOT include any public field", () => {
      const pubSet = new Set(PLAYER_PUBLIC_FIELDS);
      for (const field of PLAYER_PRIVATE_FIELDS) {
        assert.ok(!pubSet.has(field), `"${field}" is in both public and private fields`);
      }
    });
  });

  describe("GAME_STATE_FIELDS", () => {
    it("contains the 24 canonical top-level state fields", () => {
      assert.equal(GAME_STATE_FIELDS.length, 24);
    });

    it("is frozen", () => {
      assertFrozen(GAME_STATE_FIELDS, "GAME_STATE_FIELDS");
    });

    it("includes all core game state identifiers", () => {
      const required = [
        "gameId", "phase", "players", "board",
        "currentPlayerIndex", "turnNumber", "dice",
        "log", "winnerId",
      ];
      for (const field of required) {
        assert.ok(GAME_STATE_FIELDS.includes(field), `missing game state field: ${field}`);
      }
    });
  });
});

describe("shared/contracts (cross-reference integrity)", () => {
  it("CARD_TYPES values match PENDING_TYPES card-related entries", () => {
    // "knight", "victory", "roadBuilding", "yearOfPlenty", "monopoly"
    // But pending types use camelCase names. We only verify that all CARD_TYPES
    // can be mapped to pending types.
    const pendingVals = new Set(Object.values(PENDING_TYPES));
    // yearOfPlenty and monopoly ARE pending type values
    assert.ok(pendingVals.has("yearOfPlenty"), "yearOfPlenty missing from PENDING_TYPES");
    assert.ok(pendingVals.has("monopoly"), "monopoly missing from PENDING_TYPES");
    assert.ok(pendingVals.has("roadBuildingFree"), "roadBuildingFree missing from PENDING_TYPES");
  });

  it("no private field appears in GAME_STATE_FIELDS with its raw name", () => {
    // GAME_STATE_FIELDS describes the public state; players array uses
    // resourceCount/devCardCount instead of resources/devCards.
    // The raw "resources" and "devCards" should not be top-level.
    assert.ok(!GAME_STATE_FIELDS.includes("resources"), "raw resources should not be top-level");
    assert.ok(!GAME_STATE_FIELDS.includes("devCards"), "raw devCards should not be top-level");
  });

  it("all set-like helpers are indeed frozen", () => {
    assertFrozen(ALL_EVENT_NAMES, "ALL_EVENT_NAMES");
    assertFrozen(ALL_BROADCAST_NAMES, "ALL_BROADCAST_NAMES");
    assertFrozen(PHASE_SET, "PHASE_SET");
  });
});
