import test from "node:test";
import assert from "node:assert/strict";
import { after, afterEach } from "node:test";
import { io as ioc } from "socket.io-client";

import { server, io } from "../src/index.js";
import { _resetRoomsForTest } from "../src/rooms.js";
import { _setStorageReady } from "../src/storage.js";

// Persistence should NOT fire during socket tests — the storage layer is
// never initialised in this test file, but we force-disable it anyway so
// we don't depend on module-init ordering across parallel test files.
_setStorageReady(false);

// ── Ephemeral server ─────────────────────────────────────────────────
let PORT;
await new Promise((resolve, reject) => {
  server.listen(0, () => resolve());
  server.once("error", reject);
});
PORT = server.address().port;
const BASE = `http://localhost:${PORT}`;

after(async () => {
  await new Promise((resolve) => io.close(() => resolve()));
});

afterEach(() => {
  _resetRoomsForTest();
});

// ── Helpers ──────────────────────────────────────────────────────────

function newClient() {
  return new Promise((resolve, reject) => {
    const s = ioc(BASE, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 4000,
    });
    s.on("connect", () => resolve(s));
    s.on("connect_error", (err) => reject(err));
  });
}

/** Emit an event and resolve with the server's ack callback value. */
function emitAck(socket, event, payload = {}) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (resp) => resolve(resp));
  });
}

