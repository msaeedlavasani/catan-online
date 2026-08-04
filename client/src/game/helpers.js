import { RESOURCE_TYPES, BUILD_COST, RES_LABEL } from "./constants.js";

function canAffordLocal(res, cost) {
  return Object.entries(cost).every(([k, v]) => res[k] >= v);
}
function missingFor(res, cost) {
  const missing = {};
  Object.entries(cost).forEach(([k, v]) => {
    const need = v - (res[k] || 0);
    if (need > 0) missing[k] = need;
  });
  return missing;
}
function describeMissing(missing) {
  return Object.entries(missing).map(([k, v]) => `${v} ${RES_LABEL[k]}`).join("، ");
}

// Returns a small list of { text, kind } suggestions for the sidebar, based
// purely on the player's current resources (does not check board placement
// validity — that's still enforced server-side when they actually try).
export function getSuggestions(game, myPlayer) {
  if (!game || !myPlayer) return [];
  const isMyTurn = game.players[game.currentPlayerIndex]?.id === myPlayer.id;
  if (game.phase === "setup") {
    return isMyTurn
      ? [{ kind: "info", text: game.setupSubPhase === "settlement" ? "روستات رو روی تخته بذار." : "یه جاده وصل به روستای جدیدت بذار." }]
      : [];
  }
  if (game.phase !== "playing" || !isMyTurn) return [];
  if (game.pending) return [{ kind: "info", text: "اول باید اقدام فعلی رو تموم کنی." }];
  if (!game.dice) return [{ kind: "info", text: "برای شروع نوبتت تاس بنداز." }];

  const res = myPlayer.resources;
  const suggestions = [];

  const canRoad = canAffordLocal(res, BUILD_COST.road);
  suggestions.push(canRoad
    ? { kind: "can", text: "می‌تونی یه جاده بسازی." }
    : { kind: "need", text: `جاده: ${describeMissing(missingFor(res, BUILD_COST.road))} کم داری.` });

  const canSettlement = canAffordLocal(res, BUILD_COST.settlement);
  suggestions.push(canSettlement
    ? { kind: "can", text: "می‌تونی یه روستا بسازی." }
    : { kind: "need", text: `روستا: ${describeMissing(missingFor(res, BUILD_COST.settlement))} کم داری.` });

  if (myPlayer.settlements.length > 0) {
    const canCity = canAffordLocal(res, BUILD_COST.city);
    suggestions.push(canCity
      ? { kind: "can", text: "می‌تونی یه روستا رو به شهر ارتقا بدی." }
      : { kind: "need", text: `شهر: ${describeMissing(missingFor(res, BUILD_COST.city))} کم داری.` });
  }

  const canDev = canAffordLocal(res, BUILD_COST.devCard) && game.devDeck.length > 0;
  suggestions.push(canDev
    ? { kind: "can", text: "می‌تونی یه کارت توسعه بخری." }
    : game.devDeck.length === 0
      ? { kind: "info", text: "دیگه کارت توسعه‌ای تو دسته نمونده." }
      : { kind: "need", text: `کارت توسعه: ${describeMissing(missingFor(res, BUILD_COST.devCard))} کم داری.` });

  return suggestions;
}

export function emptyResources() {
  return { wood: 0, brick: 0, wheat: 0, sheep: 0, ore: 0 };
}


export function totalResources(res) {
  return RESOURCE_TYPES.reduce((s, k) => s + res[k], 0);
}
export function publicScore(player) {
  return player.settlements.length * 1 + player.cities.length * 2 +
    (player.hasLongestRoad ? 2 : 0) + (player.hasLargestArmy ? 2 : 0);
}
export function totalScore(player) {
  const hiddenVP = player.devCards.filter((c) => c.type === "victory").length;
  return publicScore(player) + hiddenVP;
}

export function playerPortRate(board, player, resource) {
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

// Darkens (negative amt) or lightens (positive amt) a "#rrggbb" color by amt in [-1, 1].
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const adjust = (c) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
  r = adjust(r); g = adjust(g); b = adjust(b);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}



