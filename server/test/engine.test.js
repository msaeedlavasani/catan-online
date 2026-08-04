import test from "node:test";
import assert from "node:assert/strict";
import { assignBoardContent, buildBoardGeometry, createLobbyState, newPlayer } from "../src/game/core.js";
import * as engine from "../src/game/engine.js";

// ─── Helpers ───────────────────────────────────────────────────────

function makePlayingGame() {
  const alice = newPlayer("Alice", "p1");
  const bob = newPlayer("Bob", "p2");
  const game = createLobbyState("TEST", alice);
  game.players.push(bob);
  game.board = assignBoardContent(buildBoardGeometry());
  game.phase = "playing";
  game.currentPlayerIndex = 0; // Alice's turn
  game.turnNumber = 3;
  game.dice = [3, 4];
  game.players.forEach((p) => {
    p.resources = { wood: 3, brick: 3, wheat: 3, sheep: 3, ore: 3 };
  });
  return game;
}

/** Returns a tile id that differs from the robber tile. */
function nonRobberTileId(game) {
  const tiles = game.board.tiles;
  for (const t of tiles) {
    if (t.id !== game.robberTileId) return t.id;
  }
  return null;
}

// ─── Year of Plenty ─────────────────────────────────────────────────

test("resolveYearOfPlenty rejects non-owner", () => {
  const game = makePlayingGame();
  game.pending = { type: "yearOfPlenty", playerId: "p1" };

  const result = engine.resolveYearOfPlenty(game, "p2", ["wood", "wood"]);
  assert.equal(result.ok, false);
  assert.equal(result.error, "Not your pending action.");
  // Pending must remain untouched
  assert.ok(game.pending);
  assert.equal(game.pending.type, "yearOfPlenty");
});

test("resolveYearOfPlenty allows owner", () => {
  const game = makePlayingGame();
  game.pending = { type: "yearOfPlenty", playerId: "p1" };

  const result = engine.resolveYearOfPlenty(game, "p1", ["wood", "wood"]);
  assert.equal(result.ok, true);
  assert.equal(game.pending, null);
  // Bank was charged 2 wood
  assert.equal(game.bank.wood, 19 - 2);
  // p1 received 2 wood on top of their 3
  assert.equal(game.players[0].resources.wood, 5);
});

// ─── Monopoly ───────────────────────────────────────────────────────

test("resolveMonopoly rejects non-owner", () => {
  const game = makePlayingGame();
  game.pending = { type: "monopoly", playerId: "p1" };

  const result = engine.resolveMonopoly(game, "p2", "wood");
  assert.equal(result.ok, false);
  assert.equal(result.error, "Not your pending action.");
  // Pending must remain untouched
  assert.ok(game.pending);
  assert.equal(game.pending.type, "monopoly");
});

test("resolveMonopoly allows owner", () => {
  const game = makePlayingGame();
  game.pending = { type: "monopoly", playerId: "p1" };

  const result = engine.resolveMonopoly(game, "p1", "wood");
  assert.equal(result.ok, true);
  assert.equal(game.pending, null);
  // p1 collected p2's 3 wood → should have 6
  assert.equal(game.players[0].resources.wood, 6);
  // p2 should have 0 wood
  assert.equal(game.players[1].resources.wood, 0);
});

// ─── Knight → moveRobber ───────────────────────────────────────────

test("moveRobber rejects non-owner when pending has playerId (knight)", () => {
  const game = makePlayingGame();
  // Switch turn to Bob so the turn check passes for him
  game.currentPlayerIndex = 1; // Bob's turn
  game.pending = { type: "robberMove", playerId: "p1" }; // But Alice owns the pending

  const tid = nonRobberTileId(game);
  const result = engine.moveRobber(game, "p2", tid);
  assert.equal(result.ok, false);
  assert.equal(result.error, "Not your pending action.");
  // Pending must remain untouched
  assert.ok(game.pending);
  assert.equal(game.pending.type, "robberMove");
});

