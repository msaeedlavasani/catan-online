// Validates and returns the numeric server port.
// Falls back to 4000 when PORT is unset, empty, or invalid.
export function getPort(raw = process.env.PORT) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return 4000;
  }
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    console.warn(`Invalid PORT "${String(raw)}" — using default 4000`);
    return 4000;
  }
  return num;
}

// Room TTL (milliseconds) for in-game rooms where all players have
// disconnected.  Players can reconnect within this window; after it
// expires the room is permanently cleaned up.
// Configured via ROOM_TTL_MS env var; defaults to 5 minutes.
const DEFAULT_ROOM_TTL_MS = 300_000; // 5 min
const MIN_ROOM_TTL_MS = 1_000;       // 1 s floor — shorter is a misconfig
export function getRoomTTL(raw = process.env.ROOM_TTL_MS) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return DEFAULT_ROOM_TTL_MS;
  }
  const num = Number(raw);
  if (!Number.isInteger(num) || num < MIN_ROOM_TTL_MS) {
    console.warn(`Invalid ROOM_TTL_MS "${String(raw)}" — using default ${DEFAULT_ROOM_TTL_MS}`);
    return DEFAULT_ROOM_TTL_MS;
  }
  return num;
}

// ── Storage config ───────────────────────────────────────────────────
// Directory where room/game state files are persisted.  Must be an
// absolute path or relative to the server process CWD.
// Configured via STORAGE_PATH env var; defaults to "data/rooms".
const DEFAULT_STORAGE_PATH = "data/rooms";
const MAX_STORAGE_PATH_LEN = 1024;
export function getStoragePath(raw = process.env.STORAGE_PATH) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return DEFAULT_STORAGE_PATH;
  }
  const val = String(raw).trim();
  if (val.length > MAX_STORAGE_PATH_LEN) {
    console.warn(`STORAGE_PATH too long — using default "${DEFAULT_STORAGE_PATH}"`);
    return DEFAULT_STORAGE_PATH;
  }
  if (val.includes("\0")) {
    console.warn(`STORAGE_PATH contains null byte — using default "${DEFAULT_STORAGE_PATH}"`);
    return DEFAULT_STORAGE_PATH;
  }
  return val;
}

// ── Health / Readiness config ────────────────────────────────────────

// Maximum heap-usage ratio (0–1) the readiness probe tolerates before
// declaring the process NOT_READY.  Heap above this threshold typically
// means the process is under memory pressure and should stop accepting
// new traffic so Kubernetes / the orchestrator can route requests
// elsewhere.
// Configured via READINESS_MEMORY_THRESHOLD env var; defaults to 0.90.
const DEFAULT_READINESS_MEMORY_THRESHOLD = 0.9;
export function getReadinessMemoryThreshold(
  raw = process.env.READINESS_MEMORY_THRESHOLD,
) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return DEFAULT_READINESS_MEMORY_THRESHOLD;
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0 || num > 1) {
    console.warn(
      `Invalid READINESS_MEMORY_THRESHOLD "${String(raw)}" — using default ${DEFAULT_READINESS_MEMORY_THRESHOLD}`,
    );
    return DEFAULT_READINESS_MEMORY_THRESHOLD;
  }
  return num;
}
