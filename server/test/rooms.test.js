import test from "node:test";
import assert from "node:assert/strict";
import { assignBoardContent, buildBoardGeometry } from "../src/game/core.js";
import {
  createRoom,
  joinRoom,
  markDisconnected,
  markReconnected,
  getRoom,
  _resetRoomsForTest,
} from "../src/rooms.js";

// ─── Isolate state: every top-level test starts from a clean rooms map ──────
function setup() {
  _resetRoomsForTest();
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Transition a room from lobby → playing so we can test in-game scenarios. */
function startGame(room) {
  room.board = assignBoardContent(buildBoardGeometry());
  room.phase = "playing";
  room.currentPlayerIndex = 0;
  room.turnNumber = 1;
  room.dice = [3, 4];
  return room;
}

// ═══════════════════════════════════════════════════════════════════════════
// createRoom
// ═══════════════════════════════════════════════════════════════════════════

test("createRoom returns a lobby room with valid ids", () => {
  setup();
  const { room, player } = createRoom("Alice");
  assert.equal(room.phase, "lobby");
  assert.match(room.gameId, ROOM_CODE_RE);
  assert.match(player.id, UUID_V4_RE);
  assert.equal(player.name, "Alice");
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].id, player.id);
  assert.equal(room.players[0].connected, true);
});

test("createRoom defaults player name to 'Player' when empty", () => {
  setup();
  const { player } = createRoom("");
  assert.equal(player.name, "Player");
});

test("createRoom defaults player name to 'Player' when omitted (undefined)", () => {
  setup();
  const { player } = createRoom();
  assert.equal(player.name, "Player");
});

test("createRoom stores the room so getRoom can retrieve it", () => {
  setup();
  const { room } = createRoom("Host");
  const found = getRoom(room.gameId);
  assert.ok(found);
  assert.equal(found.gameId, room.gameId);
  assert.equal(found.phase, "lobby");
});

