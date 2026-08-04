export function resolveServerUrl({ configuredUrl, isDev, origin }) {
  const configured = configuredUrl?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (isDev) return "http://localhost:4000";
  if (origin) return origin.replace(/\/+$/, "");
  throw new Error("VITE_SERVER_URL is required when no browser origin is available.");
}
