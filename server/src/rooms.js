import { createLobbyState, newPlayer } from "./game/core.js";

// In-memory room storage. Fine for Sprint 1 (single server process);
// Sprint 3+ will move persistence to the database for reconnect/history.

const rooms = new Map();

function newRoomId() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}

function cryptoId() {
  return Math.random().toString(36).slice(2, 10);
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
