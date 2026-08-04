import test from "node:test";
import assert from "node:assert/strict";
import { newGameId, newId } from "../src/game/core.js";
import { createRoom } from "../src/rooms.js";

// ─── Room-code format ──────────────────────────────────────────────
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;

test("room code is 5 characters from the allowed alphabet", () => {
  for (let i = 0; i < 200; i++) {
    const code = newGameId();
    assert.equal(code.length, 5, `bad length: "${code}"`);
    assert.match(code, ROOM_CODE_RE, `bad chars: "${code}"`);
  }
});

test("room code contains no ambiguous characters (0, O, I, 1)", () => {
  const forbidden = new Set(["0", "O", "I", "1"]);
  for (let i = 0; i < 200; i++) {
    for (const ch of newGameId()) {
      assert.ok(!forbidden.has(ch), `ambiguous char ${ch} in room code`);
    }
  }
});

// ─── Room-code uniqueness ──────────────────────────────────────────
test("room codes do not collide across 2 000 generations", () => {
  const seen = new Set();
  for (let i = 0; i < 2_000; i++) {
    const code = newGameId();
    assert.ok(!seen.has(code), `collision at iteration ${i}: "${code}"`);
    seen.add(code);
  }
});

// ─── Player-id format (UUID v4) ────────────────────────────────────
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("player id is a valid UUID v4", () => {
  for (let i = 0; i < 500; i++) {
    const id = newId();
    assert.match(id, UUID_V4_RE, `bad UUID: "${id}"`);
  }
});

test("player id version nibble is 4 (UUID v4)", () => {
  for (let i = 0; i < 500; i++) {
    const id = newId();
    // position 14 is the version character (0-indexed in the canonical string)
    assert.equal(id[14], "4");
  }
});

test("player id variant nibble is in [89ab]", () => {
  for (let i = 0; i < 500; i++) {
    const id = newId();
    assert.match(id[19], /^[89ab]$/i, `bad variant: ${id[19]} in "${id}"`);
  }
});

// ─── Player-id uniqueness ──────────────────────────────────────────
test("player ids do not collide across 50 000 generations", () => {
  const seen = new Set();
  for (let i = 0; i < 50_000; i++) {
    const id = newId();
    assert.ok(!seen.has(id), `collision at iteration ${i}: "${id}"`);
    seen.add(id);
  }
});

// ─── Entropy sanity: generated IDs are not all identical ───────────
test("consecutive room codes are different", () => {
  const codes = Array.from({ length: 100 }, () => newGameId());
  const unique = new Set(codes);
  assert.equal(unique.size, 100, "expected all room codes to be unique");
});

test("consecutive player ids are different", () => {
  const ids = Array.from({ length: 100 }, () => newId());
  const unique = new Set(ids);
  assert.equal(unique.size, 100, "expected all player ids to be unique");
});

// ─── Integration: createRoom produces valid ids ────────────────────
test("createRoom returns a room with valid code and valid player id", () => {
  const { room, player } = createRoom("Alice");
  assert.equal(room.gameId.length, 5);
  assert.match(room.gameId, ROOM_CODE_RE);
  assert.match(player.id, UUID_V4_RE);
});

test("two createRoom calls produce different codes and different player ids", () => {
  const a = createRoom("Alice");
  const b = createRoom("Bob");
  assert.notEqual(a.room.gameId, b.room.gameId, "room codes must differ");
  assert.notEqual(a.player.id, b.player.id, "player ids must differ");
});

// ─── Collision-avoidance: verify newRoomId retries on collision ────
// We simulate a collision by temporarily inserting a room at the code
// that the rooms module would otherwise produce.  Since newRoomId is
// not exported we test indirectly: create 100 rooms in quick succession
// and verify all codes are unique.
test("no room code collision when creating many rooms", () => {
  const codes = new Set();
  for (let i = 0; i < 200; i++) {
    const { room } = createRoom(`Player${i}`);
    assert.ok(!codes.has(room.gameId), `collision: "${room.gameId}"`);
    codes.add(room.gameId);
  }
});

// ─── ID source is not Math.random ──────────────────────────────────
test("newGameId does not call Math.random (uses crypto)", () => {
  const spy = Math.random;
  let called = false;
  Math.random = () => {
    called = true;
    return 0.5;
  };
  try {
    newGameId();
  } finally {
    Math.random = spy;
  }
  assert.equal(called, false, "newGameId must not call Math.random");
});

test("newId does not call Math.random (uses crypto)", () => {
  const spy = Math.random;
  let called = false;
  Math.random = () => {
    called = true;
    return 0.5;
  };
  try {
    newId();
  } finally {
    Math.random = spy;
  }
  assert.equal(called, false, "newId must not call Math.random");
});
