import express from "express";
import http from "http";
import cors from "cors";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Server } from "socket.io";
import {
  createRoom,
  joinRoom,
  getRoom,
  markDisconnected,
  markReconnected,
  loadRoomsFromDisk,
} from "./rooms.js";
import { publicGameState } from "./game/core.js";
import * as engine from "./game/engine.js";
import { createCorsOptions, getAllowedOrigins } from "./cors.js";
import { validatePayload } from "./validation.js";
import { getPort, getReadinessMemoryThreshold } from "./config.js";
import { initStorage, saveRoom, isStorageReady } from "./storage.js";

const PORT = getPort();
const allowedOrigins = getAllowedOrigins();
const corsOptions = createCorsOptions(allowedOrigins);

if (process.env.NODE_ENV === "production" && !process.env.CLIENT_ORIGIN) {
  throw new Error(
    "CLIENT_ORIGIN must be set in production so browser Socket.io connections are allowed.",
  );
}

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    service: "catan-server",
    uptime: Math.round(process.uptime()),
    pid: process.pid,
  }),
);

// ── Health: Liveness probe ───────────────────────────────────────────
// Always returns 200 as long as the process can serve HTTP.  No
// dependency checks — this tells the orchestrator the process is alive.
app.get("/health/live", (_req, res) =>
  res.status(200).json({
    status: "ok",
    service: "catan-server",
  }),
);

