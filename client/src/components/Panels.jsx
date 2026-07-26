import React from "react";
import { styles } from "../styles.js";
import { RES_COLOR, RES_LABEL, RESOURCE_TYPES } from "../game/constants.js";
import { publicScore, totalResources, playerPortRate } from "../game/helpers.js";

export function PlayersPanel({ game, me }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Players</div>
      {game.players.map((p, i) => (
        <div key={p.id} style={{ ...styles.playerCard, borderColor: p.color, opacity: i === game.currentPlayerIndex && game.phase !== "lobby" ? 1 : 0.75 }}>
          <div style={{ ...styles.playerDot, background: p.color }} />
          <div style={styles.playerCardBody}>
            <div style={styles.playerCardName}>{p.name}{p.id === me.playerId ? " (you)" : ""}</div>
            <div style={styles.playerCardMeta}>
              Score: {publicScore(p)}{p.id === me.playerId ? ` (+${p.devCards.filter(c=>c.type==='victory').length} hidden)` : ""} · Roads: {p.roads.length} · Cards: {totalResources(p.resources)}
              {p.hasLongestRoad && " · 🛣️ Longest Road"}
              {p.hasLargestArmy && " · ⚔️ Largest Army"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DiscardModal({ player, picks, setPicks, onSubmit }) {
  const needed = Math.floor(totalResources(player.resources) / 2);
  const chosen = totalResources(picks);
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Discard {needed} Cards</div>
      {RESOURCE_TYPES.map((r) => (
        <div key={r} style={styles.discardRow}>
          <span>{RES_LABEL[r]} (have {player.resources[r]})</span>
          <div style={styles.stepper}>
            <button style={styles.miniBtn} onClick={() => setPicks({ ...picks, [r]: Math.max(0, picks[r] - 1) })}>-</button>
            <span>{picks[r]}</span>
            <button style={styles.miniBtn} onClick={() => setPicks({ ...picks, [r]: Math.min(player.resources[r], picks[r] + 1) })}>+</button>
          </div>
        </div>
      ))}
      <button style={styles.primaryBtn} disabled={chosen !== needed} onClick={onSubmit}>Discard {chosen}/{needed}</button>
    </div>
  );
}

export function YearOfPlentyModal({ picks, setPicks, onSubmit }) {
  function toggle(r) {
    if (picks.length < 2) setPicks([...picks, r]);
  }
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Year of Plenty — pick 2</div>
      <div style={styles.resRow}>
        {RESOURCE_TYPES.map((r) => (
          <button key={r} style={{ ...styles.resChip, background: RES_COLOR[r], cursor: "pointer" }} onClick={() => toggle(r)}>
            {RES_LABEL[r]}
          </button>
        ))}
      </div>
      <p style={styles.hint}>Chosen: {picks.map((p) => RES_LABEL[p]).join(", ") || "none"}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={styles.secondaryBtn} onClick={() => setPicks([])}>Reset</button>
        <button style={styles.primaryBtn} disabled={picks.length !== 2} onClick={() => onSubmit(picks)}>Confirm</button>
      </div>
    </div>
  );
}

export function MonopolyModal({ onSubmit }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Monopoly — pick a resource</div>
      <div style={styles.resRow}>
        {RESOURCE_TYPES.map((r) => (
          <button key={r} style={{ ...styles.resChip, background: RES_COLOR[r], cursor: "pointer" }} onClick={() => onSubmit(r)}>
            {RES_LABEL[r]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TradePanel({ myPlayer, board, onBankTrade, tradeGive, setTradeGive, tradeWant, setTradeWant, onProposeTrade, hasOpenOffer }) {
  const rate = tradeGive ? playerPortRate(board, myPlayer, tradeGive) : 4;
  return (
    <div>
      <div style={styles.tradeRow}>
        <div style={{ flex: 1 }}>
          <div style={styles.hint}>Give</div>
          <select style={styles.select} value={tradeGive || ""} onChange={(e) => setTradeGive(e.target.value || null)}>
            <option value="">—</option>
            {RESOURCE_TYPES.map((r) => <option key={r} value={r}>{RES_LABEL[r]} ({myPlayer.resources[r]})</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={styles.hint}>Want</div>
          <select style={styles.select} value={tradeWant || ""} onChange={(e) => setTradeWant(e.target.value || null)}>
            <option value="">—</option>
            {RESOURCE_TYPES.map((r) => <option key={r} value={r}>{RES_LABEL[r]}</option>)}
          </select>
        </div>
      </div>
      <button
        style={styles.secondaryBtn}
        disabled={!tradeGive || !tradeWant || myPlayer.resources[tradeGive] < rate}
        onClick={() => onBankTrade(tradeGive, tradeWant)}
      >
        Trade with Bank ({rate}:1)
      </button>
      <button
        style={styles.secondaryBtn}
        disabled={!tradeGive || !tradeWant || hasOpenOffer || myPlayer.resources[tradeGive] < 1}
        onClick={onProposeTrade}
      >
        Offer to Other Players (1:1)
      </button>
    </div>
  );
}
