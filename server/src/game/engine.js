// Server-authoritative game actions, ported from the standalone prototype.
// Every function takes (game, playerId, ...args) and either mutates `game`
// in place and returns { ok: true }, or returns { ok: false, error }.
// The socket layer (index.js) is responsible for broadcasting `game` after
// a successful call.

import {
  RESOURCE_TYPES, RES_LABEL, PLAYER_COLORS, BUILD_COST,
  shuffle, buildBoardGeometry, assignBoardContent, newId,
  totalResources, canAfford, payCost, addResources,
  distanceRuleOk, edgeIsFree, playerOwnsEdgeVertexOrRoad, vertexConnectsToPlayerRoad,
  longestRoadLength, totalScore,
} from "./core.js";

function fail(error) { return { ok: false, error }; }
const OK = { ok: true };

// --- Turn-undo checkpoint system ---
// A checkpoint captures everything that CAN safely be reverted: resources,
// roads/settlements/cities, dev card hands, bank, dev deck, and the longest
// road / largest army holders. It is refreshed (moved forward) whenever an
// irreversible thing happens — dice resolve, a dev card's effect finishes,
// or a player-to-player trade completes — so "undo" always means "undo back
// to the last safe point", never further.
function snapshotCheckpoint(g) {
  return {
    players: g.players.map((p) => ({
      resources: { ...p.resources },
      roads: [...p.roads],
      settlements: [...p.settlements],
      cities: [...p.cities],
      devCards: p.devCards.map((c) => ({ ...c })),
      knightsPlayed: p.knightsPlayed,
      hasLongestRoad: p.hasLongestRoad,
      hasLargestArmy: p.hasLargestArmy,
    })),
    bank: { ...g.bank },
    devDeck: [...g.devDeck],
    longestRoadPlayerId: g.longestRoadPlayerId,
    largestArmyPlayerId: g.largestArmyPlayerId,
  };
}
function refreshCheckpoint(g) {
  g.turnCheckpoint = snapshotCheckpoint(g);
}
function restoreCheckpoint(g, snap) {
  g.players.forEach((p, i) => {
    const s = snap.players[i];
    p.resources = { ...s.resources };
    p.roads = [...s.roads];
    p.settlements = [...s.settlements];
    p.cities = [...s.cities];
    p.devCards = s.devCards.map((c) => ({ ...c }));
    p.knightsPlayed = s.knightsPlayed;
    p.hasLongestRoad = s.hasLongestRoad;
    p.hasLargestArmy = s.hasLargestArmy;
  });
  g.bank = { ...snap.bank };
  g.devDeck = [...snap.devDeck];
  g.longestRoadPlayerId = snap.longestRoadPlayerId;
  g.largestArmyPlayerId = snap.largestArmyPlayerId;
}

export function undoTurnActions(g, playerId) {
  if (g.players[g.currentPlayerIndex]?.id !== playerId) return fail("Not your turn.");
  if (g.pending) return fail("Resolve the pending action first.");
  if (!g.turnCheckpoint) return fail("Nothing to undo.");
  const player = g.players.find((p) => p.id === playerId);
  restoreCheckpoint(g, g.turnCheckpoint);
  g.log.push(`${player.name} کارای این نوبتش رو برگردوند.`);
  return OK;
}

function currentSetupPlayerId(g) {
  return g.setupOrder[g.setupStep];
}

function recomputeLongestRoad(g) {
  const lens = {};
  g.players.forEach((p) => { lens[p.id] = longestRoadLength(p.roads, g.board); });
  const eligible = g.players.filter((p) => lens[p.id] >= 5);
  let bestPid = null;
  if (eligible.length > 0) {
    const maxLen = Math.max(...eligible.map((p) => lens[p.id]));
    const tied = eligible.filter((p) => lens[p.id] === maxLen);
    bestPid = (g.longestRoadPlayerId && tied.some((p) => p.id === g.longestRoadPlayerId))
      ? g.longestRoadPlayerId
      : tied[0].id;
  }
  g.players.forEach((p) => (p.hasLongestRoad = p.id === bestPid));
  g.longestRoadPlayerId = bestPid;
}

function checkWinner(g) {
  const winner = g.players.find((p) => totalScore(p) >= (g.winScore || 10));
  if (winner) {
    g.phase = "ended";
    g.winnerId = winner.id;
    g.log.push(`${winner.name} بازی رو با ${totalScore(winner)} امتیاز پیروزی برد!`);
  }
}

