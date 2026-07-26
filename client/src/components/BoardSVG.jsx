import React from "react";
import { INK, PARCHMENT, PARCHMENT_DARK, SEA, GOLD, RES_COLOR } from "../game/constants.js";

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
    // distance rule: no neighboring vertex may be occupied
    if (v.neighborVertexIds.some((nb) => vertexOwner[nb])) return false;
    if (phase === "setup") return true; // no road-connection requirement during setup
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

  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} style={styles.svg}>
      <rect x={minX} y={minY} width={w} height={h} fill={SEA} />
      {board.tiles.map((t) => (
        <g key={t.id} onClick={() => tileClickable && onTileClick(t.id)} style={{ cursor: tileClickable ? "pointer" : "default" }}>
          <polygon points={hexPoints(t)} fill={RES_COLOR[t.resource]} stroke={INK} strokeWidth={2} />
          {t.number && (
            <>
              <circle cx={t.x} cy={t.y} r={16} fill={PARCHMENT} stroke={INK} strokeWidth={1.5} />
              <text x={t.x} y={t.y + 5} textAnchor="middle" fontSize={15} fontWeight="700"
                fill={(t.number === 6 || t.number === 8) ? "#b23a2e" : INK}>{t.number}</text>
            </>
          )}
          {t.id === robberTileId && (
            <text x={t.x} y={t.y - 20} textAnchor="middle" fontSize={22}>🗿</text>
          )}
        </g>
      ))}

      {board.ports.map((port) => {
        const v1 = board.vertices[port.v1], v2 = board.vertices[port.v2];
        const mx = (v1.x + v2.x) / 2, my = (v1.y + v2.y) / 2;
        const dx = mx * 1.18, dy = my * 1.18;
        return (
          <g key={port.edgeId}>
            <line x1={dx} y1={dy} x2={mx} y2={my} stroke={GOLD} strokeWidth={2} strokeDasharray="3,3" />
            <circle cx={dx} cy={dy} r={13} fill={PARCHMENT_DARK} stroke={GOLD} strokeWidth={1.5} />
            <text x={dx} y={dy + 4} textAnchor="middle" fontSize={9} fontWeight="700" fill={INK}>
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
          <line
            key={e.id}
            x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
            stroke={owner || (valid ? GOLD : "transparent")}
            strokeWidth={owner ? 7 : 10}
            strokeOpacity={owner ? 1 : valid ? 0.45 : 0}
            strokeLinecap="round"
            onClick={() => valid && onEdgeClick(e.id)}
            style={{ cursor: valid ? "pointer" : "default" }}
          />
        );
      })}

      {board.vertices.map((v) => {
        const owner = vertexOwner[v.id];
        const canPlace = !owner && settlementModeActive && emptyVertexValid(v);
        const canUpgrade = cityModeActive && owner && owner.type === "settlement" && owner.playerId === myPlayer?.id;
        return (
          <g key={v.id}>
            {canPlace && (
              <circle cx={v.x} cy={v.y} r={9} fill={GOLD} fillOpacity={0.5}
                onClick={() => onVertexClick(v.id)} style={{ cursor: "pointer" }} />
            )}
            {owner && owner.type === "settlement" && (
              <rect x={v.x - 7} y={v.y - 7} width={14} height={14} fill={owner.color}
                stroke={canUpgrade ? GOLD : INK} strokeWidth={canUpgrade ? 3 : 1.5}
                onClick={() => canUpgrade && onVertexClick(v.id)}
                style={{ cursor: canUpgrade ? "pointer" : "default" }} />
            )}
            {owner && owner.type === "city" && (
              <rect x={v.x - 10} y={v.y - 10} width={20} height={20} fill={owner.color} stroke={"#f5e6b0"} strokeWidth={2} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

