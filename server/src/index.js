import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { createRoom, joinRoom, leaveRoom, getRoom } from "./rooms.js";

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "catan-server" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // TODO: lock this down to the real client origin before going to production
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on("createRoom", ({ playerName }, callback) => {
    const { room, player } = createRoom(playerName);
    socket.join(room.id);
    socket.data.playerId = player.id;
    socket.data.roomId = room.id;
    callback?.({ room, playerId: player.id });
    console.log(`[room] ${room.id} created by ${playerName}`);
  });

  socket.on("joinRoom", ({ roomId, playerName }, callback) => {
    const result = joinRoom(roomId, playerName);
    if (!result) {
      callback?.({ error: "Room not found or already full/started." });
      return;
    }
    const { room, player } = result;
    socket.join(room.id);
    socket.data.playerId = player.id;
    socket.data.roomId = room.id;
    callback?.({ room, playerId: player.id });
    io.to(room.id).emit("roomState", room);
    console.log(`[room] ${playerName} joined ${room.id}`);
  });

  socket.on("requestRoomState", ({ roomId }, callback) => {
    const room = getRoom(roomId);
    callback?.({ room: room || null });
  });

  socket.on("disconnect", () => {
    const { roomId, playerId } = socket.data;
    if (roomId && playerId) {
      const room = leaveRoom(roomId, playerId);
      if (room) io.to(roomId).emit("roomState", room);
    }
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Catan server listening on http://localhost:${PORT}`);
});
