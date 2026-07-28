export const INK = "#2b2118";
export const PARCHMENT = "#efe3c8";
export const PARCHMENT_DARK = "#e3d3ab";
export const SEA = "#1d4e5f";
export const SEA_DEEP = "#123540";
export const GOLD = "#b8863b";

export const RES_COLOR = {
  wood: "#3f5b3a",
  brick: "#a8532f",
  wheat: "#d3a336",
  sheep: "#8bab5c",
  ore: "#6b6f76",
  desert: "#d9c896",
};
export const RES_LABEL = { wood: "Timber", brick: "Brick", wheat: "Grain", sheep: "Wool", ore: "Ore", desert: "Desert" };
export const PLAYER_COLORS = ["#b23a2e", "#2b6ca3", "#e0952b", "#3f7d4a", "#6a4c93", "#c9556e"];

// Only 4 of our 6 player colors currently have matching hand-made piece art
// (red/blue/orange/green). Purple and pink fall back to the plain vector shapes.
export const COLOR_ASSET_NAME = {
  "#b23a2e": "red",
  "#2b6ca3": "blue",
  "#e0952b": "orange",
  "#3f7d4a": "green",
};

export const BUILD_COST = {
  road: { brick: 1, wood: 1 },
  settlement: { brick: 1, wood: 1, wheat: 1, sheep: 1 },
  city: { wheat: 2, ore: 3 },
  devCard: { wheat: 1, sheep: 1, ore: 1 },
};
export const RESOURCE_TYPES = ["wood", "brick", "wheat", "sheep", "ore"];
export const DEV_LABEL = {
  knight: "Knight",
  victory: "Victory Point",
  roadBuilding: "Road Building",
  yearOfPlenty: "Year of Plenty",
  monopoly: "Monopoly",
};

