import { RESOURCE_TYPES } from "./constants.js";

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



