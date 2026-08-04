import test from "node:test";
import assert from "node:assert/strict";
import {
  // geometry
  axialHexes,
  hexToPixel,
  cornerPixel,
  keyOf,
  buildBoardGeometry,
  // resources & cost
  RES_LABEL,
  PLAYER_COLORS,
  BUILD_COST,
  RESOURCE_TYPES,
  emptyResources,
  totalResources,
  canAfford,
  payCost,
  addResources,
  // game logic
  newGameId,
  newId,
  devDeck,
  DEV_LABEL,
  distanceRuleOk,
  vertexIsFree,
  edgeIsFree,
  playerOwnsEdgeVertexOrRoad,
  vertexConnectsToPlayerRoad,
  longestRoadLength,
  publicScore,
  totalScore,
  // state
  publicGameState,
  createLobbyState,
  newPlayer,
} from "../src/game/core.js";

// ═══════════════════════════════════════════════════════════════════
//  SECTION 1 — GEOMETRY (fully deterministic)
// ═══════════════════════════════════════════════════════════════════

test("axialHexes radius=0 returns origin only", () => {
  const hexes = axialHexes(0);
  assert.equal(hexes.length, 1);
  // axialHexes(0) → q = -0, r = -0  (from loop: let q = -radius)
  // -0 === 0 is true in JS but Object.is(-0,0) is false, so use == below
  assert.ok(hexes[0].q === 0);
  assert.ok(hexes[0].r === 0);
});

test("axialHexes radius=1 returns 7 hexes (center + 6 neighbours)", () => {
  const hexes = axialHexes(1);
  assert.equal(hexes.length, 7);
  // verify every hex has |s| <= 1
  for (const h of hexes) {
    const s = -h.q - h.r;
    assert.ok(Math.abs(s) <= 1);
  }
});

test("axialHexes radius=2 returns 19 hexes (standard Catan board)", () => {
  const hexes = axialHexes(2);
  assert.equal(hexes.length, 19);
  for (const h of hexes) {
    const s = -h.q - h.r;
    assert.ok(Math.abs(s) <= 2);
  }
});

test("hexToPixel produces consistent coordinates", () => {
  const p = hexToPixel(0, 0, 52);
  assert.ok(Math.abs(p.x) < 0.001);
  assert.ok(Math.abs(p.y) < 0.001);

  const p2 = hexToPixel(1, 0, 52);
  assert.ok(p2.x > 50);
  assert.ok(Math.abs(p2.y) < 0.001);
});

test("hexToPixel with non-zero r shifts y", () => {
  const p = hexToPixel(0, 1, 52);
  assert.equal(p.x, 26 * Math.sqrt(3)); // q=0, r=1 → x = 52*√3*1/2 = 26√3
  assert.equal(p.y, 52 * 1.5); // y = 52*1.5*1 = 78
});

test("cornerPixel at i=0 (top-right corner) matches known angle", () => {
  const { x, y } = cornerPixel(0, 0, 52, 0);
  // rad = -30°, cos(-30)=√3/2, sin(-30)=-1/2
  assert.equal(x, 52 * Math.cos(-Math.PI / 6));
  assert.equal(y, 52 * Math.sin(-Math.PI / 6));
});

test("cornerPixel at i=3 (bottom-left) is opposite of i=0", () => {
  const c0 = cornerPixel(0, 0, 52, 0);
  const c3 = cornerPixel(0, 0, 52, 3);
  assert.ok(Math.abs(c0.x + c3.x) < 0.0001);
  assert.ok(Math.abs(c0.y + c3.y) < 0.0001);
});

test("keyOf rounds and formats", () => {
  assert.equal(keyOf(1.23456, 7.89123), "123_789");
  assert.equal(keyOf(-1.004, 0.004), "-100_0");
  assert.equal(keyOf(0, 0), "0_0");
});

test("buildBoardGeometry produces 19 tiles, correct counts", () => {
  const geo = buildBoardGeometry();
  assert.equal(geo.tiles.length, 19);
  // Each tile has exactly 6 corner vertices and 6 edges
  for (const t of geo.tiles) {
    assert.equal(t.vertexIds.length, 6);
    assert.equal(t.edgeIds.length, 6);
  }
});

