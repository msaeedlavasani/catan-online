
export const RES_LABEL = { wood: "Timber", brick: "Brick", wheat: "Grain", sheep: "Wool", ore: "Ore", desert: "Desert" };
export const PLAYER_COLORS = ["#b23a2e", "#2b6ca3", "#e0952b", "#3f7d4a", "#6a4c93", "#c9556e"];

export const BUILD_COST = {
  road: { brick: 1, wood: 1 },
  settlement: { brick: 1, wood: 1, wheat: 1, sheep: 1 },
  city: { wheat: 2, ore: 3 },
  devCard: { wheat: 1, sheep: 1, ore: 1 },
};
export const RESOURCE_TYPES = ["wood", "brick", "wheat", "sheep", "ore"];

/* ============================== BOARD MATH ============================== */
export function axialHexes(radius) {
  const hexes = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r;
      if (Math.abs(s) <= radius) hexes.push({ q, r });
    }
  }
  return hexes;
}
export function hexToPixel(q, r, size) {
  return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r };
}
export function cornerPixel(cx, cy, size, i) {
  const rad = (Math.PI / 180) * (60 * i - 30);
  return { x: cx + size * Math.cos(rad), y: cy + size * Math.sin(rad) };
}
export function keyOf(x, y) {
  return `${Math.round(x * 100)}_${Math.round(y * 100)}`;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildBoardGeometry(size = 52) {
  const hexes = axialHexes(2);
  const vertexMap = new Map();
  const vertices = [];
  const edgeMap = new Map();
  const edges = [];
  const tiles = hexes.map((h, idx) => {
    const { x, y } = hexToPixel(h.q, h.r, size);
    return { id: idx, q: h.q, r: h.r, x, y, vertexIds: [], edgeIds: [] };
  });

  tiles.forEach((tile) => {
    const cornerIds = [];
    for (let i = 0; i < 6; i++) {
      const { x, y } = cornerPixel(tile.x, tile.y, size, i);
      const k = keyOf(x, y);
      let vid;
      if (vertexMap.has(k)) vid = vertexMap.get(k);
      else {
        vid = vertices.length;
        vertexMap.set(k, vid);
        vertices.push({ id: vid, x, y, hexIds: [], neighborVertexIds: [], edgeIds: [] });
      }
      vertices[vid].hexIds.push(tile.id);
      cornerIds.push(vid);
    }
    tile.vertexIds = cornerIds;
    for (let i = 0; i < 6; i++) {
      const a = cornerIds[i];
      const b = cornerIds[(i + 1) % 6];
      const ek = a < b ? `${a}-${b}` : `${b}-${a}`;
      let eid;
      if (edgeMap.has(ek)) eid = edgeMap.get(ek);
      else {
        eid = edges.length;
        edgeMap.set(ek, eid);
        edges.push({ id: eid, v1: a, v2: b, hexIds: [] });
      }
      tile.edgeIds.push(eid);
      edges[eid].hexIds.push(tile.id);
      if (!vertices[a].neighborVertexIds.includes(b)) vertices[a].neighborVertexIds.push(b);
      if (!vertices[b].neighborVertexIds.includes(a)) vertices[b].neighborVertexIds.push(a);
      if (!vertices[a].edgeIds.includes(eid)) vertices[a].edgeIds.push(eid);
      if (!vertices[b].edgeIds.includes(eid)) vertices[b].edgeIds.push(eid);
    }
  });

  // boundary edges = belong to exactly 1 tile; sort around perimeter by angle
  const boundaryEdges = edges.filter((e) => e.hexIds.length === 1);
  const withAngle = boundaryEdges.map((e) => {
    const v1 = vertices[e.v1], v2 = vertices[e.v2];
    const mx = (v1.x + v2.x) / 2, my = (v1.y + v2.y) / 2;
    return { edge: e, angle: Math.atan2(my, mx) };
  });
  withAngle.sort((a, b) => a.angle - b.angle);
  const orderedBoundary = withAngle.map((w) => w.edge);

  return { tiles, vertices, edges, orderedBoundary };
}

export function assignBoardContent(geo) {
  const RESOURCE_POOL = [
    "wood", "wood", "wood", "wood",
    "brick", "brick", "brick",
    "wheat", "wheat", "wheat", "wheat",
    "sheep", "sheep", "sheep", "sheep",
    "ore", "ore", "ore",
    "desert",
  ];
  const NUMBER_POOL = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  const resources = shuffle(RESOURCE_POOL);
  let numIdx = 0;
  const numbers = shuffle(NUMBER_POOL);
  let robberTileId = null;
  const tiles = geo.tiles.map((t, i) => {
    const resource = resources[i];
    let number = null;
    if (resource === "desert") {
      robberTileId = t.id;
    } else {
      number = numbers[numIdx++];
    }
    return { ...t, resource, number };
  });

  // Port positions are fixed to match the 9 pre-cut harbor slots in the
  // hand-designed board-frame artwork (measured directly from the image).
  // Only the resource TYPE assigned to each slot is randomized per game.
  const PORT_EDGE_IDS = [9, 18, 13, 34, 28, 52, 60, 68, 69];
  const portTypes = shuffle(["generic", "generic", "generic", "generic", "wood", "brick", "wheat", "sheep", "ore"]);
  const ports = PORT_EDGE_IDS.map((edgeId, i) => {
    const edge = geo.edges[edgeId];
    return { edgeId: edge.id, v1: edge.v1, v2: edge.v2, type: portTypes[i] };
  });

  return { tiles, vertices: geo.vertices, edges: geo.edges, ports, robberTileId };
}

/* ============================== GAME LOGIC HELPERS ============================== */
export function newGameId() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}
export function newId() {
  return Math.random().toString(36).slice(2, 10);
}
export function emptyResources() {
  return { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 };
}
export function totalResources(res) {
  return RESOURCE_TYPES.reduce((s, k) => s + res[k], 0);
}
export function canAfford(res, cost) {
  return Object.entries(cost).every(([k, v]) => res[k] >= v);
}
export function payCost(res, cost) {
  const out = { ...res };
  Object.entries(cost).forEach(([k, v]) => (out[k] -= v));
  return out;
}
export function addResources(res, delta) {
  const out = { ...res };
  Object.entries(delta).forEach(([k, v]) => (out[k] = (out[k] || 0) + v));
  return out;
}
export function devDeck() {
  const deck = [];
  for (let i = 0; i < 14; i++) deck.push("knight");
  for (let i = 0; i < 5; i++) deck.push("victory");
  for (let i = 0; i < 2; i++) deck.push("roadBuilding");
  for (let i = 0; i < 2; i++) deck.push("yearOfPlenty");
  for (let i = 0; i < 2; i++) deck.push("monopoly");
  return shuffle(deck);
}
export const DEV_LABEL = {
  knight: "Knight",
  victory: "Victory Point",
  roadBuilding: "Road Building",
  yearOfPlenty: "Year of Plenty",
  monopoly: "Monopoly",
};

