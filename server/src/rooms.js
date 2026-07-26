// In-memory room storage for now (Sprint 0 plumbing only).
// Sprint 1 will replace the "players/lobby" skeleton below with the full
// game-state model (board, resources, dev cards, etc.) ported from the
// standalone artifact prototype.

const rooms = new Map();

function newRoomId() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}

function newPlayerId() {
  return Math.random().toString(36).slice(2, 10);
}

export function createRoom(playerName) {
  const id = newRoomId();
  const player = { id: newPlayerId(), name: playerName || "Player" };
  const room = {
    id,
    phase: "lobby",
    players: [player],
    createdAt: Date.now(),
  };
  rooms.set(id, room);
  return { room, player };
}

export function joinRoom(roomId, playerName) {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.phase !== "lobby") return null;
  if (room.players.length >= 6) return null;
  const player = { id: newPlayerId(), name: playerName || "Player" };
  room.players.push(player);
  return { room, player };
}

export function leaveRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.players.length === 0) {
    rooms.delete(roomId);
    return null;
  }
  return room;
}

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}
