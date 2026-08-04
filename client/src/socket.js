import { io } from "socket.io-client";
import { resolveServerUrl } from "./socket-config.js";

export const SERVER_URL = resolveServerUrl({
  configuredUrl: import.meta.env.VITE_SERVER_URL,
  isDev: import.meta.env.DEV,
  origin: typeof window !== "undefined" ? window.location.origin : "",
});

export const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});
