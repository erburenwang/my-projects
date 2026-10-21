import { getImmediateWinningMoves, getWinner } from './topology.mjs';

const LEVELS = {
  casual: { depth: 1, rootMoves: 6, replyMoves: 4, budgetMs: 100 },
  standard: { depth: 2, rootMoves: 8, replyMoves: 5, budgetMs: 220 },
  strong: { depth: 3, rootMoves: 10, replyMoves: 6, budgetMs: 500 },
  max: { depth: 4, rootMoves: 12, replyMoves: 7, budgetMs: 1200 },
};

const LINE_WEIGHTS = [0, 5, 28, 260, 16000, 100000000];

function generateCandidates(board, topology) {
  const stones = [...board.keys()];
  if (!stones.length) return [topology.centerCell];
  const candidates = new Set();
  let frontier = new Set(stones);
  for (let ring = 0; ring < 2; ring += 1) {
    const next = new Set();
    for (const cell of frontier) for (const neighbor of topology.neighbors.get(cell) ?? []) {
      if (!board.has(neighbor)) candidates.add(neighbor);
      if (!board.has(neighbor)) next.add(neighbor);
    }
    frontier = next;
  }
  return [...candidates];
}

function evaluate(board, topology, player) {
  let score = 0;
  for (const { cells, crossesSeam } of topology.linesOfFive) {
    let ours = 0;
    let theirs = 0;
    for (const cell of cells) {
      const occupant = board.get(cell);
      if (occupant === player) ours += 1;
      else if (occupant === -player) theirs += 1;
    }
    if (ours && theirs) continue;
    const count = Math.max(ours, theirs);
    const weight = LINE_WEIGHTS[count] ?? 0;
    const value = crossesSeam ? Math.round(weight * 1.05) : weight;
    score += ours ? value : theirs ? -value : 0;
  }
  return score;
}

function orderedMoves(board, topology, player, rootPlayer, limit) {
  const moves = generateCandidates(board, topology);
  const maximizing = player === rootPlayer;
  const ranked = moves.map((cellId) => {
    board.set(cellId, player);
    const score = evaluate(board, topology, rootPlayer);
    board.delete(cellId);
    return { cellId, score };
  });
  ranked.sort((a, b) => maximizing ? b.score - a.score : a.score - b.score);
  return ranked.slice(0, limit).map((move) => move.cellId);
}

function minimax(board, topology, player, rootPlayer, depth, alpha, beta, deadline, stats, replyMoves) {
  stats.nodes += 1;
  if ((stats.nodes & 31) === 0 && performance.now() >= deadline) {
    stats.timedOut = true;
    return evaluate(board, topology, rootPlayer);
  }
  const winner = getWinner(board, topology);
  if (winner) return winner.player === rootPlayer ? 100000000 - stats.nodes : -100000000 + stats.nodes;
  if (depth === 0) return evaluate(board, topology, rootPlayer);

  const winningMoves = getImmediateWinningMoves(board, player, topology);
  if (winningMoves.length) return player === rootPlayer ? 100000000 - stats.nodes : -100000000 + stats.nodes;
  const candidates = orderedMoves(board, topology, player, rootPlayer, replyMoves);
  if (!candidates.length) return 0;

  let best = player === rootPlayer ? -Infinity : Infinity;
  for (const cellId of candidates) {
    board.set(cellId, player);
    const score = minimax(board, topology, -player, rootPlayer, depth - 1, alpha, beta, deadline, stats, replyMoves);
    board.delete(cellId);
    if (player === rootPlayer) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha || stats.timedOut) break;
  }
  return best;
}

export function chooseMove(position, topology, options = {}) {
  const board = new Map(position.board);
  const player = position.toMove;
  const available = topology.cells.filter((cell) => !board.has(cell));
  if (!available.length) return { cellId: null, reason: 'draw', depth: 0, nodes: 0, engine: 'topology-search' };

  const wins = getImmediateWinningMoves(board, player, topology);
  if (wins.length) return { cellId: wins[0], reason: 'immediate-win', depth: 0, nodes: 0, engine: 'topology-search' };

  const opponentWins = getImmediateWinningMoves(board, -player, topology);
  if (opponentWins.length === 1) return { cellId: opponentWins[0], reason: 'forced-block', depth: 0, nodes: 0, engine: 'topology-search' };

  const level = LEVELS[options.difficulty] ?? LEVELS.strong;
  const budgetMs = Math.max(0, Math.min(options.budgetMs ?? level.budgetMs, 2500));
  const deadline = performance.now() + budgetMs;
  const stats = { nodes: 0, timedOut: false };
  const candidates = orderedMoves(board, topology, player, player, level.rootMoves);
  let selected = candidates[0] ?? available[0];
  let selectedScore = -Infinity;
  let reachedDepth = 0;

  for (let depth = 1; depth <= level.depth; depth += 1) {
    if (performance.now() >= deadline && budgetMs > 0) break;
    let iterationMove = selected;
    let iterationScore = -Infinity;
    for (const cellId of candidates) {
      board.set(cellId, player);
      const score = minimax(board, topology, -player, player, depth - 1, -Infinity, Infinity, deadline, stats, level.replyMoves);
      board.delete(cellId);
      if (score > iterationScore) {
        iterationScore = score;
        iterationMove = cellId;
      }
      if (stats.timedOut) break;
    }
    if (iterationScore > selectedScore) {
      selected = iterationMove;
      selectedScore = iterationScore;
    }
    if (stats.timedOut) break;
    reachedDepth = depth;
  }

  return {
    cellId: selected,
    reason: opponentWins.length > 1 ? 'multiple-threats' : 'search',
    depth: reachedDepth,
    nodes: stats.nodes,
    timedOut: stats.timedOut,
    engine: 'topology-search',
  };
}
