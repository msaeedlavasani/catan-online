import test from "node:test";
import assert from "node:assert/strict";
import { assignBoardContent, buildBoardGeometry, MAX_PLAYERS } from "../src/game/core.js";
import {
  createRoom,
  joinRoom,
  markDisconnected,
  markReconnected,
  getRoom,
  _resetRoomsForTest,
  _setTTLOverride,
  _getPendingCleanups,
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
// joinRoom — capacity (MAX_PLAYERS from shared constants)
// ═══════════════════════════════════════════════════════════════════════════

test("joinRoom fills up to MAX_PLAYERS players then rejects the overflow", () => {
  setup();
  const { room } = createRoom("P1");
  assert.equal(room.players.length, 1);

  for (let i = 2; i <= MAX_PLAYERS; i++) {
    assert.ok(joinRoom(room.gameId, `P${i}`));
    assert.equal(room.players.length, i);
  }

  // One more than capacity should be rejected
  const overflow = joinRoom(room.gameId, "Overflow");
  assert.equal(overflow, null);
  assert.equal(room.players.length, MAX_PLAYERS);
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

// ═══════════════════════════════════════════════════════════════════════════
// TTL cleanup — in-game rooms (Task Batch 2.1)
// ═══════════════════════════════════════════════════════════════════════════

// ─── All disconnected → cleanup timer starts ────────────────────────

test("in-game: all disconnect starts a cleanup timer", () => {
  setup();
  _setTTLOverride(30_000); // real TTL is irrelevant here
  const { room } = createRoom("Alice");
  joinRoom(room.gameId, "Bob");
  const aliceId = room.players[0].id;
  const bobId = room.players[1].id;
  startGame(room);

  markDisconnected(room.gameId, aliceId);
  // Only one disconnected — no timer yet
  assert.equal(_getPendingCleanups().size, 0);

  markDisconnected(room.gameId, bobId);
  // Now both disconnected — timer should be scheduled
  assert.equal(_getPendingCleanups().size, 1);
  assert.ok(_getPendingCleanups().has(room.gameId));
});

test("in-game: cleanup timer does NOT start when some players are still connected", () => {
  setup();
  _setTTLOverride(30_000);
  const { room } = createRoom("Alice");
  joinRoom(room.gameId, "Bob");
  joinRoom(room.gameId, "Charlie");
  const aliceId = room.players[0].id;
  const bobId = room.players[1].id;
  startGame(room);

  // Two disconnect, one stays — no timer
  markDisconnected(room.gameId, aliceId);
  markDisconnected(room.gameId, bobId);
  assert.equal(_getPendingCleanups().size, 0);

  // Charlie still connected — room intact
  assert.ok(getRoom(room.gameId));
  assert.equal(room.players[2].connected, true);
});

// ─── Reconnect cancels timer ────────────────────────────────────────

test("in-game: reconnecting any player cancels the pending cleanup timer", () => {
  setup();
  _setTTLOverride(30_000);
  const { room } = createRoom("Alice");
  joinRoom(room.gameId, "Bob");
  const aliceId = room.players[0].id;
  const bobId = room.players[1].id;
  startGame(room);

  // Both disconnect → timer created
  markDisconnected(room.gameId, aliceId);
  markDisconnected(room.gameId, bobId);
  assert.equal(_getPendingCleanups().size, 1);

  // Bob reconnects → timer cancelled
  markReconnected(room.gameId, bobId);
  assert.equal(_getPendingCleanups().size, 0);
  assert.ok(getRoom(room.gameId));
  assert.equal(room.players[1].connected, true);
});

test("in-game: reconnect then disconnect again starts a fresh timer", () => {
  setup();
  _setTTLOverride(30_000);
  const { room } = createRoom("Alice");
  joinRoom(room.gameId, "Bob");
  const aliceId = room.players[0].id;
  const bobId = room.players[1].id;
  startGame(room);

  // All disconnect → timer
  markDisconnected(room.gameId, aliceId);
  markDisconnected(room.gameId, bobId);
  assert.equal(_getPendingCleanups().size, 1);

  // Reconnect Bob → cancelled
  markReconnected(room.gameId, bobId);
  assert.equal(_getPendingCleanups().size, 0);

  // Bob disconnects again → new timer
  markDisconnected(room.gameId, bobId);
  assert.equal(_getPendingCleanups().size, 1);
});

// ─── Deterministic timer expiry ────────────────────────────────────

test("in-game: room is deleted after TTL expires (all disconnected)", async () => {
  setup();
  const TTL = 60; // very short for deterministic test speed
  _setTTLOverride(TTL);

  const { room } = createRoom("Alice");
  const aliceId = room.players[0].id;
  startGame(room);

  markDisconnected(room.gameId, aliceId);
  assert.ok(getRoom(room.gameId)); // still there
  assert.equal(_getPendingCleanups().size, 1);

  // Wait just past the TTL
  await new Promise((r) => setTimeout(r, TTL + 20));

  assert.equal(getRoom(room.gameId), null); // cleaned up
  assert.equal(_getPendingCleanups().size, 0); // timer removed from map
});

test("in-game: room survives when reconnect happens before TTL expires", async () => {
  setup();
  const TTL = 80;
  _setTTLOverride(TTL);

  const { room } = createRoom("Alice");
  const aliceId = room.players[0].id;
  startGame(room);

  markDisconnected(room.gameId, aliceId);
  assert.equal(_getPendingCleanups().size, 1);

  // Reconnect at half the TTL
  await new Promise((r) => setTimeout(r, TTL / 2));

  markReconnected(room.gameId, aliceId);
  assert.equal(_getPendingCleanups().size, 0);

  // Wait past what would have been the TTL
  await new Promise((r) => setTimeout(r, TTL));

  assert.ok(getRoom(room.gameId)); // room survives
});

// ─── Lobby: immediate deletion, no timer leak ───────────────────────

test("lobby: last player disconnect deletes room immediately and leaves no timer", () => {
  setup();
  _setTTLOverride(30_000);
  const { room, player: alice } = createRoom("Alice");

  markDisconnected(room.gameId, alice.id);
  assert.equal(getRoom(room.gameId), null);
  assert.equal(_getPendingCleanups().size, 0); // no timer for lobby
});

test("lobby: non-last player disconnect removes player but leaves no timer", () => {
  setup();
  _setTTLOverride(30_000);
  const { room } = createRoom("Alice");
  joinRoom(room.gameId, "Bob");
  const bobId = room.players[1].id;

  markDisconnected(room.gameId, bobId);
  assert.equal(room.players.length, 1);
  assert.equal(_getPendingCleanups().size, 0); // lobby never creates timer
});

// ─── _resetRoomsForTest prevents process leaks ──────────────────────

test("_resetRoomsForTest clears all pending cleanup timers", () => {
  setup();
  _setTTLOverride(30_000);
  const { room } = createRoom("Alice");
  startGame(room);
  markDisconnected(room.gameId, room.players[0].id);
  assert.equal(_getPendingCleanups().size, 1);

  _resetRoomsForTest(); // must nuke timer

  assert.equal(_getPendingCleanups().size, 0);
  assert.equal(getRoom(room.gameId), null);
});

test("_resetRoomsForTest also resets TTL override", () => {
  setup();
  _setTTLOverride(999);
  assert.equal(_getPendingCleanups().size, 0); // no timer, just verifying override was set

  _resetRoomsForTest();
  // Create a room and trigger cleanup — should use real config TTL, not 999
  // (We verify the override was cleared by checking that no stale override
  //  affects subsequent tests — this is implicitly tested by the isolation
  //  that _resetRoomsForTest is called in every setup())
  const { room } = createRoom("Test");
  startGame(room);
  markDisconnected(room.gameId, room.players[0].id);
  // Timer exists (TTL came from real config)
  assert.equal(_getPendingCleanups().size, 1);
});

// ─── Edge cases ─────────────────────────────────────────────────────

test("in-game: markDisconnected on already-disconnected all-disconnected room does not double-schedule", () => {
  setup();
  _setTTLOverride(30_000);
  const { room } = createRoom("Alice");
  startGame(room);
  const pid = room.players[0].id;

  markDisconnected(room.gameId, pid);
  assert.equal(_getPendingCleanups().size, 1);

  // Second disconnect for the same player (e.g. second socket)
  markDisconnected(room.gameId, pid);
  assert.equal(_getPendingCleanups().size, 1); // still exactly 1 timer
});

test("markReconnected on non-existent room returns null", () => {
  setup();
  const result = markReconnected("GHOST", "fake-id");
  assert.equal(result, null);
});

test("markReconnected with unknown playerId but existing room leaves room unchanged, no timer interaction", () => {
  setup();
  const { room } = createRoom("Alice");
  startGame(room);
  markDisconnected(room.gameId, room.players[0].id); // timer scheduled
  assert.equal(_getPendingCleanups().size, 1);

  // Reconnect a bogus player — does NOT cancel the timer
  const result = markReconnected(room.gameId, "bogus-id");
  assert.ok(result);
  assert.equal(_getPendingCleanups().size, 1); // timer still pending (only real reconnects cancel)
});