test("moveRobber from dice=7 works without playerId in pending", () => {
  const game = makePlayingGame();
  game.pending = { type: "robberMove" }; // No playerId (dice=7 flow)

  const tid = nonRobberTileId(game);
  const result = engine.moveRobber(game, "p1", tid);
  assert.equal(result.ok, true);
  // Robber moved → pending should be null or robberSteal
  assert.ok(!game.pending || game.pending.type === "robberSteal");
});

// ─── Knight → stealFrom ────────────────────────────────────────────

test("stealFrom rejects non-owner when pending has playerId (knight)", () => {
  const game = makePlayingGame();
  // p1 (Alice) has 15 resources total
  game.pending = { type: "robberSteal", victims: ["p1"], playerId: "p1" };

  const result = engine.stealFrom(game, "p2", "p1");
  assert.equal(result.ok, false);
  assert.equal(result.error, "Not your pending action.");
  // Pending must remain untouched
  assert.ok(game.pending);
  assert.equal(game.pending.type, "robberSteal");
});

test("stealFrom from dice=7 works without playerId in pending", () => {
  const game = makePlayingGame();
  // p1 (Alice) has 15 resources total
  game.pending = { type: "robberSteal", victims: ["p1"] }; // No playerId (dice=7 flow)

  const result = engine.stealFrom(game, "p2", "p1"); // Bob steals from Alice
  assert.equal(result.ok, true);
  assert.equal(game.pending, null);
});

// ─── Road Building ─────────────────────────────────────────────────

test("buildRoad roadBuildingFree rejects non-owner", () => {
  const game = makePlayingGame();
  // Switch turn to Bob
  game.currentPlayerIndex = 1;
  // Give Bob a road and a settlement so connectivity checks pass
  // Use edge 0 and its vertices
  const e = game.board.edges[0];
  game.players[1].roads = [0];
  game.players[1].settlements = [e.v1];
  game.pending = { type: "roadBuildingFree", remaining: 2, playerId: "p1" };

  // edge 1 shares v2 with edge 0? Let me pick an edge that shares a vertex.
  // edge 1: need to check. The edges from the board geometry.
  // Actually let me use a simpler approach: pick a neighbor edge via the vertex
  const v1edges = game.board.vertices[e.v1].edgeIds;
  const neighborEdge = v1edges.find((eid) => eid !== 0 && !game.players[1].roads.includes(eid));
  // If no free neighbor edge, use edge 0's v2
  let targetEdge = neighborEdge;
  if (targetEdge === undefined) {
    const v2edges = game.board.vertices[e.v2].edgeIds;
    targetEdge = v2edges.find((eid) => eid !== 0 && edgeIsFreeForTest(eid, game.players));
  }

  const result = engine.buildRoad(game, "p2", targetEdge);
  assert.equal(result.ok, false);
  assert.equal(result.error, "Not your pending action.");
  // Pending must remain untouched
  assert.ok(game.pending);
  assert.equal(game.pending.type, "roadBuildingFree");
  assert.equal(game.pending.remaining, 2);
});

test("buildRoad roadBuildingFree allows owner", () => {
  const game = makePlayingGame();
  // Give Alice a road and settlement
  const e = game.board.edges[0];
  game.players[0].roads = [0];
  game.players[0].settlements = [e.v1];
  game.pending = { type: "roadBuildingFree", remaining: 2, playerId: "p1" };

  // Find a free neighbor edge
  const v1edges = game.board.vertices[e.v1].edgeIds;
  let targetEdge = v1edges.find((eid) => eid !== 0 && !game.players[0].roads.includes(eid));
  if (targetEdge === undefined) {
    const v2edges = game.board.vertices[e.v2].edgeIds;
    targetEdge = v2edges.find((eid) => eid !== 0 && !game.players[0].roads.includes(eid));
  }

  const result = engine.buildRoad(game, "p1", targetEdge);
  assert.equal(result.ok, true);
  assert.equal(game.pending.remaining, 1);
  assert.ok(game.players[0].roads.includes(targetEdge));
});

// ─── Edge helper (used by road building tests) ──────────────────────

function edgeIsFreeForTest(edgeId, players) {
  return !players.some((p) => p.roads.includes(edgeId));
}