test("buildBoardGeometry vertex count is stable", () => {
  // A radius-2 hex board has exactly 54 unique vertices
  const geo = buildBoardGeometry();
  assert.equal(geo.vertices.length, 54);
});

test("buildBoardGeometry edge count is stable", () => {
  // A radius-2 hex board has exactly 72 unique edges
  const geo = buildBoardGeometry();
  assert.equal(geo.edges.length, 72);
});

test("buildBoardGeometry every vertex has at least 1 hex", () => {
  const geo = buildBoardGeometry();
  for (const v of geo.vertices) {
    assert.ok(v.hexIds.length >= 1);
  }
});

test("buildBoardGeometry every edge belongs to 1 or 2 tiles", () => {
  const geo = buildBoardGeometry();
  // boundary edges = exactly 1 tile, interior = 2 tiles
  const boundary = geo.edges.filter((e) => e.hexIds.length === 1);
  const interior = geo.edges.filter((e) => e.hexIds.length === 2);
  assert.equal(boundary.length + interior.length, 72);
  // boundary edges form the perimeter
  assert.ok(boundary.length > 0);
});

test("buildBoardGeometry orderedBoundary contains boundary edges only", () => {
  const geo = buildBoardGeometry();
  const boundaryIds = new Set(geo.edges.filter((e) => e.hexIds.length === 1).map((e) => e.id));
  // orderedBoundary should contain exactly the boundary edges
  assert.equal(geo.orderedBoundary.length, boundaryIds.size);
  for (const e of geo.orderedBoundary) {
    assert.ok(boundaryIds.has(e.id));
  }
});

test("buildBoardGeometry size parameter scales coordinates", () => {
  const small = buildBoardGeometry(26);
  const big = buildBoardGeometry(52);
  // Positions should be twice as large for the bigger board
  const sc = small.tiles[0];
  const bc = big.tiles[0];
  assert.ok(Math.abs(bc.x - 2 * sc.x) < 0.01);
  assert.ok(Math.abs(bc.y - 2 * sc.y) < 0.01);
});

test("buildBoardGeometry vertex adjacency is symmetric", () => {
  const geo = buildBoardGeometry();
  for (const v of geo.vertices) {
    for (const nb of v.neighborVertexIds) {
      assert.ok(geo.vertices[nb].neighborVertexIds.includes(v.id));
    }
  }
});

test("buildBoardGeometry edge references are consistent", () => {
  const geo = buildBoardGeometry();
  for (const e of geo.edges) {
    // Both vertices should reference this edge
    assert.ok(geo.vertices[e.v1].edgeIds.includes(e.id));
    assert.ok(geo.vertices[e.v2].edgeIds.includes(e.id));
    // v1 and v2 should list each other as neighbours
    assert.ok(geo.vertices[e.v1].neighborVertexIds.includes(e.v2));
    assert.ok(geo.vertices[e.v2].neighborVertexIds.includes(e.v1));
  }
});

// ═══════════════════════════════════════════════════════════════════
//  SECTION 2 — RESOURCES & COST (fully deterministic)
// ═══════════════════════════════════════════════════════════════════

test("BUILD_COST has expected costs", () => {
  assert.deepEqual(BUILD_COST.road, { brick: 1, wood: 1 });
  assert.deepEqual(BUILD_COST.settlement, { brick: 1, wood: 1, wheat: 1, sheep: 1 });
  assert.deepEqual(BUILD_COST.city, { wheat: 2, ore: 3 });
  assert.deepEqual(BUILD_COST.devCard, { wheat: 1, sheep: 1, ore: 1 });
});

test("RESOURCE_TYPES is the canonical five", () => {
  assert.deepEqual(RESOURCE_TYPES, ["wood", "brick", "wheat", "sheep", "ore"]);
  assert.equal(RESOURCE_TYPES.length, 5);
});

test("RES_LABEL has Farsi labels for all resources including desert", () => {
  assert.ok(RES_LABEL.wood);
  assert.ok(RES_LABEL.brick);
  assert.ok(RES_LABEL.wheat);
  assert.ok(RES_LABEL.sheep);
  assert.ok(RES_LABEL.ore);
  assert.ok(RES_LABEL.desert);
});

