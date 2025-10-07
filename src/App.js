import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

/* ========= Settings & Storage Keys ========= */
const LSK_SCORES   = "react_ttt_scores_v1";
const LSK_SETTINGS = "react_ttt_settings_v1";

/* ========= Game Helpers ========= */
const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

function calculateWinner(b) {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return { winner: b[a], line: [a, c, d] };
    }
  }
  return null;
}

function emptyIndices(b) {
  return b.map((v, i) => (v === "" ? i : null)).filter((i) => i != null);
}

function randomEmptyIndex(b) {
  const e = emptyIndices(b);
  if (!e.length) return null;
  return e[(Math.random() * e.length) | 0];
}

/* A tiny "good enough" move chooser:
   1) Win now if possible
   2) Block opponent if they can win next
   3) Take center
   4) Take a corner
   5) Otherwise random
*/
function bestMoveEasy(b, player) {
  const opponent = player === "X" ? "O" : "X";

  // 1) Immediate win
  for (const [a, c, d] of LINES) {
    const cells = [a, c, d];
    const marks = cells.filter((i) => b[i] === player).length;
    const empties = cells.filter((i) => b[i] === "");
    if (marks === 2 && empties.length === 1) return empties[0];
  }
  // 2) Immediate block
  for (const [a, c, d] of LINES) {
    const cells = [a, c, d];
    const marks = cells.filter((i) => b[i] === opponent).length;
    const empties = cells.filter((i) => b[i] === "");
    if (marks === 2 && empties.length === 1) return empties[0];
  }
  // 3) Center
  if (b[4] === "") return 4;
  // 4) Corners
  const corners = [0, 2, 6, 8].filter((i) => b[i] === "");
  if (corners.length) return corners[(Math.random() * corners.length) | 0];
  // 5) Random
  return randomEmptyIndex(b);
}

/* ========= UI Bits ========= */
function Square({ value, onClick, highlight, hint, show }) {
  return (
    <button
      className={`square ${highlight ? "win" : ""} ${hint ? "hint" : ""}`}
      onClick={onClick}
      aria-label={value ? `Cell ${value}` : "Empty cell"}
    >
      {show(value)}
    </button>
  );
}

function Board({ squares, onClick, winningLine, hintIndex, show }) {
  return (
    <div className="board" role="grid" aria-label="Tic Tac Toe board">
      {squares.map((val, i) => (
        <Square
          key={i}
          value={val}
          onClick={() => onClick(i)}
          highlight={winningLine?.includes(i)}
          hint={hintIndex === i}
          show={show}
        />
      ))}
    </div>
  );
}