export function distanceRuleOk(board, vertexId, allPlayers) {
  const v = board.vertices[vertexId];
  const occupied = new Set();
  allPlayers.forEach((p) => {
    p.settlements.forEach((s) => occupied.add(s));
    p.cities.forEach((c) => occupied.add(c));
  });
  if (occupied.has(vertexId)) return false;
  for (const nb of v.neighborVertexIds) {
    if (occupied.has(nb)) return false;
  }
  return true;
}
export function vertexIsFree(board, vertexId, allPlayers) {
  const occupied = new Set();
  allPlayers.forEach((p) => {
    p.settlements.forEach((s) => occupied.add(s));
    p.cities.forEach((c) => occupied.add(c));
  });
  return !occupied.has(vertexId);
}
export function edgeIsFree(edgeId, allPlayers) {
  return !allPlayers.some((p) => p.roads.includes(edgeId));
}
export function playerOwnsEdgeVertexOrRoad(board, edgeId, player) {
  const e = board.edges[edgeId];
  const touchesOwnBuilding = player.settlements.includes(e.v1) || player.settlements.includes(e.v2) ||
    player.cities.includes(e.v1) || player.cities.includes(e.v2);
  if (touchesOwnBuilding) return true;
  // touches a road the player owns via shared vertex
  const v1edges = board.vertices[e.v1].edgeIds;
  const v2edges = board.vertices[e.v2].edgeIds;
  const touchesOwnRoad = [...v1edges, ...v2edges].some((eid) => eid !== edgeId && player.roads.includes(eid));
  return touchesOwnRoad;
}
export function vertexConnectsToPlayerRoad(board, vertexId, player) {
  const v = board.vertices[vertexId];
  return v.edgeIds.some((eid) => player.roads.includes(eid));
}
export function longestRoadLength(roadEdgeIds, board) {
  if (roadEdgeIds.length === 0) return 0;
  const adj = new Map();
  roadEdgeIds.forEach((eid) => {
    const e = board.edges[eid];
    if (!adj.has(e.v1)) adj.set(e.v1, []);
    if (!adj.has(e.v2)) adj.set(e.v2, []);
    adj.get(e.v1).push({ edgeId: eid, other: e.v2 });
    adj.get(e.v2).push({ edgeId: eid, other: e.v1 });
  });
  let best = 0;
  function dfs(vertex, used, length) {
    best = Math.max(best, length);
    const neighbors = adj.get(vertex) || [];
    for (const { edgeId, other } of neighbors) {
      if (!used.has(edgeId)) {
        used.add(edgeId);
        dfs(other, used, length + 1);
        used.delete(edgeId);
      }
    }
  }
  for (const v of adj.keys()) dfs(v, new Set(), 0);
  return best;
}
export function publicScore(player) {
  return player.settlements.length * 1 + player.cities.length * 2 +
    (player.hasLongestRoad ? 2 : 0) + (player.hasLargestArmy ? 2 : 0);
}
export function totalScore(player) {
  const hiddenVP = player.devCards.filter((c) => c.type === "victory").length;
  return publicScore(player) + hiddenVP;
}