test("PLAYER_COLORS has exactly 4 entries", () => {
  assert.equal(PLAYER_COLORS.length, 4);
});

test("emptyResources returns zero for all types", () => {
  const r = emptyResources();
  assert.equal(r.wood, 0);
  assert.equal(r.brick, 0);
  assert.equal(r.wheat, 0);
  assert.equal(r.sheep, 0);
  assert.equal(r.ore, 0);
  // no extra keys
  assert.deepEqual(Object.keys(r).sort(), RESOURCE_TYPES.slice().sort());
});

test("totalResources sums all five types", () => {
  const r = { wood: 3, brick: 0, wheat: 5, sheep: 1, ore: 2 };
  assert.equal(totalResources(r), 11);
});

test("totalResources on empty is 0", () => {
  assert.equal(totalResources(emptyResources()), 0);
});

test("canAfford returns true when resources >= cost", () => {
  const res = { wood: 2, brick: 1, wheat: 5, sheep: 3, ore: 4 };
  assert.equal(canAfford(res, BUILD_COST.road), true); // 1 wood, 1 brick
  assert.equal(canAfford(res, BUILD_COST.settlement), true); // 1 each of 4
  assert.equal(canAfford(res, BUILD_COST.city), true); // 2 wheat, 3 ore
  assert.equal(canAfford(res, BUILD_COST.devCard), true); // 1 wheat, 1 sheep, 1 ore
});

test("canAfford returns false when short", () => {
  const res = { wood: 0, brick: 5, wheat: 0, sheep: 0, ore: 0 };
  assert.equal(canAfford(res, BUILD_COST.road), false); // needs wood
  assert.equal(canAfford(res, BUILD_COST.settlement), false); // needs 4 types
  assert.equal(canAfford(res, BUILD_COST.city), false); // needs wheat & ore
});

test("canAfford returns false for exact shortage by 1", () => {
  const res = { wood: 1, brick: 0, wheat: 1, sheep: 1, ore: 1 };
  assert.equal(canAfford(res, BUILD_COST.settlement), false); // missing brick
});

test("payCost subtracts correctly and keeps other fields", () => {
  const res = { wood: 5, brick: 5, wheat: 5, sheep: 5, ore: 5 };
  const after = payCost(res, BUILD_COST.city); // 2 wheat, 3 ore
  assert.deepEqual(after, { wood: 5, brick: 5, wheat: 3, sheep: 5, ore: 2 });
  // original is not mutated
  assert.equal(res.wheat, 5);
});

test("addResources increment correctly and creates missing keys", () => {
  const res = { wood: 2, brick: 0 };
  const after = addResources(res, { wood: 1, wheat: 3 });
  assert.equal(after.wood, 3);
  assert.equal(after.brick, 0);
  assert.equal(after.wheat, 3);
  // original is not mutated
  assert.equal(res.wood, 2);
  assert.equal(res.wheat, undefined);
});

// ═══════════════════════════════════════════════════════════════════
//  SECTION 3 — DEV DECK (deterministic properties)
// ═══════════════════════════════════════════════════════════════════

test("devDeck returns 25 cards", () => {
  const deck = devDeck();
  assert.equal(deck.length, 25);
});

test("devDeck composition is correct regardless of shuffle", () => {
  const deck = devDeck();
  const counts = {};
  for (const c of deck) counts[c] = (counts[c] || 0) + 1;
  assert.equal(counts.knight, 14);
  assert.equal(counts.victory, 5);
  assert.equal(counts.roadBuilding, 2);
  assert.equal(counts.yearOfPlenty, 2);
  assert.equal(counts.monopoly, 2);
});

test("DEV_LABEL has all five card types", () => {
  assert.ok(DEV_LABEL.knight);
  assert.ok(DEV_LABEL.victory);
  assert.ok(DEV_LABEL.roadBuilding);
  assert.ok(DEV_LABEL.yearOfPlenty);
  assert.ok(DEV_LABEL.monopoly);
});

