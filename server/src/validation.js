import { RESOURCE_TYPES } from "./game/core.js";

const CARD_TYPES = ["knight", "victory", "roadBuilding", "yearOfPlenty", "monopoly"];
const ID_FIELDS = new Set(["vertexId", "edgeId", "tileId"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(error) {
  return { ok: false, error };
}

function ok(payload) {
  return { ok: true, payload };
}

function requireObject(payload) {
  return isPlainObject(payload) ? null : "Payload must be an object.";
}

function requireNonEmptyString(value, field, maxLength = 128) {
  if (typeof value !== "string" || value.trim().length === 0) return `${field} must be a non-empty string.`;
  if (value.trim().length > maxLength) return `${field} is too long.`;
  return null;
}

function requireId(value, field) {
  if (!Number.isInteger(value) || value < 0) return `${field} must be a non-negative integer.`;
  return null;
}

function validateResource(value, field) {
  return RESOURCE_TYPES.includes(value) ? null : `${field} must be a valid resource.`;
}

function validatePicks(picks, { array = false } = {}) {
  if (array) {
    if (!Array.isArray(picks) || picks.length !== 2) return "picks must contain exactly two resources.";
    for (const resource of picks) {
      const error = validateResource(resource, "picks");
      if (error) return error;
    }
    return null;
  }

  if (!isPlainObject(picks)) return "picks must be an object.";
  for (const [resource, amount] of Object.entries(picks)) {
    if (!RESOURCE_TYPES.includes(resource)) return "picks contains an invalid resource.";
    if (!Number.isInteger(amount) || amount < 0) return "resource picks must be non-negative integers.";
  }
  return null;
}

function validateIds(payload, fields) {
  for (const field of fields) {
    const error = requireId(payload[field], field);
    if (error) return error;
  }
  return null;
}

export function validatePayload(event, payload) {
  const objectError = requireObject(payload ?? {});
  if (objectError) return fail(objectError);
  const data = payload ?? {};
  let error;

  if (["startGame", "rollDice", "buyDevCard", "endTurn", "undoTurnActions"].includes(event)) return ok({});

  if (["createRoom", "joinRoom"].includes(event)) {
    error = requireNonEmptyString(data.playerName, "playerName", 16);
    if (error) return fail(error);
    if (event === "joinRoom") {
      error = requireNonEmptyString(data.roomId, "roomId", 5);
      if (error) return fail(error);
    }
    return ok({ ...data, playerName: data.playerName.trim(), roomId: data.roomId?.trim().toUpperCase() });
  }

  if (event === "rejoinRoom") {
    error = requireNonEmptyString(data.roomId, "roomId", 5) || requireNonEmptyString(data.playerId, "playerId", 128);
    return error ? fail(error) : ok({ ...data, roomId: data.roomId.trim().toUpperCase(), playerId: data.playerId.trim() });
  }

  if (event === "requestRoomState") {
    error = requireNonEmptyString(data.roomId, "roomId", 5);
    return error ? fail(error) : ok({ roomId: data.roomId.trim().toUpperCase() });
  }

  const idFields = {
    placeSetupSettlement: ["vertexId"],
    placeSetupRoad: ["edgeId"],
    moveRobber: ["tileId"],
    buildRoad: ["edgeId"],
    buildSettlement: ["vertexId"],
    buildCity: ["vertexId"],
  }[event];
  if (idFields) {
    error = validateIds(data, idFields);
    return error ? fail(error) : ok(data);
  }

  if (event === "submitDiscard") {
    error = validatePicks(data.picks);
    return error ? fail(error) : ok(data);
  }
  if (event === "stealFrom") {
    error = requireNonEmptyString(data.victimId, "victimId");
    return error ? fail(error) : ok(data);
  }
  if (event === "playDevCard") {
    error = requireNonEmptyString(data.cardId, "cardId") || (CARD_TYPES.includes(data.type) ? null : "type must be a valid development card.");
    return error ? fail(error) : ok(data);
  }
  if (event === "resolveYearOfPlenty") {
    error = validatePicks(data.picks, { array: true });
    return error ? fail(error) : ok(data);
  }
  if (event === "resolveMonopoly") {
    error = validateResource(data.resource, "resource");
    return error ? fail(error) : ok(data);
  }
  if (["bankTrade", "proposeTrade"].includes(event)) {
    error = validateResource(data.give, "give") || validateResource(data.want, "want");
    if (error) return fail(error);
    if (data.give === data.want) return fail("give and want must be different resources.");
    return ok(data);
  }
  if (["acceptTrade", "cancelTrade"].includes(event)) {
    error = requireNonEmptyString(data.offerId, "offerId");
    return error ? fail(error) : ok(data);
  }

  return fail(`Unknown socket event: ${event}.`);
}

export function validateBoardId(board, type, id) {
  const collectionName = { vertex: "vertices", edge: "edges", tile: "tiles" }[type];
  const collection = collectionName ? board?.[collectionName] : null;
  return Number.isInteger(id) && id >= 0 && Array.isArray(collection) && id < collection.length;
}

export function isKnownResource(resource) {
  return RESOURCE_TYPES.includes(resource);
}

export function isKnownCardType(type) {
  return CARD_TYPES.includes(type);
}

export { ID_FIELDS };
