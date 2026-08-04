// ═══════════════════════════════════════════════════════════════════════
// Shared Socket.io event / state contracts — single source of truth for
// event names, payload shapes, game phases, pending types and
// public/private state boundaries consumed by both client and server.
// ≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡
// DO NOT duplicate these values in client/ or server/ packages.
// When a protocol change is made, update this file and run the contract
// test to verify consistency across both packages.
// ═══════════════════════════════════════════════════════════════════════

// ── Socket.io Event Names: Client → Server ──────────────────────────

export const EVENT = Object.freeze({
  // Room lifecycle
  CREATE_ROOM: "createRoom",
  JOIN_ROOM: "joinRoom",
  REJOIN_ROOM: "rejoinRoom",
  REQUEST_ROOM_STATE: "requestRoomState",

  // Game control
  START_GAME: "startGame",

  // Setup phase
  PLACE_SETUP_SETTLEMENT: "placeSetupSettlement",
  PLACE_SETUP_ROAD: "placeSetupRoad",

  // Turn actions
  ROLL_DICE: "rollDice",
  SUBMIT_DISCARD: "submitDiscard",
  MOVE_ROBBER: "moveRobber",
  STEAL_FROM: "stealFrom",

  // Building
  BUILD_ROAD: "buildRoad",
  BUILD_SETTLEMENT: "buildSettlement",
  BUILD_CITY: "buildCity",

  // Development cards
  BUY_DEV_CARD: "buyDevCard",
  PLAY_DEV_CARD: "playDevCard",
  RESOLVE_YEAR_OF_PLENTY: "resolveYearOfPlenty",
  RESOLVE_MONOPOLY: "resolveMonopoly",

  // Trading
  BANK_TRADE: "bankTrade",
  PROPOSE_TRADE: "proposeTrade",
  ACCEPT_TRADE: "acceptTrade",
  CANCEL_TRADE: "cancelTrade",

  // Turn control
  END_TURN: "endTurn",
  UNDO_TURN_ACTIONS: "undoTurnActions",
});

// ── Socket.io Event Names: Server → Client (broadcast / private) ────

export const BROADCAST = Object.freeze({
  GAME_STATE: "gameState",
  MY_PRIVATE_STATE: "myPrivateState",
});

// ── Development card types ───────────────────────────────────────────

export const CARD_TYPES = Object.freeze([
  "knight",
  "victory",
  "roadBuilding",
  "yearOfPlenty",
  "monopoly",
]);

// ── Game phases ──────────────────────────────────────────────────────

export const PHASES = Object.freeze({
  LOBBY: "lobby",
  SETUP: "setup",
  PLAYING: "playing",
  ENDED: "ended",
});

// ── Pending action types ─────────────────────────────────────────────

export const PENDING_TYPES = Object.freeze({
  DISCARD: "discard",
  ROBBER_MOVE: "robberMove",
  ROBBER_STEAL: "robberSteal",
  ROAD_BUILDING_FREE: "roadBuildingFree",
  YEAR_OF_PLENTY: "yearOfPlenty",
  MONOPOLY: "monopoly",
});

// ── Ack response shape (all client→server events) ────────────────────
// Every event handler calls back with one of:
//   { ok: true }                              — success
//   { ok: true, room, playerId }              — create/join/rejoin
//   { ok: true, room }                        — requestRoomState
//   { ok: false, error: "<message>" }          — validation / engine error

export const ACK_SHAPE = Object.freeze({
  ok: "boolean",
  error: "string (only when ok === false)",
  room: "object (present on create/join/rejoin/requestRoomState success)",
  playerId: "string (present on create/join/rejoin success)",
});

// ── Event payload shape contracts ────────────────────────────────────
// Maps each Client→Server event to the fields that its payload MUST
// contain (as validated by server/src/validation.js).  Values are
// the expected JavaScript type for each field.
//
// Events with an empty object accept no payload fields
// (the handler ignores the payload body entirely).