function playerPortRate(board, player, resource) {
  const ownedVertices = [...player.settlements, ...player.cities];
  let rate = 4;
  board.ports.forEach((port) => {
    if (ownedVertices.includes(port.v1) || ownedVertices.includes(port.v2)) {
      if (port.type === "generic" && rate > 3) rate = 3;
      if (port.type === resource) rate = 2;
    }
  });
  return rate;
}

export function startGame(g, playerId) {
  if (g.players[0]?.id !== playerId) return fail("Only the host can start the game.");
  if (g.players.length < 2) return fail("Need at least 2 players.");
  const colors = shuffle(PLAYER_COLORS).slice(0, g.players.length);
  const order = shuffle(g.players.map((p) => p.id));
  g.players.forEach((p, i) => (p.color = colors[i]));
  g.players.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const geo = buildBoardGeometry();
  g.board = assignBoardContent(geo);
  g.robberTileId = g.board.robberTileId;
  g.phase = "setup";
  g.setupOrder = [...order, ...[...order].reverse()];
  g.setupStep = 0;
  g.setupSubPhase = "settlement";
  g.currentPlayerIndex = g.players.findIndex((p) => p.id === g.setupOrder[0]);
  g.log.push("بازی شروع شد! مرحله‌ی چیدمان: اولین روستات رو بذار.");
  return OK;
}

export function placeSetupSettlement(g, playerId, vertexId) {
  if (g.phase !== "setup" || g.setupSubPhase !== "settlement") return fail("Not the settlement step.");
  if (currentSetupPlayerId(g) !== playerId) return fail("Not your turn.");
  const player = g.players.find((p) => p.id === playerId);
  if (!distanceRuleOk(g.board, vertexId, g.players)) return fail("Too close to another settlement.");
  player.settlements.push(vertexId);
  g.lastPlacedSettlement = vertexId;
  g.setupSubPhase = "road";
  g.log.push(`${player.name} یه روستا ساخت.`);
  return OK;
}

export function placeSetupRoad(g, playerId, edgeId) {
  if (g.phase !== "setup" || g.setupSubPhase !== "road") return fail("Not the road step.");
  if (currentSetupPlayerId(g) !== playerId) return fail("Not your turn.");
  const player = g.players.find((p) => p.id === playerId);
  const e = g.board.edges[edgeId];
  if (!edgeIsFree(edgeId, g.players)) return fail("Edge already has a road.");
  if (e.v1 !== g.lastPlacedSettlement && e.v2 !== g.lastPlacedSettlement) return fail("Road must touch your new settlement.");
  player.roads.push(edgeId);
  g.log.push(`${player.name} یه جاده ساخت.`);

  const isSecondRound = g.setupStep >= g.setupOrder.length / 2;
  if (isSecondRound) {
    const v = g.board.vertices[g.lastPlacedSettlement];
    v.hexIds.forEach((hid) => {
      const tile = g.board.tiles[hid];
      if (tile.resource !== "desert") player.resources[tile.resource] += 1;
    });
  }

  g.setupStep += 1;
  g.setupSubPhase = "settlement";
  g.lastPlacedSettlement = null;

  if (g.setupStep >= g.setupOrder.length) {
    g.phase = "playing";
    g.turnNumber = 1;
    g.currentPlayerIndex = g.players.findIndex((p) => p.id === g.setupOrder[0]);
    g.log.push("چیدمان تموم شد. بازی شروع میشه — تاس بنداز!");
  } else {
    const nextPid = g.setupOrder[g.setupStep];
    g.currentPlayerIndex = g.players.findIndex((p) => p.id === nextPid);
  }
  return OK;
}

export function rollDice(g, playerId) {
  if (g.players[g.currentPlayerIndex]?.id !== playerId) return fail("Not your turn.");
  if (g.dice && g.pending) return fail("Already rolled.");
  if (g.dice) return fail("Already rolled this turn.");
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  const sum = d1 + d2;
  g.dice = [d1, d2];
  g.log.push(`${g.players[g.currentPlayerIndex].name} تاس انداخت: ${d1} + ${d2} = ${sum}`);

  if (sum === 7) {
    const discardPlayers = g.players.filter((p) => totalResources(p.resources) > 7).map((p) => p.id);
    g.pending = discardPlayers.length > 0 ? { type: "discard", remaining: discardPlayers } : { type: "robberMove" };
    g.log.push("عدد ۷ اومد! راهزن تکون خورد.");
  } else {
    g.board.tiles.forEach((tile) => {
      if (tile.number !== sum || tile.id === g.robberTileId) return;
      const gains = {};
      g.players.forEach((p) => (gains[p.id] = 0));
      tile.vertexIds.forEach((vid) => {
        g.players.forEach((p) => {
          if (p.settlements.includes(vid)) gains[p.id] += 1;
          if (p.cities.includes(vid)) gains[p.id] += 2;
        });
      });
      const totalNeeded = Object.values(gains).reduce((a, b) => a + b, 0);
      if (totalNeeded > 0 && g.bank[tile.resource] >= totalNeeded) {
        g.bank[tile.resource] -= totalNeeded;
        g.players.forEach((p) => { if (gains[p.id] > 0) p.resources[tile.resource] += gains[p.id]; });
      }
    });
  }
  if (!g.pending) refreshCheckpoint(g);
  return OK;
}

