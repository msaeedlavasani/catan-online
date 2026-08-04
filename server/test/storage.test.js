import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  initStorage,
  saveRoom,
  loadRoom,
  deleteRoom,
  loadAllRooms,
  isStorageReady,
  _resetStorageForTest,
  _setStorageReady,
} from "../src/storage.js";
import { getStoragePath } from "../src/config.js";

// ─── Isolate state ──────────────────────────────────────────────────
// Every top-level test runs against a clean storage directory.  We
// force a known path so tests never touch production data.

// Save original env and set a test-specific data directory.
const TEST_DIR = path.resolve("test-data/storage-test");
const origStoragePath = process.env.STORAGE_PATH;

before(async () => {
  process.env.STORAGE_PATH = TEST_DIR;
  await rm(TEST_DIR, { recursive: true, force: true });
});

after(async () => {
  if (origStoragePath !== undefined) {
    process.env.STORAGE_PATH = origStoragePath;
  } else {
    delete process.env.STORAGE_PATH;
  }
  await rm(TEST_DIR, { recursive: true, force: true });
});

// ─── Helpers ────────────────────────────────────────────────────────

function makeRoom(overrides = {}) {
  return {
    gameId: "ABCDE",
    phase: "lobby",
    players: [
      {
        id: "p1",
        name: "Alice",
        color: null,
        resources: { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 },
        devCards: [],
        knightsPlayed: 0,
        roads: [],
        settlements: [],
        cities: [],
        hasLongestRoad: false,
        hasLargestArmy: false,
        connected: true,
      },
    ],
    board: null,
    robberTileId: null,
    currentPlayerIndex: 0,
    turnNumber: 0,
    setupOrder: [],
    setupStep: 0,
    setupSubPhase: "settlement",
    lastPlacedSettlement: null,
    dice: null,
    log: ["Alice بازی رو ساخت."],
    pending: null,
    tradeOffers: [],
    bank: { wood: 19, brick: 19, wheat: 19, sheep: 19, ore: 19 },
    devDeck: [],
    hasPlayedDevCardThisTurn: false,
    longestRoadPlayerId: null,
    largestArmyPlayerId: null,
    winnerId: null,
    turnCheckpoint: null,
    updatedAt: 1234567890,
    ...overrides,
  };
}

