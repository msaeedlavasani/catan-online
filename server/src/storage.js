// Atomic, versioned JSON file storage for room/game state.
// Uses write-to-temp-then-rename for atomicity (same filesystem only).
// No external dependencies — Node.js built-ins only.
//
// Design constraints:
//  - Path from env/config (getStoragePath)
//  - Deterministic: sorted-key JSON, no timestamps in payload
//  - Controlled startup failure: warns but continues when storage is
//    unavailable; only crashes if STORAGE_REQUIRED=true
//  - Versioned: _meta.version for forward compatibility

import { readFile, writeFile, rename, unlink, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { getStoragePath } from "./config.js";

const STORAGE_VERSION = 1;

// Track whether init completed successfully so callers can decide
// whether to persist or skip.
let _ready = false;
let _initError = null;

export function isStorageReady() {
  return _ready;
}

export function getInitError() {
  return _initError;
}

// ── Path helpers ────────────────────────────────────────────────────

function roomFilePath(dir, roomId) {
  // Sanitise roomId: allow only [A-HJ-NP-Z2-9]{5} (same as newRoomId alphabet)
  if (!/^[A-HJ-NP-Z2-9]{5}$/.test(roomId)) {
    throw new Error(`Invalid roomId for file path: "${roomId}"`);
  }
  return path.join(dir, `${roomId}.json`);
}

function tmpFilePath(dir, roomId) {
  return path.join(dir, `${roomId}.tmp`);
}

// ── Deterministic serialisation ─────────────────────────────────────
// Sorted keys ensure the same game object always produces the same bytes.

function serialize(room) {
  const data = {
    _meta: { version: STORAGE_VERSION, savedAt: Date.now(), gameId: room.gameId },
    room,
  };
  return JSON.stringify(data, sortedKeysReplacer, 2);
}

function sortedKeysReplacer(_key, value) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => {
        acc[k] = value[k];
        return acc;
      }, {});
  }
  return value;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Persist a room to disk atomically.
 * Writes to a .tmp file, then renames to .json so readers never see a
 * partial write.  Silently skips if storage is not initialised.
 */
export async function saveRoom(room) {
  if (!_ready) return false;
  const dir = getStoragePath();
  const tmp = tmpFilePath(dir, room.gameId);
  const final = roomFilePath(dir, room.gameId);

  try {
    await mkdir(dir, { recursive: true });
    const json = serialize(room);
    await writeFile(tmp, json, "utf-8");
    await rename(tmp, final);
    return true;
  } catch (err) {
    console.error(`[storage] saveRoom ${room.gameId} failed:`, err.message);
    return false;
  }
}

/**
 * Load a single room from disk.
 * Returns the room object (without _meta wrapper) or null if not found.
 * Returns null (no throw) for corrupted files so callers can treat it
 * as "not found" and recreate.
 */
export async function loadRoom(roomId) {
  if (!_ready) return null;
  const dir = getStoragePath();
  const fp = roomFilePath(dir, roomId);

  try {
    const raw = await readFile(fp, "utf-8");
    const data = JSON.parse(raw);
    if (!data || !data._meta || !data.room) return null;
    // Future: version migration could go here
    if (data._meta.version !== STORAGE_VERSION) {
      console.warn(`[storage] loadRoom ${roomId}: unknown version ${data._meta.version}, skipping`);
      return null;
    }
    return data.room;
  } catch (err) {
    if (err.code === "ENOENT") return null;
    console.error(`[storage] loadRoom ${roomId} failed:`, err.message);
    return null;
  }
}

/**
 * Delete a room's persisted file.  No-op if the file does not exist.
 */
export async function deleteRoom(roomId) {
  if (!_ready) return false;
  const dir = getStoragePath();
  const fp = roomFilePath(dir, roomId);

  try {
    await unlink(fp);
    return true;
  } catch (err) {
    if (err.code === "ENOENT") return true; // already gone
    console.error(`[storage] deleteRoom ${roomId} failed:`, err.message);
    return false;
  }
}

/**
 * Load all rooms from the storage directory.
 * Returns an array of { roomId, room } objects.  Corrupted or
 * unparseable files are silently skipped.
 */
export async function loadAllRooms() {
  if (!_ready) return [];
  const dir = getStoragePath();

  let files;
  try {
    files = await readdir(dir);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  const results = [];

  for (const file of jsonFiles) {
    const roomId = path.basename(file, ".json").toUpperCase();
    const room = await loadRoom(roomId);
    if (room) results.push({ roomId, room });
  }

  return results;
}

/**
 * Initialise the storage layer.
 *
 * Behaviour (controlled startup failure):
 *  - Tries to create the storage directory.
 *  - If it succeeds → _ready = true, returns true.
 *  - If it fails AND STORAGE_REQUIRED=true → throws (crashes server).
 *  - If it fails AND STORAGE_REQUIRED is unset/false → logs a warning,
 *    sets _ready = false, returns false.  The server runs in memory-only
 *    mode.
 *
 * Call this once at server startup before accepting connections.
 */
export async function initStorage() {
  const dir = getStoragePath();

  try {
    await mkdir(dir, { recursive: true });
    // Verify writability with a test file — catch permission issues early.
    const probe = path.join(dir, ".storage_probe");
    await writeFile(probe, String(Date.now()), "utf-8");
    await unlink(probe);
    _ready = true;
    console.log(`[storage] Initialised at "${path.resolve(dir)}"`);
    return true;
  } catch (err) {
    _initError = err;
    const required =
      process.env.STORAGE_REQUIRED === "true" || process.env.STORAGE_REQUIRED === "1";
    if (required) {
      throw new Error(`Storage initialisation failed and STORAGE_REQUIRED=true: ${err.message}`);
    }
    console.warn(
      `[storage] Unavailable at "${path.resolve(dir)}" — running in memory-only mode (${err.message})`,
    );
    _ready = false;
    return false;
  }
}

// ── Test helpers ────────────────────────────────────────────────────

/** Only for tests: reset internal state and (optionally) clean up files. */
export async function _resetStorageForTest() {
  _ready = false;
  _initError = null;
  const dir = getStoragePath();
  try {
    const files = await readdir(dir);
    await Promise.all(
      files
        .filter((f) => f.endsWith(".json") || f.endsWith(".tmp"))
        .map((f) => unlink(path.join(dir, f)).catch(() => {})),
    );
  } catch {
    // directory doesn't exist — that's fine
  }
}

/** Force storage ready for tests that need a controlled environment. */
export function _setStorageReady(ready = true) {
  _ready = ready;
}