test("createRoom produces unique room codes on repeated calls", () => {
  setup();
  const codes = new Set();
  for (let i = 0; i < 100; i++) {
    const { room } = createRoom(`P${i}`);
    assert.ok(!codes.has(room.gameId), `collision: ${room.gameId}`);
    codes.add(room.gameId);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// joinRoom — success
// ═══════════════════════════════════════════════════════════════════════════

test("joinRoom adds a second player to the lobby", () => {
  setup();
  const { room } = createRoom("Alice");
  const result = joinRoom(room.gameId, "Bob");
  assert.ok(result);
  assert.equal(result.room.gameId, room.gameId);
  assert.equal(result.player.name, "Bob");
  assert.equal(room.players.length, 2);
  assert.equal(room.players[1].id, result.player.id);
  assert.equal(room.players[1].connected, true);
});

test("joinRoom logs the join event", () => {
  setup();
  const { room } = createRoom("Alice");
  joinRoom(room.gameId, "Bob");
  assert.ok(room.log.some((entry) => entry.includes("Bob")));
});

// ═══════════════════════════════════════════════════════════════════════════
// joinRoom — capacity (max 4)
// ═══════════════════════════════════════════════════════════════════════════

test("joinRoom fills up to 4 players then rejects the 5th", () => {
  setup();
  const { room } = createRoom("P1");
  assert.equal(room.players.length, 1);

  assert.ok(joinRoom(room.gameId, "P2"));
  assert.equal(room.players.length, 2);

  assert.ok(joinRoom(room.gameId, "P3"));
  assert.equal(room.players.length, 3);

  assert.ok(joinRoom(room.gameId, "P4"));
  assert.equal(room.players.length, 4);

  // 5th player should be rejected
  const fifth = joinRoom(room.gameId, "P5");
  assert.equal(fifth, null);
  assert.equal(room.players.length, 4);
});

// ═══════════════════════════════════════════════════════════════════════════
// joinRoom — non-existent room
// ═══════════════════════════════════════════════════════════════════════════

test("joinRoom returns null for a non-existent room code", () => {
  setup();
  const result = joinRoom("ZZZZZ", "Stranger");
  assert.equal(result, null);
});

// ═══════════════════════════════════════════════════════════════════════════
// joinRoom — already started game
// ═══════════════════════════════════════════════════════════════════════════

test("joinRoom returns null when the game has already started", () => {
  setup();
  const { room } = createRoom("Alice");
  startGame(room); // phase → "playing"
  const result = joinRoom(room.gameId, "LateBob");
  assert.equal(result, null);
  assert.equal(room.players.length, 1); // no one added
});

test("joinRoom returns null during setup phase (not lobby)", () => {
  setup();
  const { room } = createRoom("Alice");
  room.phase = "setup";
  const result = joinRoom(room.gameId, "LateBob");
  assert.equal(result, null);
});

// ═══════════════════════════════════════════════════════════════════════════
// markDisconnected — lobby: removes player
// ═══════════════════════════════════════════════════════════════════════════

test("markDisconnected removes the player in lobby phase", () => {
  setup();
  const { room, player: alice } = createRoom("Alice");
  joinRoom(room.gameId, "Bob");
  const bobId = room.players[1].id;
  assert.equal(room.players.length, 2);

  const result = markDisconnected(room.gameId, bobId);
  assert.ok(result);
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].id, alice.id);
});

test("markDisconnected in lobby deletes the room when the last player leaves", () => {
  setup();
  const { room, player } = createRoom("Alice");
  const result = markDisconnected(room.gameId, player.id);
  assert.equal(result, null);
  assert.equal(getRoom(room.gameId), null);
});

// ═══════════════════════════════════════════════════════════════════════════
// markDisconnected — in-game: keeps player, marks connected=false
// ═══════════════════════════════════════════════════════════════════════════

test("markDisconnected in-game marks player connected=false but keeps them", () => {
  setup();
  const { room } = createRoom("Alice");
  joinRoom(room.gameId, "Bob");
  const bobId = room.players[1].id;
  startGame(room);

  const result = markDisconnected(room.gameId, bobId);
  assert.ok(result);
  assert.equal(room.players.length, 2); // still 2 players
  assert.equal(room.players[1].connected, false);
  // Alice is still connected
  assert.equal(room.players[0].connected, true);
});

test("markDisconnected in-game does not delete the room", () => {
  setup();
  const { room, player: alice } = createRoom("Alice");
  startGame(room);

  markDisconnected(room.gameId, alice.id);
  // Room must still exist
  const found = getRoom(room.gameId);
  assert.ok(found);
});

test("markDisconnected returns null for non-existent room", () => {
  setup();
  const result = markDisconnected("GHOST", "fake-id");
  assert.equal(result, null);
});

// ═══════════════════════════════════════════════════════════════════════════
// markReconnected
// ═══════════════════════════════════════════════════════════════════════════

test("markReconnected sets connected=true for a known player", () => {
  setup();
  const { room } = createRoom("Alice");
  joinRoom(room.gameId, "Bob");
  const bobId = room.players[1].id;
  startGame(room);

  // First disconnect
  markDisconnected(room.gameId, bobId);
  assert.equal(room.players[1].connected, false);

  // Then reconnect
  const result = markReconnected(room.gameId, bobId);
  assert.ok(result);
  assert.equal(room.players[1].connected, true);
});

test("markReconnected returns null for non-existent room", () => {
  setup();
  const result = markReconnected("GHOST", "fake-id");
  assert.equal(result, null);
});

test("markReconnected with unknown playerId returns room unchanged", () => {
  setup();
  const { room } = createRoom("Alice");
  const result = markReconnected(room.gameId, "bogus-id");
  assert.ok(result);
  assert.equal(result.gameId, room.gameId);
  // No player was modified
  assert.equal(room.players[0].connected, true);
});

// ═══════════════════════════════════════════════════════════════════════════
// Full lifecycle: disconnect → reconnect (in-game)
// ═══════════════════════════════════════════════════════════════════════════

test("full in-game disconnect and reconnect cycle preserves player data", () => {
  setup();
  const { room } = createRoom("Alice");
  joinRoom(room.gameId, "Bob");
  const bob = room.players[1];
  startGame(room);

  // Give Bob some resources so we can verify they survive the cycle
  bob.resources = { wood: 2, brick: 1, wheat: 0, sheep: 3, ore: 1 };

  // Disconnect
  markDisconnected(room.gameId, bob.id);
  assert.equal(bob.connected, false);

  // Reconnect
  markReconnected(room.gameId, bob.id);
  assert.equal(bob.connected, true);
  assert.deepEqual(bob.resources, { wood: 2, brick: 1, wheat: 0, sheep: 3, ore: 1 });
  assert.equal(bob.name, "Bob");
});

// ═══════════════════════════════════════════════════════════════════════════
// Empty room cleanup
// ═══════════════════════════════════════════════════════════════════════════

test("empty room is deleted from the map after all players leave in lobby", () => {
  setup();
  const { room, player: alice } = createRoom("Alice");
  const roomId = room.gameId;

  // Room exists before disconnect
  assert.ok(getRoom(roomId));

  // Last player leaves → room deleted
  markDisconnected(roomId, alice.id);
  assert.equal(getRoom(roomId), null);
});

test("room with multiple lobby players is NOT deleted when one leaves", () => {
  setup();
  const { room } = createRoom("Alice");
  joinRoom(room.gameId, "Bob");
  const bobId = room.players[1].id;

  markDisconnected(room.gameId, bobId);
  // Room must still exist with Alice inside
  const found = getRoom(room.gameId);
  assert.ok(found);
  assert.equal(found.players.length, 1);
  assert.equal(found.players[0].name, "Alice");
});

test("room in-game is NOT deleted when last connected player leaves", () => {
  setup();
  const { room, player: alice } = createRoom("Alice");
  startGame(room);

  markDisconnected(room.gameId, alice.id);
  // Room persists for potential reconnect
  const found = getRoom(room.gameId);
  assert.ok(found);
  // Player is still there but disconnected
  assert.equal(found.players.length, 1);
  assert.equal(found.players[0].connected, false);
});