// ═══════════════════════════════════════════════════════════════════
//  SECTION 4 — ID GENERATION (deterministic properties only)
// ═══════════════════════════════════════════════════════════════════

test("newGameId returns 5-character alphanumeric string", () => {
  const id = newGameId();
  assert.equal(typeof id, "string");
  assert.equal(id.length, 5);
  assert.ok(/^[A-HJ-NP-Z2-9]{5}$/.test(id));
  // No ambiguous chars: I, O, 0, 1
  assert.ok(!id.includes("I"));
  assert.ok(!id.includes("O"));
  assert.ok(!id.includes("0"));
  assert.ok(!id.includes("1"));
});

test("newId returns a UUID-formatted string", () => {
  const id = newId();
  assert.equal(typeof id, "string");
  assert.ok(id.length >= 32);
  assert.ok(id.includes("-"));
  // UUIDv4 style check
  assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id));
});

// ═══════════════════════════════════════════════════════════════════
//  SECTION 5 — DISTANCE RULE (deterministic)
// ═══════════════════════════════════════════════════════════════════

function makeBoardWithPlayers(occupiedVertices) {
  const geo = buildBoardGeometry();
  const board = { vertices: geo.vertices, edges: geo.edges };
  const players = [];
  occupiedVertices.forEach((vertexIds, i) => {
    players.push({
      id: `p${i}`,
      settlements: vertexIds,
      cities: [],
      roads: [],
    });
  });
  return { board, players };
}

test("distanceRuleOk returns true for isolated vertex", () => {
  const { board, players } = makeBoardWithPlayers([[0]]); // vertex 0 occupied
  // vertex 10 is far from vertex 0
  const ok = distanceRuleOk(board, 10, players);
  assert.equal(ok, true);
});

test("distanceRuleOk returns false when vertex itself is occupied", () => {
  const { board, players } = makeBoardWithPlayers([[5]]);
  const ok = distanceRuleOk(board, 5, players);
  assert.equal(ok, false);
});

test("distanceRuleOk returns false when an immediate neighbour is occupied", () => {
  // Pick vertex 0 and one of its neighbours
  const geo = buildBoardGeometry();
  const v0 = geo.vertices[0];
  const neighborId = v0.neighborVertexIds[0];

  const { board, players } = makeBoardWithPlayers([[neighborId]]);
  const ok = distanceRuleOk(board, 0, players);
  assert.equal(ok, false);
});

test("distanceRuleOk respects cities as well as settlements", () => {
  const { board, players } = makeBoardWithPlayers([[], []]);
  // players[0].cities push vertex 1
  players[0].cities.push(1);
  const ok = distanceRuleOk(board, 1, players);
  assert.equal(ok, false);
});

test("distanceRuleOk returns true with empty players", () => {
  const geo = buildBoardGeometry();
  const board = { vertices: geo.vertices, edges: geo.edges };
  assert.equal(distanceRuleOk(board, 0, []), true);
});

test("vertexIsFree returns true when no one occupies vertex", () => {
  const { board, players } = makeBoardWithPlayers([[5]]);
  assert.equal(vertexIsFree(board, 0, players), true);
});

test("vertexIsFree returns false when occupied by settlement", () => {
  const { board, players } = makeBoardWithPlayers([[7]]);
  assert.equal(vertexIsFree(board, 7, players), false);
});

test("vertexIsFree returns false when occupied by city", () => {
  const { board, players } = makeBoardWithPlayers([[], []]);
  players[1].cities.push(3);
  assert.equal(vertexIsFree(board, 3, players), false);
});

test("edgeIsFree returns true for unused edge", () => {
  const players = [{ id: "p0", roads: [5] }];
  assert.equal(edgeIsFree(7, players), true);
});

test("edgeIsFree returns false when edge is owned", () => {
  const players = [{ id: "p0", roads: [5] }];
  assert.equal(edgeIsFree(5, players), false);
});

test("edgeIsFree returns true with empty roads", () => {
  assert.equal(edgeIsFree(3, []), true);
});

