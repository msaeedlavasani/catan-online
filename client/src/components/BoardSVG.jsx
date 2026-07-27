import React from "react";
import { INK, PARCHMENT_DARK, SEA, GOLD, RES_COLOR } from "../game/constants.js";
import { shade } from "../game/helpers.js";
import { styles } from "../styles.js";
import { RESOURCE_GLYPHS } from "./ResourceGlyphs.jsx";

// Fixed little offsets (relative to hex center) where we scatter terrain
// glyphs, chosen to sit between the number token and the hex edge.
const GLYPH_SPOTS = [
  { dx: -26, dy: -16 }, { dx: 26, dy: -16 },
  { dx: -30, dy: 20 }, { dx: 30, dy: 20 },
];
const DESERT_SPOTS = [{ dx: -14, dy: 14 }, { dx: 16, dy: -10 }];

function RobberFigure({ x, y }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="0" cy="17" rx="12" ry="4" fill="#000" opacity="0.25" />
      <path d="M-9,16 C-9,2 -7,-6 0,-6 C7,-6 9,2 9,16 Z" fill="#2b2b33" stroke="#111116" strokeWidth="1" />
      <circle cx="0" cy="-10" r="7.5" fill="#33333d" stroke="#111116" strokeWidth="1" />
      <path d="M-6,-13 C-6,-19 6,-19 6,-13 C6,-16.5 -6,-16.5 -6,-13 Z" fill="#111116" />
    </g>
  );
}

function ResourceTexture({ tile }) {
  const Glyph = RESOURCE_GLYPHS[tile.resource];
  if (!Glyph) return null;
  const spots = tile.resource === "desert" ? DESERT_SPOTS : GLYPH_SPOTS;
  return spots.map((s, i) => <Glyph key={i} x={tile.x + s.dx} y={tile.y + s.dy} scale={1.05} />);
}

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

  function hexPoints(t) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const rad = (Math.PI / 180) * (60 * i - 30);
      pts.push(`${t.x + 50 * Math.cos(rad)},${t.y + 50 * Math.sin(rad)}`);
    }
    return pts.join(" ");
  }

  const resourceKeys = Object.keys(RES_COLOR);

  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} style={styles.svg}>
      <defs>
        <radialGradient id="seaGrad" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor={shade(SEA, 0.18)} />
          <stop offset="100%" stopColor={shade(SEA, -0.25)} />
        </radialGradient>
        {resourceKeys.map((r) => (
          <radialGradient key={r} id={`tile-${r}`} cx="42%" cy="38%" r="75%">
            <stop offset="0%" stopColor={shade(RES_COLOR[r], 0.16)} />
            <stop offset="100%" stopColor={shade(RES_COLOR[r], -0.16)} />
          </radialGradient>
        ))}
        <radialGradient id="tokenGrad" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#fbf3dc" />
          <stop offset="100%" stopColor={PARCHMENT_DARK} />
        </radialGradient>
        <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      <rect x={minX} y={minY} width={w} height={h} fill="url(#seaGrad)" />

      {board.tiles.map((t) => (
        <g key={t.id} onClick={() => tileClickable && onTileClick(t.id)} style={{ cursor: tileClickable ? "pointer" : "default" }}>
          <polygon points={hexPoints(t)} fill={`url(#tile-${t.resource})`} stroke={shade(RES_COLOR[t.resource], -0.4)} strokeWidth={2} />
          <ResourceTexture tile={t} />
          {t.number && (
            <>
              <circle cx={t.x} cy={t.y} r={17} fill="url(#tokenGrad)" stroke={INK} strokeWidth={1.5} filter="url(#softShadow)" />
              <text x={t.x} y={t.y + 5.5} textAnchor="middle" fontSize={16} fontWeight="800" fontFamily="Georgia, serif"
                fill={(t.number === 6 || t.number === 8) ? "#b23a2e" : INK}>{t.number}</text>
              <text x={t.x} y={t.y + 15} textAnchor="middle" fontSize={6} fill={(t.number === 6 || t.number === 8) ? "#b23a2e" : "#7a6b4d"}>
                {"•".repeat(6 - Math.abs(7 - t.number))}
              </text>
            </>
          )}
          {t.id === robberTileId && <RobberFigure x={t.x} y={t.y - 4} />}
        </g>
      ))}

      {board.ports.map((port) => {
        const v1 = board.vertices[port.v1], v2 = board.vertices[port.v2];
        const mx = (v1.x + v2.x) / 2, my = (v1.y + v2.y) / 2;
        const dx = mx * 1.18, dy = my * 1.18;
        const Glyph = port.type === "generic" ? null : RESOURCE_GLYPHS[port.type];
        return (
          <g key={port.edgeId}>
            <line x1={dx} y1={dy} x2={mx} y2={my} stroke={GOLD} strokeWidth={2} strokeDasharray="1,4" strokeLinecap="round" />
            <circle cx={dx} cy={dy} r={15} fill={PARCHMENT_DARK} stroke={GOLD} strokeWidth={1.5} filter="url(#softShadow)" />
            {Glyph ? <Glyph x={dx} y={dy - 3} scale={0.75} /> : <text x={dx} y={dy - 2} textAnchor="middle" fontSize={9} fill={INK}>⚓</text>}
            <text x={dx} y={dy + 10} textAnchor="middle" fontSize={7.5} fontWeight="700" fill={INK}>
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
        return (
          <g key={v.id}>
            {canPlace && (
              <circle cx={v.x} cy={v.y} r={9} fill={GOLD} fillOpacity={0.55} stroke={shade(GOLD, -0.3)} strokeWidth={1}
                onClick={() => onVertexClick(v.id)} style={{ cursor: "pointer" }}>
                <animate attributeName="r" values="8;10;8" dur="1.4s" repeatCount="indefinite" />
              </circle>
            )}
            {owner && owner.type === "settlement" && (
              <g filter="url(#softShadow)" onClick={() => canUpgrade && onVertexClick(v.id)} style={{ cursor: canUpgrade ? "pointer" : "default" }}>
                <polygon
                  points={`${v.x},${v.y - 9} ${v.x + 8},${v.y - 1} ${v.x + 8},${v.y + 8} ${v.x - 8},${v.y + 8} ${v.x - 8},${v.y - 1}`}
                  fill={owner.color} stroke={canUpgrade ? GOLD : shade(owner.color, -0.45)} strokeWidth={canUpgrade ? 2.5 : 1.3}
                />
              </g>
            )}
            {owner && owner.type === "city" && (
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