export function submitDiscard(g, playerId, picks) {
  if (!g.pending || g.pending.type !== "discard") return fail("No discard pending.");
  if (!g.pending.remaining.includes(playerId)) return fail("You have nothing to discard.");
  const player = g.players.find((p) => p.id === playerId);
  const needed = Math.floor(totalResources(player.resources) / 2);
  const chosen = totalResources(picks);
  if (chosen !== needed) return fail(`You must discard exactly ${needed}.`);
  if (!canAfford(player.resources, picks)) return fail("You don't have those cards.");
  player.resources = payCost(player.resources, picks);
  Object.entries(picks).forEach(([k, v]) => (g.bank[k] += v));
  g.pending.remaining = g.pending.remaining.filter((id) => id !== playerId);
  g.log.push(`${player.name} ${needed} کارت دور انداخت.`);
  if (g.pending.remaining.length === 0) g.pending = { type: "robberMove" };
  return OK;
}

export function moveRobber(g, playerId, tileId) {
  if (!g.pending || g.pending.type !== "robberMove") return fail("No robber move pending.");
  if (g.players[g.currentPlayerIndex]?.id !== playerId) return fail("Not your turn.");
  if (tileId === g.robberTileId) return fail("Robber must move to a different tile.");
  g.robberTileId = tileId;
  const tile = g.board.tiles[tileId];
  const victims = new Set();
  tile.vertexIds.forEach((vid) => {
    g.players.forEach((p) => {
      if (p.id === playerId) return;
      if ((p.settlements.includes(vid) || p.cities.includes(vid)) && totalResources(p.resources) > 0) {
        victims.add(p.id);
      }
    });
  });
  g.log.push(`${g.players[g.currentPlayerIndex].name} راهزن رو جابه‌جا کرد.`);
  g.pending = victims.size === 0 ? null : { type: "robberSteal", victims: [...victims] };
  if (!g.pending) refreshCheckpoint(g);
  return OK;
}

export function stealFrom(g, playerId, victimId) {
  if (!g.pending || g.pending.type !== "robberSteal") return fail("No steal pending.");
  if (!g.pending.victims.includes(victimId)) return fail("Invalid victim.");
  const thief = g.players.find((p) => p.id === playerId);
  const victim = g.players.find((p) => p.id === victimId);
  const pool = [];
  RESOURCE_TYPES.forEach((r) => { for (let i = 0; i < victim.resources[r]; i++) pool.push(r); });
  if (pool.length > 0) {
    const picked = pool[Math.floor(Math.random() * pool.length)];
    victim.resources[picked] -= 1;
    thief.resources[picked] += 1;
    g.log.push(`${thief.name} یه کارت از ${victim.name} دزدید.`);
  }
  g.pending = null;
  refreshCheckpoint(g);
  return OK;
}

export function buildRoad(g, playerId, edgeId) {
  const player = g.players.find((p) => p.id === playerId);
  if (g.players[g.currentPlayerIndex]?.id !== playerId) return fail("Not your turn.");
  if (!edgeIsFree(edgeId, g.players)) return fail("Edge already has a road.");
  if (!playerOwnsEdgeVertexOrRoad(g.board, edgeId, player)) return fail("Road must connect to your network.");
  const free = g.pending && g.pending.type === "roadBuildingFree";
  if (!free) {
    if (!canAfford(player.resources, BUILD_COST.road)) return fail("Not enough resources.");
    player.resources = payCost(player.resources, BUILD_COST.road);
    g.bank.brick += 1;
    g.bank.wood += 1;
  }
  player.roads.push(edgeId);
  g.log.push(`${player.name} یه جاده ساخت.`);
  if (free) {
    g.pending.remaining -= 1;
    if (g.pending.remaining <= 0) { g.pending = null; refreshCheckpoint(g); }
  }
  recomputeLongestRoad(g);
  checkWinner(g);
  return OK;
}