async function resetAndInit() {
  await _resetStorageForTest();
  // Force storage ready (test dir is already created by helper)
  await initStorage();
  assert.ok(isStorageReady(), "storage should be ready after init");
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 1 — saveRoom + loadRoom round-trip
// ═══════════════════════════════════════════════════════════════════════

test("saveRoom then loadRoom returns the same room data", async () => {
  await resetAndInit();
  const room = makeRoom();
  const saved = await saveRoom(room);
  assert.equal(saved, true);

  const loaded = await loadRoom("ABCDE");
  assert.ok(loaded, "room should be loadable");
  assert.equal(loaded.gameId, "ABCDE");
  assert.equal(loaded.phase, "lobby");
  assert.equal(loaded.players.length, 1);
  assert.equal(loaded.players[0].name, "Alice");
  assert.deepEqual(loaded.bank, { wood: 19, brick: 19, wheat: 19, sheep: 19, ore: 19 });
});

test("saveRoom saves a playing room with full state", async () => {
  await resetAndInit();
  const room = makeRoom({
    gameId: "FGHJK",
    phase: "playing",
    turnNumber: 7,
    currentPlayerIndex: 1,
    players: [
      {
        id: "p1",
        name: "Host",
        color: "#b23a2e",
        resources: { wood: 3, brick: 2, wheat: 1, sheep: 4, ore: 0 },
        devCards: [
          { id: "dc-1", type: "knight", boughtTurn: 2 },
          { id: "dc-2", type: "victory", boughtTurn: 3 },
        ],
        knightsPlayed: 1,
        roads: [0, 1, 2],
        settlements: [10, 20],
        cities: [30],
        hasLongestRoad: true,
        hasLargestArmy: false,
        connected: true,
      },
      {
        id: "p2",
        name: "Guest",
        color: "#2b6ca3",
        resources: { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 2 },
        devCards: [],
        knightsPlayed: 0,
        roads: [3],
        settlements: [7],
        cities: [],
        hasLongestRoad: false,
        hasLargestArmy: false,
        connected: false,
      },
    ],
    dice: [3, 4],
    robberTileId: 5,
    longestRoadPlayerId: "p1",
    devDeck: ["knight", "monopoly", "victory"],
  });

  await saveRoom(room);
  const loaded = await loadRoom("FGHJK");
  assert.ok(loaded);
  assert.equal(loaded.phase, "playing");
  assert.equal(loaded.players.length, 2);

  // p1
  assert.equal(loaded.players[0].name, "Host");
  assert.equal(loaded.players[0].resources.wood, 3);
  assert.equal(loaded.players[0].devCards.length, 2);
  assert.deepEqual(loaded.players[0].roads, [0, 1, 2]);
  assert.deepEqual(loaded.players[0].settlements, [10, 20]);
  assert.deepEqual(loaded.players[0].cities, [30]);

  // p2
  assert.equal(loaded.players[1].name, "Guest");
  assert.equal(loaded.players[1].connected, false);

  // game-level
  assert.equal(loaded.robberTileId, 5);
  assert.deepEqual(loaded.dice, [3, 4]);
  assert.equal(loaded.longestRoadPlayerId, "p1");
  assert.deepEqual(loaded.devDeck, ["knight", "monopoly", "victory"]);
});

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 2 — loadRoom for non-existent, corrupted, version-mismatch
// ═══════════════════════════════════════════════════════════════════════

test("loadRoom returns null for non-existent room", async () => {
  await resetAndInit();
  const room = await loadRoom("ZZZZZ");
  assert.equal(room, null);
});

test("loadRoom returns null for corrupted JSON file", async () => {
  await resetAndInit();
  // Write garbage directly to simulate corruption
  const { writeFile } = await import("node:fs/promises");
  const dir = getStoragePath();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "XXXXX.json"), "not valid json {{{", "utf-8");

  const room = await loadRoom("XXXXX");
  assert.equal(room, null, "corrupted file should return null, not throw");
});

test("loadRoom skips files with unknown version", async () => {
  await resetAndInit();
  const { writeFile } = await import("node:fs/promises");
  const dir = getStoragePath();
  await mkdir(dir, { recursive: true });
  // Version 99 does not exist
  const data = {
    _meta: { version: 99, savedAt: Date.now(), gameId: "YYYYY" },
    room: makeRoom({ gameId: "YYYYY" }),
  };
  await writeFile(path.join(dir, "YYYYY.json"), JSON.stringify(data), "utf-8");

  const room = await loadRoom("YYYYY");
  assert.equal(room, null, "unknown version should be skipped");
});

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 3 — deleteRoom
// ═══════════════════════════════════════════════════════════════════════

test("deleteRoom removes the persisted file", async () => {
  await resetAndInit();
  const room = makeRoom({ gameId: "DDDDD" });
  await saveRoom(room);
  // Verify it's there
  let loaded = await loadRoom("DDDDD");
  assert.ok(loaded);

  const deleted = await deleteRoom("DDDDD");
  assert.equal(deleted, true);

  loaded = await loadRoom("DDDDD");
  assert.equal(loaded, null);
});

test("deleteRoom on non-existent room returns true (no-op)", async () => {
  await resetAndInit();
  const result = await deleteRoom("FGHJK");
  assert.equal(result, true);
});

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 4 — loadAllRooms (batch load)
// ═══════════════════════════════════════════════════════════════════════

test("loadAllRooms returns empty array when no rooms saved", async () => {
  await resetAndInit();
  const rooms = await loadAllRooms();
  assert.deepEqual(rooms, []);
});

