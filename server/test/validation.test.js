import test from "node:test";
import assert from "node:assert/strict";
import { assignBoardContent, buildBoardGeometry, createLobbyState, newPlayer } from "../src/game/core.js";
import * as engine from "../src/game/engine.js";
import { validateBoardId, validatePayload } from "../src/validation.js";

function setupGame() {
  const player = newPlayer("Player", "p1");
  const game = createLobbyState("ROOM1", player);
  game.board = assignBoardContent(buildBoardGeometry());
  game.phase = "setup";
  game.setupOrder = [player.id];
  game.setupSubPhase = "settlement";
  return game;
}

test("rejects missing and malformed socket payloads", () => {
  assert.equal(validatePayload("createRoom", undefined).ok, false);
  assert.equal(validatePayload("joinRoom", { playerName: "A" }).ok, false);
  assert.equal(validatePayload("buildRoad", { edgeId: "0" }).ok, false);
  assert.equal(validatePayload("bankTrade", { give: "wood", want: "wood" }).ok, false);
  assert.equal(validatePayload("resolveYearOfPlenty", { picks: ["wood"] }).ok, false);
});

test("normalizes valid room and resource payloads", () => {
  assert.deepEqual(validatePayload("joinRoom", { roomId: " ab12z ", playerName: " Ali " }), {
    ok: true,
    payload: { roomId: "AB12Z", playerName: "Ali" },
  });
  assert.deepEqual(validatePayload("bankTrade", { give: "wood", want: "ore" }), {
    ok: true,
    payload: { give: "wood", want: "ore" },
  });
});

test("rejects board ids outside the generated board", () => {
  const game = setupGame();
  assert.equal(validateBoardId(game.board, "vertex", 0), true);
  assert.equal(validateBoardId(game.board, "edge", 0), true);
  assert.equal(validateBoardId(game.board, "tile", 0), true);
  assert.equal(validateBoardId(game.board, "vertex", 9999), false);
  assert.equal(validateBoardId(game.board, "edge", -1), false);
  assert.equal(validateBoardId(game.board, "tile", "0"), false);
});

test("returns an error instead of throwing for invalid engine ids and players", () => {
  const game = setupGame();
  assert.deepEqual(engine.placeSetupSettlement(game, "p1", 9999), { ok: false, error: "Invalid vertex." });
  assert.deepEqual(engine.placeSetupRoad(game, "p1", 9999), { ok: false, error: "Invalid edge." });
  assert.deepEqual(engine.rollDice(game, "unknown"), { ok: false, error: "Unknown player." });
});

test("prevents a non-proposer from cancelling a trade", () => {
  const game = setupGame();
  const other = newPlayer("Other", "p2");
  game.players.push(other);
  game.tradeOffers = [{ id: "offer-1", from: "p1", give: "wood", want: "ore", status: "open" }];
  assert.deepEqual(engine.cancelTrade(game, "p2", "offer-1"), {
    ok: false,
    error: "Only the proposer can cancel this offer.",
  });
  assert.equal(game.tradeOffers.length, 1);
});