/* ========= Main App ========= */
export default function App() {
  /* Game state */
  const [squares, setSquares] = useState(Array(9).fill(""));
  const [xIsNext, setXIsNext] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null); // "X" | "O" | null
  const [winningLine, setWinningLine] = useState(null);
  const [hintIndex, setHintIndex] = useState(null);
  const [aiThinking, setAiThinking] = useState(false);

  /* Scoreboard (persistent) */
  const [scores, setScores] = useState({ x: 0, o: 0, draws: 0 });

  /* Settings (persistent) */
  const [settings, setSettings] = useState({
    theme: "light",          // "light" | "dark"
    useEmojis: true,         // true => ❌/⭕
    mode: "PVP"              // "PVP" | "PVC_EASY"
  });

  const currentPlayer = xIsNext ? "X" : "O";
  const humanPlays = "X"; // keep simple: human is X when PVC_EASY
  const isAIsTurn = settings.mode === "PVC_EASY" && !gameOver && currentPlayer !== humanPlays;

  /* Load persisted */
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LSK_SCORES));
      if (s) setScores(s);
    } catch {}
    try {
      const st = JSON.parse(localStorage.getItem(LSK_SETTINGS));
      if (st) setSettings((p) => ({ ...p, ...st }));
    } catch {}
  }, []);

  /* Persist changes */
  useEffect(() => {
    localStorage.setItem(LSK_SCORES, JSON.stringify(scores));
  }, [scores]);

  useEffect(() => {
    localStorage.setItem(LSK_SETTINGS, JSON.stringify(settings));
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings]);

  /* Evaluate win/draw after each move */
  useEffect(() => {
    if (gameOver) return;
    const res = calculateWinner(squares);
    if (res) {
      setWinner(res.winner);
      setWinningLine(res.line);
      setGameOver(true);
      setScores((prev) =>
        res.winner === "X" ? { ...prev, x: prev.x + 1 } : { ...prev, o: prev.o + 1 }
      );
    } else if (!squares.includes("")) {
      setWinner(null);
      setWinningLine(null);
      setGameOver(true);
      setScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
    }
  }, [squares, gameOver]);

  /* AI move when needed */
  useEffect(() => {
    if (!isAIsTurn) return;
    setAiThinking(true);
    const id = setTimeout(() => {
      const i = bestMoveEasy(squares, currentPlayer);
      if (i != null) {
        const next = squares.slice();
        next[i] = currentPlayer;
        setSquares(next);
        setXIsNext((p) => !p);
      }
      setHintIndex(null);
      setAiThinking(false);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAIsTurn, squares, currentPlayer]);

  /* Display helpers */
  const show = (v) => (settings.useEmojis ? (v === "X" ? "❌" : v === "O" ? "⭕" : "") : (v || ""));
  const statusText = useMemo(() => {
    if (gameOver) {
      return winner ? `${show(winner)} wins!` : "It's a draw!";
    }
    if (aiThinking) {
      return `Computer (${show(currentPlayer)}) is thinking…`;
    }
    if (settings.mode === "PVC_EASY" && currentPlayer !== humanPlays) {
      return `Player ${show(currentPlayer)}'s turn (AI)`;
    }
    return `Player ${show(currentPlayer)}'s turn`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, winner, aiThinking, currentPlayer, settings.useEmojis, settings.mode]);

  /* Handlers */
  function handleClick(i) {
    if (gameOver || aiThinking) return;
    if (squares[i]) return;
    if (settings.mode === "PVC_EASY" && currentPlayer !== humanPlays) return; // AI's turn

    const next = squares.slice();
    next[i] = currentPlayer;
    setSquares(next);
    setXIsNext((p) => !p);
    setHintIndex(null);
  }

  function newGame() {
    setSquares(Array(9).fill(""));
    setXIsNext(true);
    setGameOver(false);
    setWinner(null);
    setWinningLine(null);
    setHintIndex(null);
    setAiThinking(false);
  }

  function resetScores() {
    setScores({ x: 0, o: 0, draws: 0 });
  }

  function showHint() {
    if (gameOver || aiThinking) return;
    const idx =
      settings.mode === "PVC_EASY"
        ? bestMoveEasy(squares, currentPlayer)
        : bestMoveEasy(squares, currentPlayer);
    setHintIndex(idx);
  }

  /* UI */
  return (
    <main className="page">
      <h1>React Tic Tac Toe</h1>
      <div className="status" aria-live="polite">{statusText}</div>

      <div className="controls">
        <label>
          Theme:&nbsp;
          <select
            value={settings.theme}
            onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value }))}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label style={{ marginLeft: 12 }}>
          Emojis:&nbsp;
          <input
            type="checkbox"
            checked={settings.useEmojis}
            onChange={(e) => setSettings((s) => ({ ...s, useEmojis: e.target.checked }))}
          />
        </label>

        <label style={{ marginLeft: 12 }}>
          Mode:&nbsp;
          <select
            value={settings.mode}
            onChange={(e) => {
              const mode = e.target.value;
              setSettings((s) => ({ ...s, mode }));
              // make sure turns reset cleanly when switching mode
              newGame();
            }}
          >
            <option value="PVP">Player vs Player</option>
            <option value="PVC_EASY">You vs Computer (Easy)</option>
          </select>
        </label>
      </div>

      <div className="scoreboard">
        <div>X Wins: {scores.x}</div>
        <div>O Wins: {scores.o}</div>
        <div>Draws: {scores.draws}</div>
      </div>

      <Board
        squares={squares}
        onClick={handleClick}
        winningLine={winningLine}
        hintIndex={hintIndex}
        show={show}
      />

      <div className="actions">
        <button onClick={newGame}>New Game</button>
        <button onClick={showHint}>Hint</button>
        <button onClick={resetScores}>Reset Scores</button>
      </div>

     
    </main>
  );
}