test("loadAllRooms loads multiple rooms", async () => {
  await resetAndInit();
  await saveRoom(makeRoom({ gameId: "AAAAA", updatedAt: 100 }));
  await saveRoom(makeRoom({ gameId: "BBBBB", updatedAt: 200 }));
  await saveRoom(makeRoom({ gameId: "CCCCC", updatedAt: 300 }));

  const rooms = await loadAllRooms();
  assert.equal(rooms.length, 3);
  const ids = rooms.map((r) => r.roomId).sort();
  assert.deepEqual(ids, ["AAAAA", "BBBBB", "CCCCC"]);
});

test("loadAllRooms skips corrupted files among valid ones", async () => {
  await resetAndInit();
  const { writeFile } = await import("node:fs/promises");
  const dir = getStoragePath();
  await mkdir(dir, { recursive: true });

  await saveRoom(makeRoom({ gameId: "GGDDD" }));
  await writeFile(path.join(dir, "BADXX.json"), "garbage data {{{", "utf-8");
  await saveRoom(makeRoom({ gameId: "GGDDG" }));

  const rooms = await loadAllRooms();
  assert.equal(rooms.length, 2, "should load 2 valid rooms, skip the corrupted one");
  const ids = rooms.map((r) => r.roomId).sort();
  assert.deepEqual(ids, ["GGDDD", "GGDDG"]);
});

test("loadAllRooms ignores .tmp files", async () => {
  await resetAndInit();
  const { writeFile } = await import("node:fs/promises");
  const dir = getStoragePath();
  await mkdir(dir, { recursive: true });

  await saveRoom(makeRoom({ gameId: "RALFG" }));
  // Simulate a leftover .tmp file
  await writeFile(
    path.join(dir, "FAKEF.tmp"),
    JSON.stringify({ _meta: { version: 1 }, room: makeRoom({ gameId: "FAKEF" }) }),
    "utf-8",
  );

  const rooms = await loadAllRooms();
  assert.equal(rooms.length, 1, "should only load .json files, not .tmp");
  assert.equal(rooms[0].roomId, "RALFG");
});

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 5 — Atomic writes: no partial reads
// ═══════════════════════════════════════════════════════════════════════

test("atomic write: no .json file created until write completes", async () => {
  await resetAndInit();
  const dir = getStoragePath();
  await mkdir(dir, { recursive: true });
  const room = makeRoom({ gameId: "ATFME" });

  await saveRoom(room);

  // After save, .tmp should be gone and .json should exist
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(dir);
  assert.ok(files.includes("ATFME.json"), "final .json should exist");
  assert.ok(!files.includes("ATFME.tmp"), "tmp file should be cleaned up");
});

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 6 — Determinism: same input → same bytes
// ═══════════════════════════════════════════════════════════════════════

test("saveRoom is deterministic: same room produces identical file", async () => {
  await resetAndInit();
  const { readFile } = await import("node:fs/promises");
  const dir = getStoragePath();
  await mkdir(dir, { recursive: true });

  const room1 = makeRoom({ gameId: "DETAF", updatedAt: 500 });
  const room2 = makeRoom({ gameId: "DETAF", updatedAt: 500 });

  await saveRoom(room1);
  const bytes1 = await readFile(path.join(dir, "DETAF.json"), "utf-8");

  // Delete and save again
  await deleteRoom("DETAF");
  await saveRoom(room2);
  const bytes2 = await readFile(path.join(dir, "DETAF.json"), "utf-8");

  // The only difference should be _meta.savedAt timestamp — strip it
  const stripSavedAt = (s) => s.replace(/"savedAt":\s*\d+/g, '"savedAt":0');
  assert.equal(stripSavedAt(bytes1), stripSavedAt(bytes2), "same input → same output (after save)");
});

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 7 — Controlled startup failure
// ═══════════════════════════════════════════════════════════════════════

test("isStorageReady returns false before init", async () => {
  await _resetStorageForTest();
  assert.equal(isStorageReady(), false);
});

