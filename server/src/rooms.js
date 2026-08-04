import crypto from "node:crypto";
import { createLobbyState, newPlayer } from "./game/core.js";
import { getRoomTTL } from "./config.js";

// In-memory room storage. Fine for Sprint 1 (single server process);
// Sprint 3+ will move persistence to the database for reconnect/history.

const rooms = new Map();

// ── TTL cleanup timers ──────────────────────────────────────────────
// Each entry is a Node.js Timeout that will delete the room after the
// configured TTL.  Timers are created for in-game rooms where *every*
// player is disconnected; reconnecting any player cancels the timer.

const pendingCleanups = new Map(); // roomId → Timeout

// Test-only: override the effective TTL.  When null (default) the real
// getRoomTTL() is used; set to a number to force a specific value.
let _ttlOverride = null;

export function _setTTLOverride(ms) {
  _ttlOverride = ms;
}

function _effectiveTTL() {
  return _ttlOverride !== null ? _ttlOverride : getRoomTTL();
}

function allDisconnected(game) {
  return game.players.every((p) => !p.connected);
}

export function _scheduleCleanup(roomId) {
  _cancelCleanup(roomId); // idempotent — replace any existing timer
  const ttl = _effectiveTTL();
  const timer = setTimeout(() => {
    rooms.delete(roomId);
    pendingCleanups.delete(roomId);
  }, ttl);
  // A pending cleanup must not keep an otherwise idle server/test process alive.
  // The timer still fires normally while the process has other active work.
  timer.unref?.();
  pendingCleanups.set(roomId, timer);
}

export function _cancelCleanup(roomId) {
  const existing = pendingCleanups.get(roomId);
  if (existing) {
    clearTimeout(existing);
    pendingCleanups.delete(roomId);
  }
}

// ── Room ID / player ID generators ──────────────────────────────────

// 5-character room code: readable (no ambiguous 0/O/I/1), crypto-random,
// regenerates on collision so two rooms never share the same code.
function newRoomId() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(5);
  let s = "";
  for (let i = 0; i < 5; i++) s += letters[bytes[i] % letters.length];
  if (rooms.has(s)) return newRoomId(); // collision — try again
  return s;
}

// Internal player id: crypto-random UUID (unguessable, 128-bit).
function cryptoId() {
  return crypto.randomUUID();
}

// ── Public API ──────────────────────────────────────────────────────

export function createRoom(playerName) {
  const player = newPlayer(playerName || "Player", cryptoId());
  const game = createLobbyState(newRoomId(), player);
  rooms.set(game.gameId, game);
  return { room: game, player };
}

export function joinRoom(roomId, playerName) {
  const game = rooms.get(roomId);
  if (!game) return null;
  if (game.phase !== "lobby") return null;
  if (game.players.length >= 4) return null; // only 4 player colors have matching art
  const player = newPlayer(playerName || "Player", cryptoId());
  game.players.push(player);
  game.log.push(`${player.name} به بازی پیوست.`);
  return { room: game, player };
}

export function markDisconnected(roomId, playerId) {
  const game = rooms.get(roomId);
  if (!game) return null;
  const player = game.players.find((p) => p.id === playerId);
  if (player) player.connected = false;
  if (game.phase === "lobby") {
    game.players = game.players.filter((p) => p.id !== playerId);
    if (game.players.length === 0) {
      _cancelCleanup(roomId);
      rooms.delete(roomId);
      return null;
    }
  } else {
    // In-game: if every player disconnected, start TTL cleanup timer.
    // The room survives for the TTL window so players can reconnect.
    if (allDisconnected(game)) {
      _scheduleCleanup(roomId);
    }
  }
  return game;
}

export function markReconnected(roomId, playerId) {
  const game = rooms.get(roomId);
  if (!game) return null;
  const player = game.players.find((p) => p.id === playerId);
  if (player) {
    player.connected = true;
    _cancelCleanup(roomId); // cancel any pending cleanup timer
  }
  return game;
}

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

// ── Test helpers ────────────────────────────────────────────────────

// Only for tests: reset the shared in-memory room store AND cancel any
// pending cleanup timers so no state or timer leaks between test cases.
export function _resetRoomsForTest() {
  for (const timer of pendingCleanups.values()) clearTimeout(timer);
  pendingCleanups.clear();
  rooms.clear();
  _ttlOverride = null;
}

// Returns the pending-cleanup Map so tests can inspect timer existence.
export function _getPendingCleanups() {
  return pendingCleanups;
}