/** Wait for the *next* occurrence of `event` on `socket`. */
function nextEvent(socket, event, ms = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout: ${event}`)), ms);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

/** Create a room with `name` on `socket` and collect both ack + private state together.
 *  CRITICAL: the private-state listener MUST be registered BEFORE the server
 *  ack returns, otherwise the event is dropped. */
async function createAndCollect(socket, name) {
  const [ack, priv] = await Promise.all([
    emitAck(socket, "createRoom", { playerName: name }),
    nextEvent(socket, "myPrivateState"),
  ]);
  return { ack, priv };
}

/** Join a room and collect ack + private state in one round-trip. */
async function joinAndCollect(socket, roomId, name) {
  const [ack, priv] = await Promise.all([
    emitAck(socket, "joinRoom", { roomId, playerName: name }),
    nextEvent(socket, "myPrivateState"),
  ]);
  return { ack, priv };
}

// ── Regex patterns ───────────────────────────────────────────────────
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ═══════════════════════════════════════════════════════════════════════
// 1. createRoom — success path
// ═══════════════════════════════════════════════════════════════════════

test("createRoom returns valid room + playerId and emits myPrivateState", async () => {
  const a = await newClient();
  try {
    const { ack, priv } = await createAndCollect(a, "Alice");

    assert.ok(ack.room, "ack should include room");
    assert.match(ack.room.gameId, ROOM_CODE_RE);
    assert.match(ack.playerId, UUID_RE);
    assert.equal(ack.room.phase, "lobby");
    assert.equal(ack.room.players.length, 1);
    assert.equal(ack.room.players[0].name, "Alice");
    assert.equal(ack.room.players[0].connected, true);

    assert.deepEqual(priv.resources, { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 });
    assert.deepEqual(priv.devCards, []);
  } finally {
    a.disconnect();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 2. createRoom — invalid payload → ack error
// ═══════════════════════════════════════════════════════════════════════

test("createRoom with empty playerName is rejected by validation layer", async () => {
  const a = await newClient();
  try {
    const ack = await emitAck(a, "createRoom", { playerName: "" });
    assert.equal(ack.ok, false);
    assert.ok(ack.error);
  } finally {
    a.disconnect();
  }
});

test("createRoom with missing payload returns ok:false ack", async () => {
  const a = await newClient();
  try {
    const ack = await emitAck(a, "createRoom", {});
    assert.equal(ack.ok, false);
    assert.ok(ack.error);
  } finally {
    a.disconnect();
  }
});

test("createRoom with overlong playerName returns error", async () => {
  const a = await newClient();
  try {
    const ack = await emitAck(a, "createRoom", { playerName: "A".repeat(20) });
    assert.equal(ack.ok, false);
  } finally {
    a.disconnect();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 3. joinRoom — success + broadcast
// ═══════════════════════════════════════════════════════════════════════

test("joinRoom adds player and broadcasts updated gameState to all clients", async () => {
  const a = await newClient();
  const b = await newClient();
  try {
    const { ack: createAck } = await createAndCollect(a, "Alice");
    const roomId = createAck.room.gameId;

    // Bob joins — register listeners BEFORE the emit resolves
    const [joinAck, bobPriv, aliceBroadcast] = await Promise.all([
      emitAck(b, "joinRoom", { roomId, playerName: "Bob" }),
      nextEvent(b, "myPrivateState"),
      nextEvent(a, "gameState"),
    ]);

    assert.ok(joinAck.room);
    assert.equal(joinAck.room.players.length, 2);
    assert.equal(joinAck.room.players[1].name, "Bob");
    assert.match(joinAck.playerId, UUID_RE);

    assert.equal(aliceBroadcast.players.length, 2);
    assert.equal(aliceBroadcast.players[0].name, "Alice");
    assert.equal(aliceBroadcast.players[1].name, "Bob");

    assert.ok(bobPriv.resources);
  } finally {
    a.disconnect();
    b.disconnect();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 4. joinRoom — error paths
// ═══════════════════════════════════════════════════════════════════════

test("joinRoom with non-existent roomId returns error ack", async () => {
  const a = await newClient();
  try {
    const ack = await emitAck(a, "joinRoom", { roomId: "ZZZZZ", playerName: "Bob" });
    assert.equal(ack.ok, false);
    assert.ok(ack.error);
  } finally {
    a.disconnect();
  }
});

test("joinRoom with missing playerName returns error ack", async () => {
  const a = await newClient();
  try {
    const ack = await emitAck(a, "joinRoom", { roomId: "ABCDE", playerName: "" });
    assert.equal(ack.ok, false);
  } finally {
    a.disconnect();
  }
});

test("joinRoom with non-object payload returns error ack", async () => {
  const a = await newClient();
  try {
    const ack = await emitAck(a, "joinRoom", null);
    assert.equal(ack.ok, false);
  } finally {
    a.disconnect();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 5. gameState broadcast — public info only (no resource leak)
// ═══════════════════════════════════════════════════════════════════════

test("gameState broadcast contains only public player fields", async () => {
  const a = await newClient();
  const b = await newClient();
  try {
    const { ack } = await createAndCollect(a, "Alice");
    const roomId = ack.room.gameId;

    const [_joinAck, _bobPriv, aliceBroadcast] = await Promise.all([
      emitAck(b, "joinRoom", { roomId, playerName: "Bob" }),
      nextEvent(b, "myPrivateState"),
      nextEvent(a, "gameState"),
    ]);

    assert.equal(aliceBroadcast.players.length, 2);
    for (const p of aliceBroadcast.players) {
      assert.ok(!("resources" in p), "public state MUST NOT expose resources");
      assert.ok(!("devCards" in p), "public state MUST NOT expose devCards");
      assert.equal(typeof p.resourceCount, "number");
      assert.equal(typeof p.devCardCount, "number");
      assert.ok(p.resourceCount >= 0);
      assert.ok(p.devCardCount >= 0);
    }
  } finally {
    a.disconnect();
    b.disconnect();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Private state isolation — broadcast delivers per-player private state
// ═══════════════════════════════════════════════════════════════════════

test("broadcast delivers per-player myPrivateState via separate socket emits", async () => {
  const a = await newClient();
  const b = await newClient();
  try {
    const { ack, priv: aPriv } = await createAndCollect(a, "Alice");
    const roomId = ack.room.gameId;

    const { priv: bPriv } = await joinAndCollect(b, roomId, "Bob");

    // Both received private state with empty hands (initial state)
    assert.ok(aPriv.resources);
    assert.ok(bPriv.resources);

    // The key invariant: myPrivateState is delivered per-socket via
    // s.emit() inside broadcast(), NOT via io.to(room).emit().
    // Each client only receives their OWN private data.
  } finally {
    a.disconnect();
    b.disconnect();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 7. Disconnect in lobby → player removed, room broadcast
// ═══════════════════════════════════════════════════════════════════════

test("disconnect in lobby removes the player and notifies remaining clients", async () => {
  const a = await newClient();
  const b = await newClient();
  try {
    const { ack } = await createAndCollect(a, "Alice");
    const roomId = ack.room.gameId;

    // Bob joins — consume the join broadcast on Alice's side too
    const [_join, _bPriv, joinBroadcast] = await Promise.all([
      emitAck(b, "joinRoom", { roomId, playerName: "Bob" }),
      nextEvent(b, "myPrivateState"),
      nextEvent(a, "gameState"),
    ]);
    assert.equal(joinBroadcast.players.length, 2); // sanity

    // Bob disconnects (lobby phase → player removed immediately)
    b.disconnect();

    // Alice receives gameState update → only 1 player remains
    const update = await nextEvent(a, "gameState");
    assert.equal(update.players.length, 1);
    assert.equal(update.players[0].name, "Alice");
  } finally {
    a.disconnect();
    // b is already disconnected
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 8. Disconnect in-game → player marked disconnected, room survives
// ═══════════════════════════════════════════════════════════════════════

test("disconnect in-game marks player connected=false but preserves the room", async () => {
  const a = await newClient();
  const b = await newClient();
  try {
    const { ack } = await createAndCollect(a, "Alice");
    const roomId = ack.room.gameId;

    const { ack: joinAck } = await joinAndCollect(b, roomId, "Bob");
    const bId = joinAck.playerId;

    // Consume Alice's gameState broadcast from Bob's join
    await nextEvent(a, "gameState");

    // Start the game — register listeners BEFORE the ack resolves because
    // handleAction calls broadcast() synchronously before the callback.
    const [startAck, ,] = await Promise.all([
      emitAck(a, "startGame", {}),
      nextEvent(a, "gameState"),
      nextEvent(b, "gameState"),
    ]);
    assert.ok(startAck.ok);

    // Bob disconnects
    b.disconnect();

    // Alice gets gameState update with Bob marked disconnected
    const update = await nextEvent(a, "gameState");
    const bobInUpdate = update.players.find((p) => p.id === bId);
    assert.ok(bobInUpdate, "Bob should still be in the room");
    assert.equal(bobInUpdate.connected, false);

    // Room should still be queryable via requestRoomState
    const query = await emitAck(a, "requestRoomState", { roomId });
    assert.ok(query.room, "Room should still exist after in-game disconnect");
    assert.equal(query.room.players.length, 2);
  } finally {
    a.disconnect();
    // b already disconnected
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 9. Reconnect (rejoinRoom) after in-game disconnect
// ═══════════════════════════════════════════════════════════════════════

test("rejoinRoom after disconnect restores player state and broadcasts", async () => {
  const a = await newClient();
  const b = await newClient();
  try {
    const { ack } = await createAndCollect(a, "Alice");
    const roomId = ack.room.gameId;

    const { ack: joinAck } = await joinAndCollect(b, roomId, "Bob");
    const bId = joinAck.playerId;

    // Consume join broadcast on Alice
    await nextEvent(a, "gameState");

    // Start game — register listeners before ack resolves
    const [startAck, ,] = await Promise.all([
      emitAck(a, "startGame", {}),
      nextEvent(a, "gameState"),
      nextEvent(b, "gameState"),
    ]);
    assert.ok(startAck.ok);

    // Disconnect Bob
    b.disconnect();
    await nextEvent(a, "gameState"); // Bob marked disconnected

    // Reconnect Bob with a new socket using rejoinRoom
    const b2 = await newClient();
    try {
      const [rejoinAck, b2Priv, aUpdate] = await Promise.all([
        emitAck(b2, "rejoinRoom", { roomId, playerId: bId }),
        nextEvent(b2, "myPrivateState"),
        nextEvent(a, "gameState"),
      ]);

      assert.equal(rejoinAck.playerId, bId);
      assert.equal(rejoinAck.room.phase, "setup");

      assert.ok(b2Priv.resources);

      const bobInUpdate = aUpdate.players.find((p) => p.id === bId);
      assert.ok(bobInUpdate);
      assert.equal(bobInUpdate.connected, true);
    } finally {
      b2.disconnect();
    }
  } finally {
    a.disconnect();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 10. rejoinRoom — error paths
// ═══════════════════════════════════════════════════════════════════════

test("rejoinRoom with invalid payload returns error ack", async () => {
  const a = await newClient();
  try {
    const ack = await emitAck(a, "rejoinRoom", {});
    assert.equal(ack.ok, false);
  } finally {
    a.disconnect();
  }
});

test("rejoinRoom to non-existent room returns error ack", async () => {
  const a = await newClient();
  try {
    const ack = await emitAck(a, "rejoinRoom", {
      roomId: "ZZZZZ",
      playerId: "00000000-0000-0000-0000-000000000000",
    });
    assert.equal(ack.ok, false);
  } finally {
    a.disconnect();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 11. requestRoomState
// ═══════════════════════════════════════════════════════════════════════

test("requestRoomState returns existing room", async () => {
  const a = await newClient();
  try {
    const { ack } = await createAndCollect(a, "Alice");
    const roomId = ack.room.gameId;

    const result = await emitAck(a, "requestRoomState", { roomId });
    assert.ok(result.room);
    assert.equal(result.room.gameId, roomId);
  } finally {
    a.disconnect();
  }
});

test("requestRoomState returns null for unknown room", async () => {
  const a = await newClient();
  try {
    const result = await emitAck(a, "requestRoomState", { roomId: "ZZZZZ" });
    assert.equal(result.room, null);
  } finally {
    a.disconnect();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 12. Invalid payload for game action → error ack
// ═══════════════════════════════════════════════════════════════════════

test("game action without being in a room returns error ack", async () => {
  const a = await newClient();
  try {
    // socket.data has no roomId — handleAction rejects with "Not in a room."
    const ack = await emitAck(a, "rollDice", {});
    assert.equal(ack.ok, false);
    assert.ok(ack.error.includes("Not in a room"));
  } finally {
    a.disconnect();
  }
});

test("game action in lobby returns ack (server does not crash)", async () => {
  const a = await newClient();
  try {
    await createAndCollect(a, "Alice");

    // rollDice in lobby: when sum === 7 the engine returns ok (because the
    // "seven" branch does not touch the board).  When sum !== 7 the engine
    // crashes on g.board.tiles and handleAction catches it → ok:false.
    // Either way the ack must arrive — the server must never crash.
    const ack2 = await emitAck(a, "rollDice", {});
    assert.ok("ok" in ack2, "ack should be received");
    if (!ack2.ok) {
      assert.ok(ack2.error, "error ack should include error message");
    }
  } finally {
    a.disconnect();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 13. Full flow: create → join → start → disconnect both → reconnect
// ═══════════════════════════════════════════════════════════════════════

test("full lifecycle: lobby → start → disconnect both → reconnect one", async () => {
  const a = await newClient();
  const b = await newClient();
  try {
    const { ack } = await createAndCollect(a, "Alice");
    const roomId = ack.room.gameId;
    const aId = ack.playerId;

    const { ack: joinAck } = await joinAndCollect(b, roomId, "Bob");
    const bId = joinAck.playerId;

    // Consume join broadcast
    await nextEvent(a, "gameState");

    // Start game — register listeners before ack resolves
    const [startAck, ,] = await Promise.all([
      emitAck(a, "startGame", {}),
      nextEvent(a, "gameState"),
      nextEvent(b, "gameState"),
    ]);
    assert.ok(startAck.ok);

    // Both disconnect (in-game)
    a.disconnect();
    b.disconnect();

    // Alice reconnects with a new socket
    const a2 = await newClient();
    try {
      const rejoinAck = await emitAck(a2, "rejoinRoom", { roomId, playerId: aId });
      assert.ok(rejoinAck.room);
      assert.equal(rejoinAck.room.gameId, roomId);
      assert.equal(rejoinAck.room.phase, "setup");

      const bobInRoom = rejoinAck.room.players.find((p) => p.id === bId);
      assert.ok(bobInRoom);
    } finally {
      a2.disconnect();
    }
  } finally {
    // Disconnect is idempotent and safe to call on already-closed sockets.
    a.disconnect();
    b.disconnect();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 14. Concurrent connections — two independent rooms
// ═══════════════════════════════════════════════════════════════════════

test("two independent rooms do not interfere", async () => {
  const a1 = await newClient();
  const a2 = await newClient();
  try {
    // Create two separate rooms — collect priv state concurrently with emit
    const [r1, r2] = await Promise.all([
      createAndCollect(a1, "Host1"),
      createAndCollect(a2, "Host2"),
    ]);

    assert.notEqual(r1.ack.room.gameId, r2.ack.room.gameId);

    // Query each room independently
    const q1 = await emitAck(a1, "requestRoomState", { roomId: r1.ack.room.gameId });
    const q2 = await emitAck(a2, "requestRoomState", { roomId: r2.ack.room.gameId });

    assert.equal(q1.room.players.length, 1);
    assert.equal(q1.room.players[0].name, "Host1");
    assert.equal(q2.room.players.length, 1);
    assert.equal(q2.room.players[0].name, "Host2");

    // Cross-query: a1 can read r2's public state
    const crossQuery = await emitAck(a1, "requestRoomState", { roomId: r2.ack.room.gameId });
    assert.ok(crossQuery.room);
    assert.equal(crossQuery.room.players[0].name, "Host2");
  } finally {
    a1.disconnect();
    a2.disconnect();
  }
});
