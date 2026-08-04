import crypto from "node:crypto";
import { createLobbyState, newPlayer } from "./game/core.js";

// In-memory room storage. Fine for Sprint 1 (single server process);
// Sprint 3+ will move persistence to the database for reconnect/history.

const rooms = new Map();

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
      rooms.delete(roomId);
      return null;
    }
  }
  return game;
}

export function markReconnected(roomId, playerId) {
  const game = rooms.get(roomId);
  if (!game) return null;
  const player = game.players.find((p) => p.id === playerId);
  if (player) player.connected = true;
  return game;
}

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

// Only for tests: reset the shared in-memory room store between test cases
// so state from one test does not leak into another.
export function _resetRoomsForTest() {
  rooms.clear();
}
