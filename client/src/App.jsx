import React, { useState, useEffect, useMemo } from "react";
import { Copy, Check, Dice5, Home, Building2, Milestone, Users, Sparkles, ScrollText } from "lucide-react";
import { socket } from "./socket.js";
import { styles } from "./styles.js";
import { PARCHMENT, RES_COLOR, RES_LABEL, RESOURCE_TYPES, DEV_LABEL } from "./game/constants.js";
import { emptyResources } from "./game/helpers.js";
import BoardSVG from "./components/BoardSVG.jsx";
import { ResourceIcon } from "./components/ResourceGlyphs.jsx";
import { PlayersPanel, DiscardModal, YearOfPlentyModal, MonopolyModal, TradePanel } from "./components/Panels.jsx";

function saveSession(roomId, playerId, playerName) {
  try {
    localStorage.setItem("catan-session", JSON.stringify({ roomId, playerId, playerName }));
  } catch (e) { /* ignore (private browsing etc.) */ }
}
function loadSession() {
  try {
    const raw = localStorage.getItem("catan-session");
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function clearSession() {
  try { localStorage.removeItem("catan-session"); } catch (e) { /* ignore */ }
}

function currentSetupPlayerId(g) {
  return g.setupOrder[g.setupStep];
}

export default function App() {
  const [me, setMe] = useState(null); // { playerId }
  const [game, setGame] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [screen, setScreen] = useState("home"); // home | lobby | game
  const [copyOk, setCopyOk] = useState(false);
  const [buildMode, setBuildMode] = useState(null);
  const [tradeGive, setTradeGive] = useState(null);
  const [tradeWant, setTradeWant] = useState(null);
  const [yopPicks, setYopPicks] = useState([]);
  const [discardPicks, setDiscardPicks] = useState(emptyResources());
  const [actionError, setActionError] = useState("");
  const [reconnecting, setReconnecting] = useState(false);

  // On first load, try to resume a previous session (page refresh, dropped wifi, etc.)
  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    setReconnecting(true);
    socket.emit("rejoinRoom", { roomId: session.roomId, playerId: session.playerId }, (res) => {
      setReconnecting(false);
      if (!res || res.ok === false) { clearSession(); return; }
      setMe({ playerId: session.playerId });
      setGame(res.room);
      setScreen(res.room.phase === "lobby" ? "lobby" : "game");
    });
  }, []);

  useEffect(() => {
    function onGameState(room) {
      setGame(room);
      setScreen(room.phase === "lobby" ? "lobby" : "game");
    }
    socket.on("gameState", onGameState);
    return () => socket.off("gameState", onGameState);
  }, []);

  const myPlayer = useMemo(() => {
    if (!game || !me) return null;
    return game.players.find((p) => p.id === me.playerId) || null;
  }, [game, me]);

  const isMyTurn = !!(game && myPlayer && game.players[game.currentPlayerIndex]?.id === myPlayer.id);

  function act(event, payload = {}) {
    socket.emit(event, payload, (res) => {
      if (res && res.ok === false) setActionError(res.error || "Action failed.");
      else setActionError("");
    });
  }

  function handleCreate() {
    if (!nameInput.trim()) return;
    socket.emit("createRoom", { playerName: nameInput.trim() }, (res) => {
      setMe({ playerId: res.playerId });
      setGame(res.room);
      setScreen("lobby");
      saveSession(res.room.gameId, res.playerId, nameInput.trim());
    });
  }

  function handleJoin() {
    if (!nameInput.trim() || !joinInput.trim()) return;
    socket.emit("joinRoom", { roomId: joinInput.trim().toUpperCase(), playerName: nameInput.trim() }, (res) => {
      if (res?.ok === false) { setActionError(res.error); return; }
      setMe({ playerId: res.playerId });
      setGame(res.room);
      setScreen("lobby");
      saveSession(res.room.gameId, res.playerId, nameInput.trim());
    });
  }

  function onVertexClick(vertexId) {
    if (!game || !myPlayer) return;
    if (game.phase === "setup") {
      if (game.setupSubPhase === "settlement" && currentSetupPlayerId(game) === me.playerId) {
        act("placeSetupSettlement", { vertexId });
      }
      return;
    }
    if (buildMode === "settlement") act("buildSettlement", { vertexId });
    else if (buildMode === "city") act("buildCity", { vertexId });
    setBuildMode(null);
  }
  function onEdgeClick(edgeId) {
    if (!game || !myPlayer) return;
    if (game.phase === "setup") {
      if (game.setupSubPhase === "road" && currentSetupPlayerId(game) === me.playerId) {
        act("placeSetupRoad", { edgeId });
      }
      return;
    }
    if (buildMode === "road") act("buildRoad", { edgeId });
    if (!(game.pending?.type === "roadBuildingFree" && game.pending.remaining > 1)) setBuildMode(null);
  }
  function onTileClick(tileId) {
    if (!game) return;
    if (game.pending?.type === "robberMove" && isMyTurn) act("moveRobber", { tileId });
  }

  /* ============================== RENDER: RECONNECTING ============================== */
  if (reconnecting) {
    return <div style={{ ...styles.homeWrap, color: PARCHMENT }}>Reconnecting to your game…</div>;
  }

  /* ============================== RENDER: HOME ============================== */
  if (screen === "home") {
    return (
      <div style={styles.homeWrap}>
        <div style={styles.homeCard}>
          <div style={styles.compass}>⛵</div>
          <h1 style={styles.title}>CATAN</h1>
          <p style={styles.subtitle}>Settle the island. Trade wisely. Build your empire.</p>
          <input style={styles.input} placeholder="Your name" value={nameInput}
            onChange={(e) => setNameInput(e.target.value)} maxLength={16} />
          <button style={styles.primaryBtn} onClick={handleCreate} disabled={!nameInput.trim()}>
            Found a New Settlement (Create Game)
          </button>
          <div style={styles.dividerRow}>
            <div style={styles.hr} /><span style={styles.dividerText}>or join</span><div style={styles.hr} />
          </div>
          <input style={styles.input} placeholder="Game code" value={joinInput}
            onChange={(e) => setJoinInput(e.target.value.toUpperCase())} maxLength={5} />
          <button style={styles.secondaryBtn} onClick={handleJoin} disabled={!nameInput.trim() || !joinInput.trim()}>
            Join Game
          </button>
          {actionError && <p style={{ color: "crimson", fontSize: 12 }}>{actionError}</p>}
        </div>
      </div>
    );
  }

  if (!game) {
    return <div style={{ ...styles.homeWrap, color: PARCHMENT }}>Loading the map…</div>;
  }

  /* ============================== RENDER: LOBBY ============================== */
  if (screen === "lobby") {
    return (
      <div style={styles.homeWrap}>
        <div style={styles.homeCard}>
          <h1 style={styles.title}>Lobby</h1>
          <div style={styles.codeRow}>
            <span style={styles.codeText}>{game.gameId}</span>
            <button style={styles.iconBtn} onClick={() => {
              navigator.clipboard?.writeText(game.gameId);
              setCopyOk(true);
              setTimeout(() => setCopyOk(false), 1500);
            }}>
              {copyOk ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p style={styles.subtitle}>Share this code. 2–6 sailors may join.</p>
          <div style={styles.playerList}>
            {game.players.map((p, i) => (
              <div key={p.id} style={styles.playerRow}>
                <Users size={16} />
                <span>{p.name}{p.id === me.playerId ? " (you)" : ""}{i === 0 ? " · host" : ""}</span>
              </div>
            ))}
          </div>
          {game.players[0]?.id === me.playerId ? (
            <button style={styles.primaryBtn} onClick={() => act("startGame")} disabled={game.players.length < 2}>
              {game.players.length < 2 ? "Waiting for more players…" : "Set Sail (Start Game)"}
            </button>
          ) : (
            <p style={styles.subtitle}>Waiting for the host to start the game…</p>
          )}
          {actionError && <p style={{ color: "crimson", fontSize: 12 }}>{actionError}</p>}
        </div>
      </div>
    );
  }

  /* ============================== RENDER: GAME ============================== */
  const board = game.board;
  const setupPid = game.phase === "setup" ? currentSetupPlayerId(game) : null;
  const activePlayer = game.players[game.currentPlayerIndex];

  return (
    <div style={styles.gameWrap}>
      <div style={styles.topBar}>
        <div style={styles.topBarTitle}>⛵ CATAN <span style={styles.topBarCode}>#{game.gameId}</span></div>
        <button
          style={{ ...styles.iconBtn, fontSize: 11, padding: "4px 10px" }}
          onClick={() => { clearSession(); window.location.reload(); }}
        >
          Leave
        </button>
        <div style={styles.turnBanner}>
          {game.phase === "ended"
            ? `🏆 ${game.players.find((p) => p.id === game.winnerId)?.name} wins!`
            : game.phase === "setup"
            ? `Setup — ${game.players.find((p) => p.id === setupPid)?.name} places a ${game.setupSubPhase}`
            : `${activePlayer.name}'s turn ${isMyTurn ? "(you)" : ""}`}
        </div>
      </div>

      <div style={styles.mainArea}>
        <div style={styles.boardPanel}>
          <BoardSVG
            board={board}
            robberTileId={game.robberTileId}
            players={game.players}
            buildMode={buildMode}
            phase={game.phase}
            setupSubPhase={game.setupSubPhase}
            isMyTurn={isMyTurn}
            isMySetupTurn={game.phase === "setup" && setupPid === me.playerId}
            lastPlacedSettlement={game.lastPlacedSettlement}
            myPlayer={myPlayer}
            pending={game.pending}
            onVertexClick={onVertexClick}
            onEdgeClick={onEdgeClick}
            onTileClick={onTileClick}
          />
        </div>

        <div style={styles.sidePanel}>
          <PlayersPanel game={game} me={me} />

          {myPlayer && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>Your Resources</div>
              <div style={styles.resRow}>
                {RESOURCE_TYPES.map((r) => (
                  <div key={r} style={{ ...styles.resChip, background: RES_COLOR[r] }}>
                    <div style={{ background: "#fff", borderRadius: "50%", padding: 2, marginBottom: 2 }}>
                      <ResourceIcon resource={r} size={16} />
                    </div>
                    <span>{RES_LABEL[r]}</span>
                    <b>{myPlayer.resources[r]}</b>
                  </div>
                ))}
              </div>
              {myPlayer.devCards.length > 0 && (
                <div style={styles.devRow}>
                  {myPlayer.devCards.map((c) => (
                    <div key={c.id} style={styles.devChip}>
                      {DEV_LABEL[c.type]}
                      {c.type !== "victory" && isMyTurn && game.phase === "playing" && !game.hasPlayedDevCardThisTurn && !game.pending && c.boughtTurn !== game.turnNumber && (
                        <button style={styles.miniBtn} onClick={() => act("playDevCard", { cardId: c.id, type: c.type })}>Play</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {game.phase === "playing" && isMyTurn && !game.pending && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>Actions</div>
              {!game.dice ? (
                <button style={styles.primaryBtn} onClick={() => act("rollDice")}>
                  <Dice5 size={16} style={{ marginRight: 6 }} />Roll Dice
                </button>
              ) : (
                <>
                  <div style={styles.actionGrid}>
                    <button style={buildMode === "road" ? styles.toggleBtnActive : styles.toggleBtn} onClick={() => setBuildMode(buildMode === "road" ? null : "road")}>
                      <Milestone size={14} /> Road (1🌲1🧱)
                    </button>
                    <button style={buildMode === "settlement" ? styles.toggleBtnActive : styles.toggleBtn} onClick={() => setBuildMode(buildMode === "settlement" ? null : "settlement")}>
                      <Home size={14} /> Settlement
                    </button>
                    <button style={buildMode === "city" ? styles.toggleBtnActive : styles.toggleBtn} onClick={() => setBuildMode(buildMode === "city" ? null : "city")}>
                      <Building2 size={14} /> City
                    </button>
                    <button style={styles.toggleBtn} onClick={() => act("buyDevCard")}>
                      <Sparkles size={14} /> Dev Card ({game.devDeck.length} left)
                    </button>
                  </div>
                  <button style={styles.secondaryBtn} onClick={() => act("endTurn")}>End Turn</button>
                </>
              )}
            </div>
          )}

          {game.pending?.type === "discard" && game.pending.remaining.includes(me.playerId) && (
            <DiscardModal
              player={myPlayer}
              picks={discardPicks}
              setPicks={setDiscardPicks}
              onSubmit={() => { act("submitDiscard", { picks: discardPicks }); setDiscardPicks(emptyResources()); }}
            />
          )}

          {game.pending?.type === "robberMove" && isMyTurn && (
            <div style={styles.card}><div style={styles.cardTitle}>Move the Robber</div><p style={styles.hint}>Click a tile on the board.</p></div>
          )}
          {game.pending?.type === "robberSteal" && isMyTurn && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>Steal From</div>
              {game.pending.victims.map((vid) => {
                const v = game.players.find((p) => p.id === vid);
                return <button key={vid} style={styles.secondaryBtn} onClick={() => act("stealFrom", { victimId: vid })}>{v.name}</button>;
              })}
            </div>
          )}
          {game.pending?.type === "yearOfPlenty" && isMyTurn && (
            <YearOfPlentyModal
              picks={yopPicks}
              setPicks={setYopPicks}
              onSubmit={(picks) => { act("resolveYearOfPlenty", { picks }); setYopPicks([]); }}
            />
          )}
          {game.pending?.type === "monopoly" && isMyTurn && (
            <MonopolyModal onSubmit={(resource) => act("resolveMonopoly", { resource })} />
          )}
          {game.pending?.type === "roadBuildingFree" && isMyTurn && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>Road Building</div>
              <p style={styles.hint}>Place {game.pending.remaining} free road{game.pending.remaining > 1 ? "s" : ""} on the board.</p>
              <button style={buildMode === "road" ? styles.toggleBtnActive : styles.toggleBtn} onClick={() => setBuildMode("road")}>Select Road</button>
            </div>
          )}

          {game.phase === "playing" && isMyTurn && !game.pending && game.dice && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>Trade</div>
              <TradePanel
                myPlayer={myPlayer}
                board={board}
                onBankTrade={(give, want) => act("bankTrade", { give, want })}
                tradeGive={tradeGive}
                setTradeGive={setTradeGive}
                tradeWant={tradeWant}
                setTradeWant={setTradeWant}
                onProposeTrade={() => { if (tradeGive && tradeWant) act("proposeTrade", { give: tradeGive, want: tradeWant }); setTradeGive(null); setTradeWant(null); }}
                hasOpenOffer={game.tradeOffers.some((o) => o.status === "open")}
              />
            </div>
          )}

          {game.tradeOffers.filter((o) => o.status === "open").map((offer) => {
            const proposer = game.players.find((p) => p.id === offer.from);
            return (
              <div key={offer.id} style={styles.card}>
                <div style={styles.cardTitle}>Trade Offer</div>
                <p style={styles.hint}>{proposer.name} offers {RES_LABEL[offer.give]} → wants {RES_LABEL[offer.want]}</p>
                {offer.from !== me.playerId ? (
                  <button style={styles.primaryBtn} onClick={() => act("acceptTrade", { offerId: offer.id })} disabled={myPlayer.resources[offer.want] < 1}>Accept</button>
                ) : (
                  <button style={styles.secondaryBtn} onClick={() => act("cancelTrade", { offerId: offer.id })}>Cancel Offer</button>
                )}
              </div>
            );
          })}

          {actionError && (
            <div style={{ ...styles.card, borderColor: "crimson" }}>
              <span style={{ color: "crimson", fontSize: 12 }}>{actionError}</span>
            </div>
          )}

          <div style={styles.card}>
            <div style={styles.cardTitle}><ScrollText size={14} style={{ marginRight: 4 }} />Log</div>
            <div style={styles.logBox}>
              {[...game.log].slice(-30).reverse().map((l, i) => <div key={i} style={styles.logLine}>{l}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