export function buildSettlement(g, playerId, vertexId) {
  const player = g.players.find((p) => p.id === playerId);
  if (g.players[g.currentPlayerIndex]?.id !== playerId) return fail("Not your turn.");
  if (!distanceRuleOk(g.board, vertexId, g.players)) return fail("Too close to another settlement.");
  if (!vertexConnectsToPlayerRoad(g.board, vertexId, player)) return fail("Must connect to one of your roads.");
  if (!canAfford(player.resources, BUILD_COST.settlement)) return fail("Not enough resources.");
  player.resources = payCost(player.resources, BUILD_COST.settlement);
  g.bank.brick += 1; g.bank.wood += 1; g.bank.wheat += 1; g.bank.sheep += 1;
  player.settlements.push(vertexId);
  g.log.push(`${player.name} یه روستا ساخت.`);
  checkWinner(g);
  return OK;
}

export function buildCity(g, playerId, vertexId) {
  const player = g.players.find((p) => p.id === playerId);
  if (g.players[g.currentPlayerIndex]?.id !== playerId) return fail("Not your turn.");
  if (!player.settlements.includes(vertexId)) return fail("You don't have a settlement there.");
  if (!canAfford(player.resources, BUILD_COST.city)) return fail("Not enough resources.");
  player.resources = payCost(player.resources, BUILD_COST.city);
  g.bank.wheat += 2; g.bank.ore += 3;
  player.settlements = player.settlements.filter((v) => v !== vertexId);
  player.cities.push(vertexId);
  g.log.push(`${player.name} روستاش رو به شهر ارتقا داد.`);
  checkWinner(g);
  return OK;
}

export function buyDevCard(g, playerId) {
  const player = g.players.find((p) => p.id === playerId);
  if (g.players[g.currentPlayerIndex]?.id !== playerId) return fail("Not your turn.");
  if (g.devDeck.length === 0) return fail("No development cards left.");
  if (!canAfford(player.resources, BUILD_COST.devCard)) return fail("Not enough resources.");
  player.resources = payCost(player.resources, BUILD_COST.devCard);
  g.bank.wheat += 1; g.bank.sheep += 1; g.bank.ore += 1;
  const card = g.devDeck.pop();
  player.devCards.push({ id: newId(), type: card, boughtTurn: g.turnNumber });
  g.log.push(`${player.name} یه کارت توسعه خرید.`);
  checkWinner(g);
  return OK;
}

export function playDevCard(g, playerId, cardId, type) {
  const player = g.players.find((p) => p.id === playerId);
  if (g.players[g.currentPlayerIndex]?.id !== playerId) return fail("Not your turn.");
  if (g.hasPlayedDevCardThisTurn) return fail("Already played a development card this turn.");
  const card = player.devCards.find((c) => c.id === cardId);
  if (!card || card.boughtTurn === g.turnNumber || card.type !== type) return fail("Cannot play that card yet.");
  if (type === "victory") return fail("Victory point cards cannot be played.");

  if (type === "knight") {
    player.devCards = player.devCards.filter((c) => c.id !== cardId);
    player.knightsPlayed += 1;
    g.hasPlayedDevCardThisTurn = true;
    g.pending = { type: "robberMove" };
    g.log.push(`${player.name} کارت شوالیه رو بازی کرد.`);
    let bestPid = g.largestArmyPlayerId;
    let bestCount = bestPid ? g.players.find((p) => p.id === bestPid).knightsPlayed : 2;
    g.players.forEach((p) => {
      if (p.knightsPlayed >= 3 && p.knightsPlayed > bestCount) {
        bestCount = p.knightsPlayed;
        bestPid = p.id;
      }
    });
    g.players.forEach((p) => (p.hasLargestArmy = p.id === bestPid));
    g.largestArmyPlayerId = bestPid;
    checkWinner(g);
  } else if (type === "roadBuilding") {
    player.devCards = player.devCards.filter((c) => c.id !== cardId);
    g.hasPlayedDevCardThisTurn = true;
    g.pending = { type: "roadBuildingFree", remaining: 2 };
    g.log.push(`${player.name} کارت جاده‌سازی رو بازی کرد.`);
  } else if (type === "yearOfPlenty") {
    player.devCards = player.devCards.filter((c) => c.id !== cardId);
    g.hasPlayedDevCardThisTurn = true;
    g.pending = { type: "yearOfPlenty" };
    g.log.push(`${player.name} کارت سال فراوانی رو بازی کرد.`);
  } else if (type === "monopoly") {
    player.devCards = player.devCards.filter((c) => c.id !== cardId);
    g.hasPlayedDevCardThisTurn = true;
    g.pending = { type: "monopoly" };
    g.log.push(`${player.name} کارت انحصار رو بازی کرد.`);
  } else {
    return fail("Unknown card type.");
  }
  return OK;
}