// ── Health: Readiness probe ───────────────────────────────────────────
// Returns 200 when the server is ready to accept traffic (room store is
// accessible and heap usage is below the configured threshold).
// Returns 503 when a dependency is unhealthy so the load-balancer /
// orchestrator can temporarily stop routing requests to this instance.
app.get("/health/ready", (_req, res) => {
  const checks = {};

  // 1. Room-store check — the in-memory Map must be reachable.
  try {
    // getRoom("__health_check__") exercises the rooms Map; a missing key
    // returns null which is still a successful store access.
    getRoom("__health_check__");
    checks["room-store"] = "ok";
  } catch {
    checks["room-store"] = "error";
  }

  // 2. Memory check — heap usage must not exceed the configured threshold.
  const mem = process.memoryUsage();
  const threshold = getReadinessMemoryThreshold();
  const heapRatio = mem.heapUsed / mem.heapTotal;
  checks.memory = heapRatio < threshold ? "ok" : "high";

  const allOk = Object.values(checks).every((v) => v === "ok");
  const status = allOk ? "ok" : "not_ready";

  res.status(allOk ? 200 : 503).json({
    status,
    service: "catan-server",
    checks,
    uptime: Math.round(process.uptime()),
    pid: process.pid,
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

// Sends the redacted board state to everyone in the room, then privately
// gives each connected player their own resources/devCards — so no one can
// see another player's hand, even via the browser network tab.
async function broadcast(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  io.to(roomId).emit("gameState", publicGameState(room));
  const sockets = await io.in(roomId).fetchSockets();
  for (const s of sockets) {
    const player = room.players.find((p) => p.id === s.data.playerId);
    if (player)
      s.emit("myPrivateState", { resources: player.resources, devCards: player.devCards });
  }
}

function sendPrivateState(socket, room, playerId) {
  const player = room.players.find((p) => p.id === playerId);
  if (player)
    socket.emit("myPrivateState", { resources: player.resources, devCards: player.devCards });
}

// Wraps an engine action: runs it, and if it succeeds, broadcasts the new
// state to everyone in the room. Always acks the caller with ok/error.
function handleAction(event, socket, fn) {
  return (payload, callback) => {
    const validation = validatePayload(event, payload);
    if (!validation.ok) return callback?.(validation);
    const { roomId, playerId } = socket.data;
    if (!roomId || !playerId) return callback?.({ ok: false, error: "Not in a room." });
    const game = getRoom(roomId);
    if (!game) return callback?.({ ok: false, error: "Room not found." });
    try {
      const result = fn(game, playerId, validation.payload);
      if (result.ok) {
        broadcast(roomId);
        // Persist after every successful game action so the latest state
        // survives a server restart.
        if (isStorageReady()) saveRoom(game).catch(() => {});
      }
      callback?.(result);
    } catch (error) {
      console.error(`Socket action failed: ${event}`, error);
      callback?.({ ok: false, error: "Invalid game action." });
    }
  };
}

io.on("connection", (socket) => {
  socket.on("createRoom", (payload, callback) => {
    const validation = validatePayload("createRoom", payload);
    if (!validation.ok) return callback?.(validation);
    const { room, player } = createRoom(validation.payload.playerName);
    socket.join(room.gameId);
    socket.data.playerId = player.id;
    socket.data.roomId = room.gameId;
    callback?.({ room: publicGameState(room), playerId: player.id });
    sendPrivateState(socket, room, player.id);
  });

  socket.on("joinRoom", (payload, callback) => {
    const validation = validatePayload("joinRoom", payload);
    if (!validation.ok) return callback?.(validation);
    const { roomId, playerName } = validation.payload;
    const result = joinRoom(roomId, playerName);
    if (!result)
      return callback?.({ ok: false, error: "Room not found, full, or already started." });
    const { room, player } = result;
    socket.join(room.gameId);
    socket.data.playerId = player.id;
    socket.data.roomId = room.gameId;
    callback?.({ room: publicGameState(room), playerId: player.id });
    sendPrivateState(socket, room, player.id);
    broadcast(room.gameId);
  });

  socket.on("rejoinRoom", (payload, callback) => {
    const validation = validatePayload("rejoinRoom", payload);
    if (!validation.ok) return callback?.(validation);
    const { roomId, playerId } = validation.payload;
    const room = markReconnected(roomId, playerId);
    if (!room) return callback?.({ ok: false, error: "Room no longer exists." });
    socket.join(roomId);
    socket.data.playerId = playerId;
    socket.data.roomId = roomId;
    callback?.({ room: publicGameState(room), playerId });
    sendPrivateState(socket, room, playerId);
    broadcast(roomId);
  });

  socket.on("requestRoomState", (payload, callback) => {
    const validation = validatePayload("requestRoomState", payload);
    if (!validation.ok) return callback?.(validation);
    const room = getRoom(validation.payload.roomId);
    callback?.({ room: room ? publicGameState(room) : null });
  });

  // --- Game actions (all validated + executed server-side) ---
  socket.on(
    "startGame",
    handleAction("startGame", socket, (g, pid) => engine.startGame(g, pid)),
  );
  socket.on(
    "placeSetupSettlement",
    handleAction("placeSetupSettlement", socket, (g, pid, { vertexId }) =>
      engine.placeSetupSettlement(g, pid, vertexId),
    ),
  );
  socket.on(
    "placeSetupRoad",
    handleAction("placeSetupRoad", socket, (g, pid, { edgeId }) =>
      engine.placeSetupRoad(g, pid, edgeId),
    ),
  );
  socket.on(
    "rollDice",
    handleAction("rollDice", socket, (g, pid) => engine.rollDice(g, pid)),
  );
  socket.on(
    "submitDiscard",
    handleAction("submitDiscard", socket, (g, pid, { picks }) =>
      engine.submitDiscard(g, pid, picks),
    ),
  );
  socket.on(
    "moveRobber",
    handleAction("moveRobber", socket, (g, pid, { tileId }) => engine.moveRobber(g, pid, tileId)),
  );
  socket.on(
    "stealFrom",
    handleAction("stealFrom", socket, (g, pid, { victimId }) => engine.stealFrom(g, pid, victimId)),
  );
  socket.on(
    "buildRoad",
    handleAction("buildRoad", socket, (g, pid, { edgeId }) => engine.buildRoad(g, pid, edgeId)),
  );
  socket.on(
    "buildSettlement",
    handleAction("buildSettlement", socket, (g, pid, { vertexId }) =>
      engine.buildSettlement(g, pid, vertexId),
    ),
  );
  socket.on(
    "buildCity",
    handleAction("buildCity", socket, (g, pid, { vertexId }) => engine.buildCity(g, pid, vertexId)),
  );
  socket.on(
    "buyDevCard",
    handleAction("buyDevCard", socket, (g, pid) => engine.buyDevCard(g, pid)),
  );
  socket.on(
    "playDevCard",
    handleAction("playDevCard", socket, (g, pid, { cardId, type }) =>
      engine.playDevCard(g, pid, cardId, type),
    ),
  );
  socket.on(
    "resolveYearOfPlenty",
    handleAction("resolveYearOfPlenty", socket, (g, pid, { picks }) =>
      engine.resolveYearOfPlenty(g, pid, picks),
    ),
  );
  socket.on(
    "resolveMonopoly",
    handleAction("resolveMonopoly", socket, (g, pid, { resource }) =>
      engine.resolveMonopoly(g, pid, resource),
    ),
  );
  socket.on(
    "bankTrade",
    handleAction("bankTrade", socket, (g, pid, { give, want }) =>
      engine.bankTrade(g, pid, give, want),
    ),
  );
  socket.on(
    "proposeTrade",
    handleAction("proposeTrade", socket, (g, pid, { give, want }) =>
      engine.proposeTrade(g, pid, give, want),
    ),
  );
  socket.on(
    "acceptTrade",
    handleAction("acceptTrade", socket, (g, pid, { offerId }) =>
      engine.acceptTrade(g, pid, offerId),
    ),
  );
  socket.on(
    "cancelTrade",
    handleAction("cancelTrade", socket, (g, pid, { offerId }) =>
      engine.cancelTrade(g, pid, offerId),
    ),
  );
  socket.on(
    "endTurn",
    handleAction("endTurn", socket, (g, pid) => engine.endTurn(g, pid)),
  );
  socket.on(
    "undoTurnActions",
    handleAction("undoTurnActions", socket, (g, pid) => engine.undoTurnActions(g, pid)),
  );

  socket.on("disconnect", () => {
    const { roomId, playerId } = socket.data;
    if (roomId && playerId) {
      const room = markDisconnected(roomId, playerId);
      if (room) io.to(roomId).emit("gameState", publicGameState(room));
    }
  });
});

// ── Graceful shutdown ────────────────────────────────────────────────
// Closes Socket.io first (so in-flight events drain), then the HTTP
// server.  A 10 s fallback timer prevents hanging forever.
export function gracefulShutdown(server, io, signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully…`);
  let done = false;
  const forceExit = setTimeout(() => {
    if (done) return;
    done = true;
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000);

  io.close(() => {
    console.log("Socket.io connections closed.");
    server.close(() => {
      if (done) return;
      done = true;
      clearTimeout(forceExit);
      console.log("HTTP server closed.");
      process.exit(0);
    });
  });
}

process.on("SIGTERM", () => gracefulShutdown(server, io, "SIGTERM"));
process.on("SIGINT", () => gracefulShutdown(server, io, "SIGINT"));

// Only auto-listen when this file is the direct entry point (`node
// src/index.js` or `nodemon src/index.js`), not when imported by tests.
const argv1 = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isMain = argv1 === fileURLToPath(import.meta.url);

if (isMain) {
  // Initialise storage before accepting connections.  If storage is
  // unavailable and STORAGE_REQUIRED is not set, the server gracefully
  // degrades to memory-only mode.
  initStorage()
    .then(() => loadRoomsFromDisk())
    .then((count) => {
      if (count > 0) console.log(`[startup] Loaded ${count} room(s) from disk`);
      server.listen(PORT, () => {
        console.log(`Catan server listening on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("[startup] Storage init failed:", err.message);
      process.exit(1);
    });
}

export { app, server, io };
