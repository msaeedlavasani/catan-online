// ═══════════════════════════════════════════════════════════════
// Shared game constants — single source of truth for
// RESOURCE_TYPES, BUILD_COST, MAX_PLAYERS, PLAYER_COLORS and
// COLOR_ASSET_NAME consumed by both client and server.
// ≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡
// DO NOT duplicate these values in client/ or server/ packages.
// When a game rule changes, change it here and run the contract test.
// ═══════════════════════════════════════════════════════════════

export const RESOURCE_TYPES = Object.freeze([
  "wood",
  "brick",
  "wheat",
  "sheep",
  "ore",
]);

export const BUILD_COST = Object.freeze({
  road:       Object.freeze({ brick: 1, wood: 1 }),
  settlement: Object.freeze({ brick: 1, wood: 1, wheat: 1, sheep: 1 }),
  city:       Object.freeze({ wheat: 2, ore: 3 }),
  devCard:    Object.freeze({ wheat: 1, sheep: 1, ore: 1 }),
});

// ── Player capacity and asset/color mapping ─────────────────────────
// Only these 4 colors have matching hand-made piece art on disk
// (blue, green, orange, red).  The capacity MUST stay at 4 unless
// new piece artwork is added to client/public/assets/pieces/.
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;

export const PLAYER_COLORS = Object.freeze([
  "#b23a2e", // red
  "#2b6ca3", // blue
  "#e0952b", // orange
  "#3f7d4a", // green
]);

// Maps each player color hex to its matching piece-art directory name.
// Any color NOT in this map will fall back to the plain vector shapes
// named "default" in the pieces folder.
export const COLOR_ASSET_NAME = Object.freeze({
  "#b23a2e": "red",
  "#2b6ca3": "blue",
  "#e0952b": "orange",
  "#3f7d4a": "green",
});
