import React, { useEffect, useState } from "react";
import { socket } from "./socket.js";

export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    function onConnect() { setConnected(true); }
    function onDisconnect() { setConnected(false); }
    function onRoomState(updatedRoom) { setRoom(updatedRoom); }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("roomState", onRoomState);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("roomState", onRoomState);
    };
  }, []);

  function createRoom() {
    setError("");
    socket.emit("createRoom", { playerName: name }, (res) => {
      if (res?.error) return setError(res.error);
      setRoom(res.room);
      setMyPlayerId(res.playerId);
    });
  }

  function joinRoom() {
    setError("");
    socket.emit("joinRoom", { roomId: joinCode.toUpperCase(), playerName: name }, (res) => {
      if (res?.error) return setError(res.error);
      setRoom(res.room);
      setMyPlayerId(res.playerId);
    });
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 420, margin: "0 auto" }}>
      <h1>Catan Online — Sprint 0</h1>
      <p>
        وضعیت اتصال به سرور:{" "}
        <b style={{ color: connected ? "green" : "crimson" }}>{connected ? "متصل" : "قطع"}</b>
      </p>

      {!room && (
        <>
          <input
            placeholder="اسم شما"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: 8, padding: 8 }}
          />
          <button onClick={createRoom} disabled={!name || !connected} style={{ width: "100%", marginBottom: 8, padding: 8 }}>
            ساخت روم جدید
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="کد روم"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              style={{ flex: 1, padding: 8 }}
            />
            <button onClick={joinRoom} disabled={!name || !joinCode || !connected} style={{ padding: 8 }}>
              جوین
            </button>
          </div>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
        </>
      )}

      {room && (
        <div>
          <p>کد روم: <b>{room.id}</b></p>
          <p>بازیکنان:</p>
          <ul>
            {room.players.map((p) => (
              <li key={p.id}>{p.name}{p.id === myPlayerId ? " (شما)" : ""}</li>
            ))}
          </ul>
          <p style={{ opacity: 0.6, fontSize: 13 }}>
            این فقط تست پلمبینگ سرور/کلاینته — تخته و منطق کامل بازی در اسپرینت ۱ اضافه می‌شه.
          </p>
        </div>
      )}
    </div>
  );
}
