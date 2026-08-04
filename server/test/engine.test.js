import test from "node:test";
import assert from "node:assert/strict";
import {
  assignBoardContent,
  buildBoardGeometry,
  createLobbyState,
  newPlayer,
  publicGameState,
  RESOURCE_TYPES,
} from "../src/game/core.js";
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

/**
 * Set up a game with a checkpoint (simulating post-dice-roll) and a
 * connected road + settlement for p1 so build actions can be tested.
 * Mutates game state: rolls dice (may give resources), then captures
 * post-roll state as the baseline. Returns { game, freeEdge, freeVertex,
 * postRoll } where postRoll contains all the baseline values for undo
 * assertions.
 */
function setupGameForUndo() {
  const game = makePlayingGame();
  // Boost resources so 4:1 bank trades work
  game.players.forEach((p) => {
    p.resources = { wood: 5, brick: 5, wheat: 5, sheep: 5, ore: 5 };
  });

  // Give p1 an anchor road and settlement at edge 0
  const e0 = game.board.edges[0];
  game.players[0].roads = [0];
  game.players[0].settlements = [e0.v1];

  // Find a free neighbor edge connected to the anchor
  const v1edges = game.board.vertices[e0.v1].edgeIds;
  let freeEdge = v1edges.find(
    (eid) => eid !== 0 && !game.players.some((p) => p.roads.includes(eid)),
  );
  if (freeEdge === undefined) {
    const v2edges = game.board.vertices[e0.v2].edgeIds;
    freeEdge = v2edges.find((eid) => eid !== 0 && !game.players.some((p) => p.roads.includes(eid)));
  }

  // Roll dice to set a checkpoint. Retry if we get a 7 (which creates a pending
  // and doesn't set the checkpoint).
  for (let attempt = 0; attempt < 15; attempt++) {
    game.dice = null;
    game.pending = null;
    game.turnCheckpoint = null;
    const logBefore = game.log.length;
    engine.rollDice(game, "p1");
    if (!game.pending) break; // success — checkpoint is set
    // Reset side effects from the 7-roll
    game.pending = null;
    game.log = game.log.slice(0, logBefore);
  }
  // If we still have pending after 15 attempts, force-clear it
  if (game.pending) game.pending = null;

  // Capture post-roll baseline (this IS the checkpoint state)
  const postRoll = {
    p1res: resClone(game.players[0].resources),
    p2res: resClone(game.players[1].resources),
    bank: { ...game.bank },
    devDeck: [...game.devDeck],
    robberTileId: game.robberTileId,
    hasPlayedDevCard: game.hasPlayedDevCardThisTurn,
    roads: [...game.players[0].roads],
    settlements: [...game.players[0].settlements],
    cities: [...game.players[0].cities],
    devCards: game.players[0].devCards.map((c) => ({ ...c })),
    knightsPlayed: game.players[0].knightsPlayed,
    hasLongestRoad: game.players[0].hasLongestRoad,
    hasLargestArmy: game.players[0].hasLargestArmy,
    longestRoadPlayerId: game.longestRoadPlayerId,
    largestArmyPlayerId: game.largestArmyPlayerId,
  };

  return { game, freeEdge, postRoll };
}
function resClone(r) {
  return { wood: r.wood, brick: r.brick, wheat: r.wheat, sheep: r.sheep, ore: r.ore };
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

// ═══════════════════════════════════════════════════════════════════
//  Task Batch 2.2 — Undo / Checkpoint Contract Tests
// ═══════════════════════════════════════════════════════════════════

// ─── 1. Double-undo & no-op guard ──────────────────────────────────

test("undo with no checkpoint returns error", () => {
  const game = makePlayingGame();
  game.turnCheckpoint = null;

  const result = engine.undoTurnActions(game, "p1");
  assert.equal(result.ok, false);
  assert.equal(result.error, "Nothing to undo.");
});

test("undo → undo again (no actions in between) is rejected as no-op", () => {
  const { game, postRoll } = setupGameForUndo();

  // Do a bank trade (reversible)
  const tradeRes = engine.bankTrade(game, "p1", "wood", "brick");
  assert.equal(tradeRes.ok, true);

  // First undo — should succeed
  const undo1 = engine.undoTurnActions(game, "p1");
  assert.equal(undo1.ok, true);
  // Resources restored to post-roll baseline
  assert.equal(game.players[0].resources.wood, postRoll.p1res.wood);
  assert.equal(game.players[0].resources.brick, postRoll.p1res.brick);
  // Checkpoint was refreshed to restored state
  assert.ok(game.turnCheckpoint, "checkpoint refreshed after undo");

  // Second undo with no actions → should be rejected
  const undo2 = engine.undoTurnActions(game, "p1");
  assert.equal(undo2.ok, false);
  assert.match(undo2.error, /nothing to undo/i);
});

test("undo → action → undo works (checkpoint refreshes correctly)", () => {
  const { game, postRoll } = setupGameForUndo();

  // First: bank trade wood→brick
  const trade1 = engine.bankTrade(game, "p1", "wood", "brick");
  assert.equal(trade1.ok, true);
  const brickAfter = game.players[0].resources.brick;
  assert.ok(brickAfter > postRoll.p1res.brick, "brick increased after trade");

  // Undo first trade
  const undo1 = engine.undoTurnActions(game, "p1");
  assert.equal(undo1.ok, true);
  assert.equal(game.players[0].resources.brick, postRoll.p1res.brick);

  // Second: bank trade wheat→sheep
  const trade2 = engine.bankTrade(game, "p1", "wheat", "sheep");
  assert.equal(trade2.ok, true);
  assert.ok(game.players[0].resources.wheat < postRoll.p1res.wheat, "wheat decreased");

  // Undo second trade
  const undo2 = engine.undoTurnActions(game, "p1");
  assert.equal(undo2.ok, true);
  assert.equal(game.players[0].resources.wheat, postRoll.p1res.wheat);
});

// ─── 2. Checkpoint invalidation / refresh ──────────────────────────

test("checkpoint is cleared on endTurn", () => {
  const { game } = setupGameForUndo();
  assert.ok(game.turnCheckpoint, "checkpoint exists before endTurn");

  engine.endTurn(game, "p1");
  assert.equal(game.turnCheckpoint, null);
  // Undo should now fail
  const undoRes = engine.undoTurnActions(game, "p2");
  assert.equal(undoRes.ok, false);
  assert.match(undoRes.error, /nothing to undo/i);
});

test("undo is blocked during pending action", () => {
  const { game } = setupGameForUndo();
  game.pending = { type: "robberMove", playerId: "p1" };

  const result = engine.undoTurnActions(game, "p1");
  assert.equal(result.ok, false);
  assert.match(result.error, /pending/i);
});

test("undo rejects non-current player", () => {
  const { game } = setupGameForUndo();

  const result = engine.undoTurnActions(game, "p2");
  assert.equal(result.ok, false);
  assert.equal(result.error, "Not your turn.");
});

test("checkpoint is refreshed after dice roll (non-7)", () => {
  const game = makePlayingGame();
  game.players.forEach((p) => {
    p.resources = { wood: 5, brick: 5, wheat: 5, sheep: 5, ore: 5 };
  });
  game.dice = null;
  game.pending = null;
  game.turnCheckpoint = null;

  let gotCheckpoint = false;
  for (let i = 0; i < 15; i++) {
    game.dice = null;
    game.pending = null;
    game.turnCheckpoint = null;
    engine.rollDice(game, "p1");
    if (!game.pending) {
      assert.ok(game.turnCheckpoint, "checkpoint should be set after non-7 dice roll");
      gotCheckpoint = true;
      break;
    }
  }
  assert.ok(gotCheckpoint, "should have gotten at least one non-7 roll");
});

test("checkpoint is refreshed after dev card effect (yearOfPlenty)", () => {
  const game = makePlayingGame();
  game.players.forEach((p) => {
    p.resources = { wood: 5, brick: 5, wheat: 5, sheep: 5, ore: 5 };
  });
  game.turnCheckpoint = null;
  game.pending = { type: "yearOfPlenty", playerId: "p1" };

  engine.resolveYearOfPlenty(game, "p1", ["wood", "wood"]);
  assert.equal(game.pending, null);
  assert.ok(game.turnCheckpoint, "checkpoint refreshed after yearOfPlenty resolves");
});

test("checkpoint is refreshed after dev card effect (monopoly)", () => {
  const game = makePlayingGame();
  game.players.forEach((p) => {
    p.resources = { wood: 5, brick: 5, wheat: 5, sheep: 5, ore: 5 };
  });
  game.turnCheckpoint = null;
  game.pending = { type: "monopoly", playerId: "p1" };

  engine.resolveMonopoly(game, "p1", "wood");
  assert.equal(game.pending, null);
  assert.ok(game.turnCheckpoint, "checkpoint refreshed after monopoly resolves");
});

test("checkpoint is refreshed after trade acceptance", () => {
  const game = makePlayingGame();
  game.players.forEach((p) => {
    p.resources = { wood: 5, brick: 5, wheat: 5, sheep: 5, ore: 5 };
  });
  game.turnCheckpoint = null;
  engine.proposeTrade(game, "p1", "wood", "brick");
  const offer = game.tradeOffers[0];

  const result = engine.acceptTrade(game, "p2", offer.id);
  assert.equal(result.ok, true);
  assert.ok(game.turnCheckpoint, "checkpoint refreshed after trade acceptance");
});

// ─── 3. Snapshot public/private state consistency ───────────────────

test("undo restores robberTileId", () => {
  const { game, postRoll } = setupGameForUndo();

  // Move robber to a different tile manually
  const tid = nonRobberTileId(game);
  game.robberTileId = tid;

  // Do a reversible action
  engine.bankTrade(game, "p1", "wood", "brick");

  // Undo — should restore robberTileId from checkpoint
  const result = engine.undoTurnActions(game, "p1");
  assert.equal(result.ok, true);
  assert.equal(game.robberTileId, postRoll.robberTileId, "robberTileId restored from checkpoint");
});

test("undo restores hasPlayedDevCardThisTurn", () => {
  const { game, postRoll } = setupGameForUndo();

  // Set flag true (simulating post-dev-card state), then do reversible action
  game.hasPlayedDevCardThisTurn = true;
  engine.bankTrade(game, "p1", "wood", "brick");

  // Undo
  const result = engine.undoTurnActions(game, "p1");
  assert.equal(result.ok, true);
  assert.equal(
    game.hasPlayedDevCardThisTurn,
    postRoll.hasPlayedDevCard,
    "hasPlayedDevCardThisTurn restored from checkpoint",
  );
});

test("after undo, publicGameState resourceCount matches private resources", () => {
  const { game, postRoll } = setupGameForUndo();

  engine.bankTrade(game, "p1", "wood", "brick");
  engine.undoTurnActions(game, "p1");

  const pub = publicGameState(game);
  game.players.forEach((p, i) => {
    const privTotal = RESOURCE_TYPES.reduce((s, k) => s + p.resources[k], 0);
    assert.equal(
      pub.players[i].resourceCount,
      privTotal,
      `player ${i} resourceCount matches private total`,
    );
  });
  // Also check p1 specific: should match postRoll baseline
  const expectedTotal = Object.values(postRoll.p1res).reduce((a, b) => a + b, 0);
  assert.equal(pub.players[0].resourceCount, expectedTotal);
});

test("after undo, publicGameState devCardCount matches private devCards", () => {
  const { game, postRoll } = setupGameForUndo();

  engine.buyDevCard(game, "p1");
  assert.equal(game.players[0].devCards.length, postRoll.devCards.length + 1);
  assert.equal(game.devDeck.length, postRoll.devDeck.length - 1);

  engine.undoTurnActions(game, "p1");
  assert.equal(game.players[0].devCards.length, postRoll.devCards.length);
  assert.equal(game.devDeck.length, postRoll.devDeck.length, "card returned to deck");

  const pub = publicGameState(game);
  assert.equal(pub.players[0].devCardCount, postRoll.devCards.length);
});

test("[contract] undo restores all checkpointed fields correctly (full coverage)", () => {
  // This test bypasses rollDice entirely: we directly inject a known
  // checkpoint snapshot, mutate, and verify undo restores everything.
  const game = makePlayingGame();

  // Build a hand-crafted checkpoint snapshot
  const snap = {
    players: [
      {
        resources: { wood: 7, brick: 0, wheat: 2, sheep: 4, ore: 1 },
        roads: [0, 1, 2],
        settlements: [10, 20],
        cities: [30],
        devCards: [
          { id: "dc-1", type: "knight", boughtTurn: 2 },
          { id: "dc-2", type: "victory", boughtTurn: 3 },
        ],
        knightsPlayed: 2,
        hasLongestRoad: true,
        hasLargestArmy: false,
      },
      {
        resources: { wood: 1, brick: 1, wheat: 1, sheep: 1, ore: 1 },
        roads: [],
        settlements: [],
        cities: [],
        devCards: [],
        knightsPlayed: 0,
        hasLongestRoad: false,
        hasLargestArmy: false,
      },
    ],
    bank: { wood: 10, brick: 12, wheat: 14, sheep: 16, ore: 18 },
    devDeck: ["knight", "victory", "monopoly"],
    longestRoadPlayerId: "p1",
    largestArmyPlayerId: "p2",
    robberTileId: 7,
    hasPlayedDevCardThisTurn: true,
  };

  game.turnCheckpoint = snap;

  // Mutate game state heavily
  game.players[0].resources = { wood: 99, brick: 99, wheat: 99, sheep: 99, ore: 99 };
  game.players[0].devCards = [];
  game.players[0].knightsPlayed = 99;
  game.players[0].hasLongestRoad = false;
  game.players[0].hasLargestArmy = true;
  game.players[0].roads = [99];
  game.players[0].settlements = [99];
  game.players[0].cities = [];
  game.longestRoadPlayerId = "p2";
  game.largestArmyPlayerId = "p1";
  game.bank = { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 };
  game.devDeck = [];
  game.robberTileId = 99;
  game.hasPlayedDevCardThisTurn = false;

  const result = engine.undoTurnActions(game, "p1");
  assert.equal(result.ok, true);

  // Verify every field restored
  assert.deepEqual(game.players[0].resources, { wood: 7, brick: 0, wheat: 2, sheep: 4, ore: 1 });
  assert.equal(game.players[0].devCards.length, 2);
  assert.equal(game.players[0].devCards[0].id, "dc-1");
  assert.equal(game.players[0].devCards[0].type, "knight");
  assert.equal(game.players[0].devCards[1].id, "dc-2");
  assert.equal(game.players[0].devCards[1].type, "victory");
  assert.equal(game.players[0].knightsPlayed, 2);
  assert.equal(game.players[0].hasLongestRoad, true);
  assert.equal(game.players[0].hasLargestArmy, false);
  assert.deepEqual(game.players[0].roads, [0, 1, 2]);
  assert.deepEqual(game.players[0].settlements, [10, 20]);
  assert.deepEqual(game.players[0].cities, [30]);
  assert.equal(game.longestRoadPlayerId, "p1");
  assert.equal(game.largestArmyPlayerId, "p2");
  assert.deepEqual(game.bank, { wood: 10, brick: 12, wheat: 14, sheep: 16, ore: 18 });
  assert.deepEqual(game.devDeck, ["knight", "victory", "monopoly"]);
  assert.equal(game.robberTileId, 7);
  assert.equal(game.hasPlayedDevCardThisTurn, true);

  // Public state consistency after undo
  const pub = publicGameState(game);
  assert.equal(pub.players[0].resourceCount, 14); // 7+0+2+4+1
  assert.equal(pub.players[0].devCardCount, 2);
  assert.equal(pub.players[0].resources, undefined, "resources not exposed in public state");
  assert.equal(pub.players[0].devCards, undefined, "devCards not exposed in public state");
});

// ─── 4. Deterministic combined tests ───────────────────────────────

test("[combined] build road + bank trade → undo reverts both", () => {
  const { game, freeEdge, postRoll } = setupGameForUndo();

  // Action 1: build road (costs 1 wood, 1 brick)
  const roadRes = engine.buildRoad(game, "p1", freeEdge);
  assert.equal(roadRes.ok, true, `buildRoad: ${roadRes.error}`);
  // Action 2: bank trade
  const tradeRes = engine.bankTrade(game, "p1", "wheat", "sheep");
  assert.equal(tradeRes.ok, true);

  // Undo both
  const result = engine.undoTurnActions(game, "p1");
  assert.equal(result.ok, true);

  // Verify both reverted
  assert.deepEqual(game.players[0].roads, postRoll.roads, "roads restored");
  assert.equal(game.players[0].resources.wood, postRoll.p1res.wood, "wood restored");
  assert.equal(game.players[0].resources.brick, postRoll.p1res.brick, "brick restored");
  assert.equal(game.players[0].resources.wheat, postRoll.p1res.wheat, "wheat restored");
});

test("[combined] build road → undo → build different road → undo", () => {
  // After first undo, checkpoint is refreshed; second set of actions should
  // be independently undoable.
  const game = makePlayingGame();
  game.players.forEach((p) => {
    p.resources = { wood: 5, brick: 5, wheat: 5, sheep: 5, ore: 5 };
  });
  const e0 = game.board.edges[0];
  game.players[0].roads = [0];
  game.players[0].settlements = [e0.v1];

  const v1edges = game.board.vertices[e0.v1].edgeIds;
  const edgeA = v1edges.find(
    (eid) => eid !== 0 && !game.players.some((p) => p.roads.includes(eid)),
  );
  const edgeB = v1edges
    .filter((eid) => eid !== 0 && eid !== edgeA && !game.players.some((p) => p.roads.includes(eid)))
    .find(Boolean);

  assert.ok(edgeA !== undefined, "edgeA exists");

  // Set checkpoint
  game.dice = null;
  game.pending = null;
  for (let i = 0; i < 15; i++) {
    game.dice = null;
    game.pending = null;
    engine.rollDice(game, "p1");
    if (!game.pending) break;
    game.pending = null;
  }

  const baseline = resClone(game.players[0].resources);

  // First build
  engine.buildRoad(game, "p1", edgeA);
  assert.ok(game.players[0].roads.includes(edgeA));

  // Undo first build
  engine.undoTurnActions(game, "p1");
  assert.ok(!game.players[0].roads.includes(edgeA));
  assert.equal(game.players[0].resources.wood, baseline.wood);

  // If edgeB exists, build a different road
  if (edgeB !== undefined) {
    engine.buildRoad(game, "p1", edgeB);
    assert.ok(game.players[0].roads.includes(edgeB));

    // Undo second build
    engine.undoTurnActions(game, "p1");
    assert.ok(!game.players[0].roads.includes(edgeB));
  }

  assert.deepEqual(game.players[0].resources, baseline, "resources back to baseline");
});

test("[combined] buy dev card → undo restores card to deck", () => {
  const { game, postRoll } = setupGameForUndo();

  engine.buyDevCard(game, "p1");
  assert.equal(game.players[0].devCards.length, postRoll.devCards.length + 1);
  assert.equal(game.devDeck.length, postRoll.devDeck.length - 1);

  // Verify the bought card is what was on top
  const topCardBefore = postRoll.devDeck[postRoll.devDeck.length - 1];
  assert.equal(game.players[0].devCards[0].type, topCardBefore);

  engine.undoTurnActions(game, "p1");

  // Card returned
  assert.equal(game.players[0].devCards.length, postRoll.devCards.length);
  assert.equal(game.devDeck.length, postRoll.devDeck.length);
  assert.equal(game.devDeck[game.devDeck.length - 1], topCardBefore);
  // Resources restored
  assert.deepEqual(game.players[0].resources, postRoll.p1res);
});

test("[combined] full sequence: 3 reversible actions → undo all", () => {
  const { game, freeEdge, postRoll } = setupGameForUndo();

  // Action 1: bank trade
  engine.bankTrade(game, "p1", "sheep", "wood");
  // Action 2: build road
  engine.buildRoad(game, "p1", freeEdge);
  // Action 3: buy dev card
  engine.buyDevCard(game, "p1");

  // Verify state changed
  assert.equal(game.players[0].devCards.length, postRoll.devCards.length + 1, "dev card bought");
  assert.equal(game.players[0].roads.length, postRoll.roads.length + 1, "road built");

  // Undo everything
  const result = engine.undoTurnActions(game, "p1");
  assert.equal(result.ok, true);

  // All reverted
  assert.deepEqual(game.players[0].resources, postRoll.p1res, "all resources restored");
  assert.deepEqual(game.players[0].roads, postRoll.roads, "roads restored");
  assert.equal(game.players[0].devCards.length, postRoll.devCards.length, "dev cards restored");
  assert.deepEqual(game.bank, postRoll.bank, "bank fully restored");
  assert.equal(game.devDeck.length, postRoll.devDeck.length, "dev deck restored");
});