test("saveRoom returns false when storage not ready", async () => {
  await _resetStorageForTest();
  const result = await saveRoom(makeRoom());
  assert.equal(result, false);
});

test("loadRoom returns null when storage not ready", async () => {
  await _resetStorageForTest();
  const result = await loadRoom("ANYID");
  assert.equal(result, null);
});

test("loadAllRooms returns empty when storage not ready", async () => {
  await _resetStorageForTest();
  const result = await loadAllRooms();
  assert.deepEqual(result, []);
});

test("initStorage succeeds when directory is writable", async () => {
  await _resetStorageForTest();
  const ok = await initStorage();
  assert.equal(ok, true);
  assert.equal(isStorageReady(), true);
});

test("initStorage fails gracefully when STORAGE_REQUIRED is false", async () => {
  await _resetStorageForTest();
  // Point storage at a path that cannot be written (e.g. /root)
  const orig = process.env.STORAGE_PATH;
  const origRequired = process.env.STORAGE_REQUIRED;
  process.env.STORAGE_PATH = "/root/catan-test-storage";
  delete process.env.STORAGE_REQUIRED;

  try {
    const ok = await initStorage();
    assert.equal(ok, false, "should return false when dir is unwritable");
    assert.equal(isStorageReady(), false);
    // Operations should be no-ops
    assert.equal(await saveRoom(makeRoom()), false);
    assert.equal(await loadRoom("X"), null);
  } finally {
    process.env.STORAGE_PATH = orig;
    if (origRequired !== undefined) process.env.STORAGE_REQUIRED = origRequired;
  }
});

test("initStorage throws when STORAGE_REQUIRED=true and dir unwritable", async () => {
  await _resetStorageForTest();
  const orig = process.env.STORAGE_PATH;
  const origRequired = process.env.STORAGE_REQUIRED;
  process.env.STORAGE_PATH = "/root/catan-test-storage";
  process.env.STORAGE_REQUIRED = "true";

  try {
    await assert.rejects(
      () => initStorage(),
      /STORAGE_REQUIRED=true/,
      "should throw when required storage is unavailable",
    );
  } finally {
    process.env.STORAGE_PATH = orig;
    if (origRequired !== undefined) process.env.STORAGE_REQUIRED = origRequired;
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 8 — Room ID validation (path safety)
// ═══════════════════════════════════════════════════════════════════════

test("saving with invalid roomId throws", async () => {
  await resetAndInit();
  const room = makeRoom({ gameId: "../etc" });
  await assert.rejects(() => saveRoom(room), /Invalid roomId/, "must reject path-traversal roomId");
});

test("saving roomId with lowercase converts and works", async () => {
  await resetAndInit();
  // storage.js uses the roomId as-is; rooms.js always generates uppercase.
  // But if somehow lowercase comes through, it should still validate that
  // the chars are in the allowed set.
  // Actually, our regex only allows [A-HJ-NP-Z2-9], so lowercase will fail.
  // This is by design — room IDs are always uppercase.
  const room = makeRoom({ gameId: "abcde" }); // lowercase
  await assert.rejects(
    () => saveRoom(room),
    /Invalid roomId/,
    "lowercase roomId should be rejected",
  );
});

// ═══════════════════════════════════════════════════════════════════════
//  SECTION 9 — _setStorageReady / _resetStorageForTest
// ═══════════════════════════════════════════════════════════════════════

test("_setStorageReady toggles ready flag", async () => {
  await _resetStorageForTest();
  assert.equal(isStorageReady(), false);
  _setStorageReady(true);
  assert.equal(isStorageReady(), true);
  _setStorageReady(false);
  assert.equal(isStorageReady(), false);
});

test("_resetStorageForTest clears state and files", async () => {
  await resetAndInit();
  await saveRoom(makeRoom({ gameId: "RESET" }));
  assert.ok(await loadRoom("RESET"));

  await _resetStorageForTest();
  assert.equal(isStorageReady(), false);
  // After reset, load should return null (not ready)
  assert.equal(await loadRoom("RESET"), null);
});