test("playerOwnsEdgeVertexOrRoad via settlement on v1", () => {
  const geo = buildBoardGeometry();
  const e = geo.edges[0];
  const player = { settlements: [e.v1], cities: [], roads: [] };
  assert.equal(
    playerOwnsEdgeVertexOrRoad({ edges: geo.edges, vertices: geo.vertices }, 0, player),
    true,
  );
});

test("playerOwnsEdgeVertexOrRoad via city on v2", () => {
  const geo = buildBoardGeometry();
  const e = geo.edges[0];
  const player = { settlements: [], cities: [e.v2], roads: [] };
  assert.equal(
    playerOwnsEdgeVertexOrRoad({ edges: geo.edges, vertices: geo.vertices }, 0, player),
    true,
  );
});

test("playerOwnsEdgeVertexOrRoad via shared road at vertex", () => {
  const geo = buildBoardGeometry();
  // Find two edges that share vertex v1 of edge 0
  const e = geo.edges[0];
  const neighborEdges = geo.vertices[e.v1].edgeIds.filter((eid) => eid !== 0);
  const player = { settlements: [], cities: [], roads: [neighborEdges[0]] };
  assert.equal(
    playerOwnsEdgeVertexOrRoad({ edges: geo.edges, vertices: geo.vertices }, 0, player),
    true,
  );
});

test("playerOwnsEdgeVertexOrRoad returns false when disconnected", () => {
  const geo = buildBoardGeometry();
  const player = { settlements: [], cities: [], roads: [] };
  assert.equal(
    playerOwnsEdgeVertexOrRoad({ edges: geo.edges, vertices: geo.vertices }, 0, player),
    false,
  );
});

test("vertexConnectsToPlayerRoad true when one edge of vertex is a road", () => {
  const geo = buildBoardGeometry();
  const v = geo.vertices[0];
  const edgeId = v.edgeIds[0];
  const player = { roads: [edgeId] };
  assert.equal(vertexConnectsToPlayerRoad({ vertices: geo.vertices }, 0, player), true);
});

test("vertexConnectsToPlayerRoad false when none of vertex edges are roads", () => {
  const geo = buildBoardGeometry();
  const player = { roads: [] };
  assert.equal(vertexConnectsToPlayerRoad({ vertices: geo.vertices }, 0, player), false);
});

// ═══════════════════════════════════════════════════════════════════
//  SECTION 6 — LONGEST ROAD (deterministic on fixed graph)
// ═══════════════════════════════════════════════════════════════════

test("longestRoadLength returns 0 for empty road set", () => {
  const geo = buildBoardGeometry();
  assert.equal(longestRoadLength([], geo), 0);
});

test("longestRoadLength returns 1 for single road", () => {
  const geo = buildBoardGeometry();
  assert.equal(longestRoadLength([0], { edges: geo.edges }), 1);
});

test("longestRoadLength counts connected chain", () => {
  const geo = buildBoardGeometry();
  // Edges 0 and 1 share a vertex (adjacent edges on the same tile)
  // Verify by picking two edges from the same vertex
  const v = geo.vertices[0];
  const e1 = v.edgeIds[0];
  const e2 = v.edgeIds[1];
  const len = longestRoadLength([e1, e2], { edges: geo.edges });
  assert.equal(len, 2, `expected length 2 for edges ${e1} + ${e2} sharing a vertex`);
});

test("longestRoadLength detects the longest branch in a Y shape", () => {
  // Build a Y shape: edges 0-1-2 all meet at one vertex
  const geo = buildBoardGeometry();
  const v = geo.vertices[0];
  const edges = v.edgeIds.slice(0, 3); // pick three edges meeting at vertex 0
  // A Y shape can have max road length of 2 (any two edges form a line + the third is a branch)
  const len = longestRoadLength(edges, { edges: geo.edges });
  // The longest continuous path through a Y is 2 (pick any two edges that are collinear or form the longest path)
  // Actually in a hex grid, 3 edges from the same vertex are all 60° apart,
  // so any two form a path of length 2, the third is a branch of length 1 from the middle
  assert.ok(len >= 2, `Y shape length ${len} should be at least 2`);
});