export function resolveYearOfPlenty(g, playerId, picks) {
  if (!g.pending || g.pending.type !== "yearOfPlenty") return fail("Nothing to resolve.");
  const player = g.players.find((p) => p.id === playerId);
  const need = {};
  picks.forEach((r) => (need[r] = (need[r] || 0) + 1));
  if (!canAfford(g.bank, need)) return fail("Bank doesn't have those resources.");
  g.bank = payCost(g.bank, need);
  player.resources = addResources(player.resources, need);
  g.log.push(`${player.name} از بانک منبع برداشت.`);
  g.pending = null;
  refreshCheckpoint(g);
  return OK;
}

export function resolveMonopoly(g, playerId, resource) {
  if (!g.pending || g.pending.type !== "monopoly") return fail("Nothing to resolve.");
  const player = g.players.find((p) => p.id === playerId);
  let total = 0;
  g.players.forEach((p) => {
    if (p.id === player.id) return;
    total += p.resources[resource];
    p.resources[resource] = 0;
  });
  player.resources[resource] += total;
  g.log.push(`${player.name} روی ${RES_LABEL[resource]} انحصار گرفت (${total} کارت).`);
  g.pending = null;
  refreshCheckpoint(g);
  return OK;
}

export function bankTrade(g, playerId, give, want) {
  const player = g.players.find((p) => p.id === playerId);
  const rate = playerPortRate(g.board, player, give);
  if (player.resources[give] < rate) return fail("Not enough resources.");
  if (g.bank[want] < 1) return fail("Bank is out of that resource.");
  player.resources[give] -= rate;
  player.resources[want] += 1;
  g.bank[give] += rate;
  g.bank[want] -= 1;
  g.log.push(`${player.name} با بانک معامله کرد: ${rate} ${RES_LABEL[give]} برای ۱ ${RES_LABEL[want]}.`);
  return OK;
}

export function proposeTrade(g, playerId, give, want) {
  const player = g.players.find((p) => p.id === playerId);
  if (g.players[g.currentPlayerIndex]?.id !== playerId) return fail("Not your turn.");
  if (player.resources[give] < 1) return fail("You don't have that resource.");
  // Only replace THIS player's own open offer, so we don't wipe out an open
  // offer another player might have proposed.
  g.tradeOffers = g.tradeOffers.filter((o) => o.from !== playerId || o.status !== "open");
  g.tradeOffers.push({ id: newId(), from: player.id, give, want, status: "open" });
  g.log.push(`${player.name} پیشنهاد داد: ${RES_LABEL[give]} بابت ${RES_LABEL[want]}.`);
  return OK;
}

export function acceptTrade(g, playerId, offerId) {
  const offer = g.tradeOffers.find((o) => o.id === offerId && o.status === "open");
  if (!offer) return fail("Offer no longer available.");
  const proposer = g.players.find((p) => p.id === offer.from);
  const acceptor = g.players.find((p) => p.id === playerId);
  if (acceptor.id === proposer.id) return fail("Cannot accept your own offer.");
  if (proposer.resources[offer.give] < 1 || acceptor.resources[offer.want] < 1) return fail("Missing resources for this trade.");
  proposer.resources[offer.give] -= 1;
  proposer.resources[offer.want] += 1;
  acceptor.resources[offer.want] -= 1;
  acceptor.resources[offer.give] += 1;
  offer.status = "done";
  g.log.push(`${acceptor.name} معامله‌ی ${proposer.name} رو قبول کرد.`);
  refreshCheckpoint(g);
  return OK;
}

export function cancelTrade(g, playerId, offerId) {
  g.tradeOffers = g.tradeOffers.filter((o) => o.id !== offerId);
  return OK;
}

export function endTurn(g, playerId) {
  if (g.players[g.currentPlayerIndex]?.id !== playerId) return fail("Not your turn.");
  if (g.pending) return fail("Resolve the pending action first.");
  g.tradeOffers = [];
  g.dice = null;
  g.hasPlayedDevCardThisTurn = false;
  g.turnCheckpoint = null; // nothing to undo until the next player rolls
  g.currentPlayerIndex = (g.currentPlayerIndex + 1) % g.players.length;
  g.turnNumber += 1;
  g.log.push(`نوبت ${g.players[g.currentPlayerIndex].name}.`);
  return OK;
}