export const EVENT_PAYLOAD = Object.freeze({
  createRoom:           Object.freeze({ playerName: "string" }),
  joinRoom:             Object.freeze({ playerName: "string", roomId: "string" }),
  rejoinRoom:           Object.freeze({ roomId: "string", playerId: "string" }),
  requestRoomState:     Object.freeze({ roomId: "string" }),
  startGame:            Object.freeze({}),
  placeSetupSettlement: Object.freeze({ vertexId: "number" }),
  placeSetupRoad:       Object.freeze({ edgeId: "number" }),
  rollDice:             Object.freeze({}),
  submitDiscard:        Object.freeze({ picks: "object" }),
  moveRobber:           Object.freeze({ tileId: "number" }),
  stealFrom:            Object.freeze({ victimId: "string" }),
  buildRoad:            Object.freeze({ edgeId: "number" }),
  buildSettlement:      Object.freeze({ vertexId: "number" }),
  buildCity:            Object.freeze({ vertexId: "number" }),
  buyDevCard:           Object.freeze({}),
  playDevCard:          Object.freeze({ cardId: "string", type: "string" }),
  resolveYearOfPlenty:  Object.freeze({ picks: "array" }),
  resolveMonopoly:      Object.freeze({ resource: "string" }),
  bankTrade:            Object.freeze({ give: "string", want: "string" }),
  proposeTrade:         Object.freeze({ give: "string", want: "string" }),
  acceptTrade:          Object.freeze({ offerId: "string" }),
  cancelTrade:          Object.freeze({ offerId: "string" }),
  endTurn:              Object.freeze({}),
  undoTurnActions:      Object.freeze({}),
});

// Events whose handler ignores the payload body entirely.
// Must be a subset of the EVENT_PAYLOAD keys whose value is {}.
export const EVENTS_WITHOUT_PAYLOAD = Object.freeze([
  "startGame",
  "rollDice",
  "buyDevCard",
  "endTurn",
  "undoTurnActions",
]);

// ── Public / private state shape contracts ───────────────────────────
// Document the fields that appear in the two state broadcasts so both
// client and server agree on the boundary without inspecting each
// other's internals.

// Fields that appear for every player in the public gameState broadcast.
// (resourceCount and devCardCount are derived aggregates — the raw
//  resources and devCards arrays are never included.)
export const PLAYER_PUBLIC_FIELDS = Object.freeze([
  "id",
  "name",
  "color",
  "knightsPlayed",
  "roads",
  "settlements",
  "cities",
  "hasLongestRoad",
  "hasLargestArmy",
  "connected",
  "resourceCount",
  "devCardCount",
]);

// Fields only sent to the owning player via the myPrivateState event.
export const PLAYER_PRIVATE_FIELDS = Object.freeze([
  "resources",
  "devCards",
]);

// Top-level fields on the game state object (publicGameState return shape).
// board is null while phase === "lobby".
export const GAME_STATE_FIELDS = Object.freeze([
  "gameId",
  "phase",
  "players",           // array of redacted player objects (PUBLIC)
  "board",             // null until startGame
  "robberTileId",
  "currentPlayerIndex",
  "turnNumber",
  "setupOrder",
  "setupStep",
  "setupSubPhase",
  "lastPlacedSettlement",
  "dice",              // null until first roll
  "log",
  "pending",           // null when no pending action
  "tradeOffers",
  "bank",
  "devDeck",           // full deck (face-down — no client sees order)
  "hasPlayedDevCardThisTurn",
  "longestRoadPlayerId",
  "largestArmyPlayerId",
  "winnerId",          // null until game ends
  "turnCheckpoint",    // internal — server-only, stripped before wire
  "updatedAt",
  "winScore",          // optional override (default 10)
]);

// ── Helper: all event-name values as a flat array ────────────────────

export const ALL_EVENT_NAMES = Object.freeze(Object.values(EVENT));
export const ALL_BROADCAST_NAMES = Object.freeze(Object.values(BROADCAST));

// ── Helper: set of valid phases for quick membership checks ──────────

export const PHASE_SET = Object.freeze(new Set(Object.values(PHASES)));