/* ============================== STORAGE HELPERS ============================== */
async function loadGame(gameId) {
  try {
    const r = await window.storage.get(`catan:${gameId}`, true);
    return r ? JSON.parse(r.value) : null;
  } catch (e) {
    return null;
  }
}
async function saveGame(gameId, state) {
  try {
    await window.storage.set(`catan:${gameId}`, JSON.stringify(state), true);
  } catch (e) {
    console.error("save failed", e);
  }
}

/* ============================== INITIAL STATE ============================== */
export function createLobbyState(gameId, hostPlayer) {
  return {
    gameId,
    phase: "lobby",
    players: [hostPlayer],
    board: null,
    robberTileId: null,
    currentPlayerIndex: 0,
    turnNumber: 0,
    setupOrder: [],
    setupStep: 0,
    setupSubPhase: "settlement",
    lastPlacedSettlement: null,
    dice: null,
    log: [`${hostPlayer.name} created the game.`],
    pending: null,
    tradeOffers: [],
    bank: { wood: 19, brick: 19, wheat: 19, sheep: 19, ore: 19 },
    devDeck: devDeck(),
    hasPlayedDevCardThisTurn: false,
    longestRoadPlayerId: null,
    largestArmyPlayerId: null,
    winnerId: null,
    updatedAt: Date.now(),
  };
}
export function newPlayer(name, id) {
  return {
    id,
    name,
    color: null,
    resources: emptyResources(),
    devCards: [],
    knightsPlayed: 0,
    roads: [],
    settlements: [],
    cities: [],
    hasLongestRoad: false,
    hasLargestArmy: false,
    connected: true,
  };
}