// ═══════════════════════════════════════════════════════════════════
//  SECTION 7 — SCORING (fully deterministic)
// ═══════════════════════════════════════════════════════════════════

test("publicScore counts settlements and cities", () => {
  const p = {
    settlements: [1, 2, 3], // 3 VP
    cities: [4, 5], // 4 VP
    hasLongestRoad: false,
    hasLargestArmy: false,
  };
  assert.equal(publicScore(p), 7);
});

test("publicScore includes longest road bonus (2 VP)", () => {
  const p = {
    settlements: [],
    cities: [],
    hasLongestRoad: true,
    hasLargestArmy: false,
  };
  assert.equal(publicScore(p), 2);
});

test("publicScore includes largest army bonus (2 VP)", () => {
  const p = {
    settlements: [],
    cities: [],
    hasLongestRoad: false,
    hasLargestArmy: true,
  };
  assert.equal(publicScore(p), 2);
});

test("publicScore includes both bonuses", () => {
  const p = {
    settlements: [1],
    cities: [2],
    hasLongestRoad: true,
    hasLargestArmy: true,
  };
  // 1 settlement = 1VP, 1 city = 2VP, +2 +2 = 7
  assert.equal(publicScore(p), 7);
});

test("totalScore adds hidden victory point dev cards", () => {
  const p = {
    settlements: [1, 2], // 2 VP
    cities: [3], // 2 VP
    hasLongestRoad: false,
    hasLargestArmy: true, // 2 VP
    devCards: [
      { type: "victory", id: "a", boughtTurn: 1 },
      { type: "victory", id: "b", boughtTurn: 2 },
      { type: "knight", id: "c", boughtTurn: 1 },
    ],
  };
  // public = 2 + 2 + 2 = 6, hidden = 2 victory cards = 2, total = 8
  assert.equal(publicScore(p), 6);
  assert.equal(totalScore(p), 8);
});

test("totalScore equals publicScore when no hidden VP cards", () => {
  const p = {
    settlements: [1],
    cities: [],
    hasLongestRoad: false,
    hasLargestArmy: false,
    devCards: [{ type: "knight", id: "x", boughtTurn: 1 }],
  };
  assert.equal(totalScore(p), publicScore(p));
});

// ═══════════════════════════════════════════════════════════════════
//  SECTION 8 — PUBLIC GAME STATE (deterministic)
// ═══════════════════════════════════════════════════════════════════

test("publicGameState strips resources and devCards from players", () => {
  const game = {
    gameId: "GAME1",
    phase: "playing",
    turnNumber: 5,
    currentPlayerIndex: 0,
    players: [
      {
        id: "p1",
        name: "Ali",
        color: "#b23a2e",
        resources: { wood: 3, brick: 2, wheat: 1, sheep: 4, ore: 0 },
        devCards: [{ type: "knight", id: "x", boughtTurn: 1 }],
        roads: [1, 2],
        settlements: [5],
        cities: [],
        knightsPlayed: 0,
        hasLongestRoad: false,
        hasLargestArmy: false,
        connected: true,
      },
      {
        id: "p2",
        name: "Bob",
        color: "#2b6ca3",
        resources: { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 2 },
        devCards: [],
        roads: [3],
        settlements: [7],
        cities: [8],
        knightsPlayed: 1,
        hasLongestRoad: false,
        hasLargestArmy: false,
        connected: true,
      },
    ],
    board: null,
    robberTileId: 3,
    dice: [2, 5],
    log: [],
    pending: null,
    tradeOffers: [],
    bank: { wood: 19, brick: 19, wheat: 19, sheep: 19, ore: 19 },
  };

  const pub = publicGameState(game);

  // p1: 3+2+1+4+0 = 10 resources, 1 dev card
  assert.equal(pub.players[0].resourceCount, 10);
  assert.equal(pub.players[0].devCardCount, 1);
  assert.equal(pub.players[0].name, "Ali");
  assert.equal(pub.players[0].color, "#b23a2e");
  assert.equal(pub.players[0].resources, undefined);
  assert.equal(pub.players[0].devCards, undefined);
  assert.deepEqual(pub.players[0].roads, [1, 2]);

  // p2: 0+0+0+0+2 = 2 resources, 0 dev cards
  assert.equal(pub.players[1].resourceCount, 2);
  assert.equal(pub.players[1].devCardCount, 0);
  assert.equal(pub.players[1].resources, undefined);
  assert.equal(pub.players[1].devCards, undefined);

  // Other fields are passed through
  assert.equal(pub.gameId, "GAME1");
  assert.equal(pub.robberTileId, 3);
});

