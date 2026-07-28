import React from "react";
import { INK, PARCHMENT_DARK, SEA, GOLD, RES_COLOR, COLOR_ASSET_NAME } from "../game/constants.js";
import { shade } from "../game/helpers.js";
import { styles } from "../styles.js";
import { RESOURCE_GLYPHS, AnchorGlyph } from "./ResourceGlyphs.jsx";

const TILE_IMG = {
  wood: "/assets/tiles/wood.webp",
  brick: "/assets/tiles/brick.webp",
  wheat: "/assets/tiles/wheat.webp",
  sheep: "/assets/tiles/sheep.webp",
  ore: "/assets/tiles/ore.webp",
  desert: "/assets/tiles/desert.webp",
};
const ROBBER_IMG = "/assets/pieces/robber.webp";
function numberImg(n) { return `/assets/numbers/${n}.webp`; }
function pieceImg(kind, colorName) { return `/assets/pieces/${kind}-${colorName || "default"}.webp`; }

export default function BoardSVG({ board, robberTileId, players, buildMode, phase, setupSubPhase, isMyTurn, isMySetupTurn, lastPlacedSettlement, myPlayer, pending, onVertexClick, onEdgeClick, onTileClick }) {
  const xs = board.tiles.map((t) => t.x);
  const ys = board.tiles.map((t) => t.y);
  const minX = Math.min(...xs) - 90, maxX = Math.max(...xs) + 90;
  const minY = Math.min(...ys) - 90, maxY = Math.max(...ys) + 90;
  const w = maxX - minX, h = maxY - minY;

  const vertexOwner = {};
  players.forEach((p) => {
    p.settlements.forEach((v) => (vertexOwner[v] = { color: p.color, type: "settlement", playerId: p.id }));
    p.cities.forEach((v) => (vertexOwner[v] = { color: p.color, type: "city", playerId: p.id }));
  });
  const edgeOwner = {};
  players.forEach((p) => p.roads.forEach((e) => (edgeOwner[e] = p.color)));

  const settlementModeActive = (phase === "setup" && setupSubPhase === "settlement" && isMySetupTurn) ||
    (phase !== "setup" && buildMode === "settlement" && isMyTurn);
  const cityModeActive = phase !== "setup" && buildMode === "city" && isMyTurn;
  const roadModeActive = (phase === "setup" && setupSubPhase === "road" && isMySetupTurn) ||
    (phase !== "setup" && buildMode === "road" && isMyTurn);
  const tileClickable = pending?.type === "robberMove" && isMyTurn;

  function emptyVertexValid(v) {
    if (vertexOwner[v.id]) return false;
    if (v.neighborVertexIds.some((nb) => vertexOwner[nb])) return false;
    if (phase === "setup") return true;
    if (!myPlayer) return false;
    return v.edgeIds.some((eid) => myPlayer.roads.includes(eid));
  }
  function edgeValid(e) {
    if (edgeOwner[e.id]) return false;
    if (phase === "setup") {
      return lastPlacedSettlement != null && (e.v1 === lastPlacedSettlement || e.v2 === lastPlacedSettlement);
    }
    if (!myPlayer) return false;
    const touchesOwnBuilding = myPlayer.settlements.includes(e.v1) || myPlayer.settlements.includes(e.v2) ||
      myPlayer.cities.includes(e.v1) || myPlayer.cities.includes(e.v2);
    if (touchesOwnBuilding) return true;
    const v1 = board.vertices[e.v1], v2 = board.vertices[e.v2];
    return [...v1.edgeIds, ...v2.edgeIds].some((eid) => eid !== e.id && myPlayer.roads.includes(eid));
  }

  function hexPoints(t, mult = 1) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const rad = (Math.PI / 180) * (60 * i - 30);
      pts.push(`${t.x + 50 * mult * Math.cos(rad)},${t.y + 50 * mult * Math.sin(rad)}`);
    }
    return pts.join(" ");
  }

  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} style={styles.svg}>
      <defs>
        <radialGradient id="seaGrad" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor={shade(SEA, 0.18)} />
          <stop offset="100%" stopColor={shade(SEA, -0.25)} />
        </radialGradient>
        <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.35" />
        </filter>
        <radialGradient id="portGrad" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fbf3dc" />
          <stop offset="100%" stopColor={PARCHMENT_DARK} />
        </radialGradient>
        {board.tiles.map((t) => (
          <clipPath id={`hexclip-${t.id}`} key={t.id}>
            <polygon points={hexPoints(t)} />
          </clipPath>
        ))}
      </defs>

      <rect x={minX} y={minY} width={w} height={h} fill="url(#seaGrad)" />

      {board.tiles.map((t) => {
        // The source art has a little breathing room around its own hex edge,
        // so we overscale slightly to make sure it fully covers our clip shape.
        const imgSize = 116;
        return (
          <g key={t.id} onClick={() => tileClickable && onTileClick(t.id)} style={{ cursor: tileClickable ? "pointer" : "default" }}>
            <g clipPath={`url(#hexclip-${t.id})`}>
              <image href={TILE_IMG[t.resource]} x={t.x - imgSize / 2} y={t.y - imgSize / 2} width={imgSize} height={imgSize} preserveAspectRatio="xMidYMid slice" />
            </g>
            <polygon points={hexPoints(t)} fill="none" stroke={shade(RES_COLOR[t.resource], -0.4)} strokeWidth={2} />
            {t.number && (
              <image href={numberImg(t.number)} x={t.x - 17} y={t.y - 17} width={34} height={34} filter="url(#softShadow)" />
            )}
            {t.id === robberTileId && (
              <image href={ROBBER_IMG} x={t.x - 17} y={t.y - 30} width={34} height={34} filter="url(#softShadow)" />
            )}
          </g>
        );
      })}

      {board.ports.map((port) => {
        const v1 = board.vertices[port.v1], v2 = board.vertices[port.v2];
        const mx = (v1.x + v2.x) / 2, my = (v1.y + v2.y) / 2;
        const dx = mx * 1.22, dy = my * 1.22;
        const Glyph = port.type === "generic" ? null : RESOURCE_GLYPHS[port.type];
        // a couple of little "posts" along the pier connecting the shore to the badge
        const post1x = mx + (dx - mx) * 0.35, post1y = my + (dy - my) * 0.35;
        const post2x = mx + (dx - mx) * 0.68, post2y = my + (dy - my) * 0.68;
        return (
          <g key={port.edgeId}>
            <line x1={mx} y1={my} x2={dx} y2={dy} stroke="#8a6b3f" strokeWidth={3.5} strokeLinecap="round" />
            <line x1={mx} y1={my} x2={dx} y2={dy} stroke="#b98f56" strokeWidth={1.2} strokeLinecap="round" opacity={0.8} />
            <circle cx={post1x} cy={post1y} r={2.2} fill="#6b4f2a" />
            <circle cx={post2x} cy={post2y} r={2.2} fill="#6b4f2a" />
            <circle cx={dx} cy={dy} r={17} fill="url(#portGrad)" stroke={GOLD} strokeWidth={2} filter="url(#softShadow)" />
            <circle cx={dx} cy={dy} r={13.5} fill="none" stroke={shade(GOLD, -0.2)} strokeWidth={0.6} opacity={0.6} />
            {Glyph ? <Glyph x={dx} y={dy - 3.5} scale={0.85} /> : <AnchorGlyph x={dx} y={dy - 4} scale={0.95} />}
            <text x={dx} y={dy + 11.5} textAnchor="middle" fontSize={8} fontWeight="700" fontFamily="Georgia, serif" fill={INK}>
              {port.type === "generic" ? "3:1" : "2:1"}
            </text>
          </g>
        );
      })}

      {board.edges.map((e) => {
        const v1 = board.vertices[e.v1], v2 = board.vertices[e.v2];
        const owner = edgeOwner[e.id];
        const valid = roadModeActive && edgeValid(e);
        return (
          <g key={e.id}>
            {owner && (
              <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke={shade(owner, -0.35)} strokeWidth={9} strokeLinecap="round" />
            )}
            <line
              x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
              stroke={owner || (valid ? GOLD : "transparent")}
              strokeWidth={owner ? 6 : 10}
              strokeOpacity={owner ? 1 : valid ? 0.5 : 0}
              strokeLinecap="round"
              onClick={() => valid && onEdgeClick(e.id)}
              style={{ cursor: valid ? "pointer" : "default" }}
            />
          </g>
        );
      })}

      {board.vertices.map((v) => {
        const owner = vertexOwner[v.id];
        const canPlace = !owner && settlementModeActive && emptyVertexValid(v);
        const canUpgrade = cityModeActive && owner && owner.type === "settlement" && owner.playerId === myPlayer?.id;
        const assetColor = owner ? COLOR_ASSET_NAME[owner.color] : null;

        return (
          <g key={v.id}>
            {canPlace && (
              <circle cx={v.x} cy={v.y} r={9} fill={GOLD} fillOpacity={0.55} stroke={shade(GOLD, -0.3)} strokeWidth={1}
                onClick={() => onVertexClick(v.id)} style={{ cursor: "pointer" }}>
                <animate attributeName="r" values="8;10;8" dur="1.4s" repeatCount="indefinite" />
              </circle>
            )}

            {owner && owner.type === "settlement" && assetColor && (
              <image href={pieceImg("settlement", assetColor)} x={v.x - 13} y={v.y - 15} width={26} height={26}
                filter="url(#softShadow)" onClick={() => canUpgrade && onVertexClick(v.id)}
                style={{ cursor: canUpgrade ? "pointer" : "default" }} />
            )}
            {owner && owner.type === "settlement" && !assetColor && (
              <g filter="url(#softShadow)" onClick={() => canUpgrade && onVertexClick(v.id)} style={{ cursor: canUpgrade ? "pointer" : "default" }}>
                <polygon
                  points={`${v.x},${v.y - 9} ${v.x + 8},${v.y - 1} ${v.x + 8},${v.y + 8} ${v.x - 8},${v.y + 8} ${v.x - 8},${v.y - 1}`}
                  fill={owner.color} stroke={canUpgrade ? GOLD : shade(owner.color, -0.45)} strokeWidth={canUpgrade ? 2.5 : 1.3}
                />
              </g>
            )}
            {canUpgrade && (
              <circle cx={v.x} cy={v.y - 15} r={2.5} fill={GOLD} stroke={INK} strokeWidth={0.5} />
            )}

            {owner && owner.type === "city" && assetColor && (
              <image href={pieceImg("city", assetColor)} x={v.x - 15} y={v.y - 17} width={30} height={30} filter="url(#softShadow)" />
            )}
            {owner && owner.type === "city" && !assetColor && (
              <g filter="url(#softShadow)">
                <rect x={v.x - 11} y={v.y - 6} width={22} height={13} fill={owner.color} stroke={shade(owner.color, -0.45)} strokeWidth={1.3} />
                <polygon points={`${v.x - 11},${v.y - 6} ${v.x - 4},${v.y - 13} ${v.x + 3},${v.y - 6}`} fill={owner.color} stroke={shade(owner.color, -0.45)} strokeWidth={1.3} />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
