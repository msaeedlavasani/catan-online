// ═══════════════════════════════════════════════════════════════
// Shared game constants — single source of truth for
// RESOURCE_TYPES and BUILD_COST consumed by both client and server.
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