test("publicGameState preserves settlement/city/road data", () => {
  const game = {
    gameId: "X",
    phase: "playing",
    turnNumber: 1,
    currentPlayerIndex: 0,
    players: [
      {
        id: "a",
        name: "P1",
        color: "#111",
        resources: emptyResources(),
        devCards: [],
        roads: [5, 6],
        settlements: [10, 11],
        cities: [20],
        knightsPlayed: 2,
        hasLongestRoad: true,
        hasLargestArmy: false,
        connected: false,
      },
    ],
    board: null,
    robberTileId: 0,
    dice: null,
    log: [],
    pending: null,
    tradeOffers: [],
    bank: { wood: 10, brick: 10, wheat: 10, sheep: 10, ore: 10 },
  };

  const pub = publicGameState(game);
  const p = pub.players[0];

  assert.equal(p.name, "P1");
  assert.deepEqual(p.roads, [5, 6]);
  assert.deepEqual(p.settlements, [10, 11]);
  assert.deepEqual(p.cities, [20]);
  assert.equal(p.knightsPlayed, 2);
  assert.equal(p.hasLongestRoad, true);
  assert.equal(p.hasLargestArmy, false);
  assert.equal(p.connected, false);
  assert.equal(p.resourceCount, 0);
  assert.equal(p.devCardCount, 0);
});

// ═══════════════════════════════════════════════════════════════════
//  SECTION 9 — INITIAL STATE FACTORIES (deterministic)
// ═══════════════════════════════════════════════════════════════════

test("createLobbyState sets up basic lobby", () => {
  const host = { id: "host1", name: "Host" };
  const state = createLobbyState("ABCDE", host);

  assert.equal(state.gameId, "ABCDE");
  assert.equal(state.phase, "lobby");
  assert.equal(state.players.length, 1);
  assert.equal(state.players[0].id, "host1");
  assert.equal(state.players[0].name, "Host");
  assert.equal(state.board, null);
  assert.equal(state.robberTileId, null);
  assert.equal(state.currentPlayerIndex, 0);
  assert.equal(state.turnNumber, 0);
  assert.deepEqual(state.setupOrder, []);
  assert.equal(state.setupStep, 0);
  assert.equal(state.setupSubPhase, "settlement");
  assert.equal(state.lastPlacedSettlement, null);
  assert.equal(state.dice, null);
  assert.ok(Array.isArray(state.log));
  assert.equal(state.pending, null);
  assert.deepEqual(state.tradeOffers, []);
  assert.deepEqual(state.bank, { wood: 19, brick: 19, wheat: 19, sheep: 19, ore: 19 });
  assert.equal(state.devDeck.length, 25);
  assert.equal(state.hasPlayedDevCardThisTurn, false);
  assert.equal(state.longestRoadPlayerId, null);
  assert.equal(state.largestArmyPlayerId, null);
  assert.equal(state.winnerId, null);
  assert.equal(state.turnCheckpoint, null);
  assert.equal(typeof state.updatedAt, "number");
});

test("newPlayer creates player with empty state", () => {
  const p = newPlayer("Sara", "p99");
  assert.equal(p.id, "p99");
  assert.equal(p.name, "Sara");
  assert.equal(p.color, null);
  assert.deepEqual(p.resources, emptyResources());
  assert.deepEqual(p.devCards, []);
  assert.equal(p.knightsPlayed, 0);
  assert.deepEqual(p.roads, []);
  assert.deepEqual(p.settlements, []);
  assert.deepEqual(p.cities, []);
  assert.equal(p.hasLongestRoad, false);
  assert.equal(p.hasLargestArmy, false);
  assert.equal(p.connected, true);
});
