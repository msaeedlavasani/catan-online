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
