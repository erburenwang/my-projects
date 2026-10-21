import { createTopologyPosition } from './topology-position.mjs';
import { findForcingMoves, generateTopologyCandidates } from './topology-evaluation.mjs';
import { createTopologyModelScorer } from './topology-model.mjs';
import { WINDOW_WEIGHTS } from './topology-weights.mjs';

const WIN = WINDOW_WEIGHTS[5];
const LEVELS = {
  casual: { depth: 2, budgetMs: 300, nodeLimit: 20_000, qDepth: 2 },
  standard: { depth: 4, budgetMs: 700, nodeLimit: 80_000, qDepth: 3 },
  strong: { depth: 6, budgetMs: 1400, nodeLimit: 240_000, qDepth: 4 },
  max: { depth: 9, budgetMs: 5000, nodeLimit: 750_000, qDepth: 5 },
};
const TT_LIMIT = 300_000;

function enterNode(stats, deadline) {
  if (stats.stoppedBy) return true;
  stats.nodes += 1;
  if (stats.nodes >= stats.nodeLimit) {
    stats.stoppedBy = 'node-limit';
    return true;
  }
  if ((stats.nodes & 31) === 0 && performance.now() >= deadline) {
    stats.timedOut = true;
    stats.stoppedBy = 'time';
    return true;
  }
  return false;
}

function scorePosition(position, topology, rootPlayer, modelScorer = null) {
  if (position.status === 'won') return position.winner === rootPlayer ? WIN : -WIN;
  if (position.status === 'draw') return 0;
  if (modelScorer) return modelScorer(position, topology, rootPlayer) * 50_000;
  return position.windowScore(rootPlayer);
}

function terminalScore(position, rootPlayer, ply) {
  if (position.status === 'won') return position.winner === rootPlayer ? WIN - ply : -WIN + ply;
  if (position.status === 'draw') return 0;
  return null;
}

function addKiller(killers, ply, cellId) {
  const pair = killers.get(ply) ?? [];
  if (pair[0] === cellId) return;
  killers.set(ply, [cellId, pair[0]].filter(Boolean).slice(0, 2));
}

function orderMoves(position, topology, candidates, rootPlayer, preferred, ply, killers, history, maximizing, modelScorer) {
  const killerMoves = killers.get(ply) ?? [];
  const ranked = [];
  for (const cellId of candidates) {
    if (position.board.has(cellId)) continue;
    position.push(cellId);
    let score = scorePosition(position, topology, rootPlayer, modelScorer);
    position.pop();
    if (!maximizing) score = -score;
    if (cellId === preferred) score += WIN * 2;
    else if (killerMoves.includes(cellId)) score += WIN / 4;
    score += history.get(`${position.toMove}:${cellId}`) ?? 0;
    ranked.push({ cellId, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.cellId.localeCompare(b.cellId));
  return ranked.map((move) => move.cellId);
}

function defensiveTacticalMoves(position, topology, player, ownForcing) {
  const moves = new Set(ownForcing.map((move) => move.cellId));
  const opponentForcing = findForcingMoves(position, topology, -player);
  for (const threat of opponentForcing) {
    moves.add(threat.cellId);
    for (const cellId of threat.winningReplies) moves.add(cellId);
  }
  return [...moves].filter((cellId) => !position.board.has(cellId));
}

function quiescence(position, topology, rootPlayer, alpha, beta, ply, remaining, deadline, stats, context) {
  if (enterNode(stats, deadline)) {
    return scorePosition(position, topology, rootPlayer, context.modelScorer);
  }
  const terminal = terminalScore(position, rootPlayer, ply);
  if (terminal !== null) return terminal;

  const player = position.toMove;
  const ownWins = position.immediateWinningMoves(player);
  if (ownWins.length) return player === rootPlayer ? WIN - ply : -WIN + ply;
  const opponentWins = position.immediateWinningMoves(-player);
  if (opponentWins.length > 1) return player === rootPlayer ? -WIN + ply + 1 : WIN - ply - 1;

  const maximizing = player === rootPlayer;
  const standPat = scorePosition(position, topology, rootPlayer, context.modelScorer);
  if (remaining <= 0) return standPat;
  if (maximizing) {
    if (standPat >= beta) return standPat;
    alpha = Math.max(alpha, standPat);
  } else {
    if (standPat <= alpha) return standPat;
    beta = Math.min(beta, standPat);
  }

  let candidates;
  if (opponentWins.length === 1) candidates = opponentWins;
  else {
    const ownForcing = findForcingMoves(position, topology, player);
    const threats = defensiveTacticalMoves(position, topology, player, ownForcing);
    candidates = threats;
    if (!candidates.length) return standPat;
  }
  const ordered = orderMoves(position, topology, candidates, rootPlayer, null, ply, context.killers, context.history, maximizing, context.modelScorer);
  let best = standPat;
  for (const cellId of ordered) {
    position.push(cellId);
    const score = quiescence(position, topology, rootPlayer, alpha, beta, ply + 1, remaining - 1, deadline, stats, context);
    position.pop();
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha || stats.stoppedBy) break;
  }
  return best;
}

function search(position, topology, rootPlayer, depth, alpha, beta, ply, deadline, stats, context, qDepth) {
  if (enterNode(stats, deadline)) {
    return scorePosition(position, topology, rootPlayer, context.modelScorer);
  }
  const terminal = terminalScore(position, rootPlayer, ply);
  if (terminal !== null) return terminal;

  const player = position.toMove;
  const ownWins = position.immediateWinningMoves(player);
  if (ownWins.length) return player === rootPlayer ? WIN - ply : -WIN + ply;

  const opponentWins = position.immediateWinningMoves(-player);
  if (opponentWins.length > 1) return player === rootPlayer ? -WIN + ply + 1 : WIN - ply - 1;
  if (depth <= 0) return quiescence(position, topology, rootPlayer, alpha, beta, ply, qDepth, deadline, stats, context);

  const maximizing = player === rootPlayer;
  const originalAlpha = alpha;
  const originalBeta = beta;
  const ttEntry = context.table.get(position.hash);
  if (ttEntry && ttEntry.depth >= depth) {
    stats.ttHits += 1;
    if (ttEntry.bound === 'exact') return ttEntry.score;
    if (ttEntry.bound === 'lower') alpha = Math.max(alpha, ttEntry.score);
    else beta = Math.min(beta, ttEntry.score);
    if (beta <= alpha) return ttEntry.score;
  }

  let candidates = opponentWins.length === 1
    ? opponentWins
    : generateTopologyCandidates(position, topology, player);
  if (!candidates.length) return 0;
  candidates = orderMoves(position, topology, candidates, rootPlayer, ttEntry?.bestMove, ply, context.killers, context.history, maximizing, context.modelScorer);

  let bestScore = maximizing ? -Infinity : Infinity;
  let bestMove = candidates[0];
  let searched = 0;
  for (const cellId of candidates) {
    position.push(cellId);
    let score;
    if (searched === 0) {
      score = search(position, topology, rootPlayer, depth - 1, alpha, beta, ply + 1, deadline, stats, context, qDepth);
    } else if (maximizing) {
      score = search(position, topology, rootPlayer, depth - 1, alpha, alpha + 1, ply + 1, deadline, stats, context, qDepth);
      if (score > alpha && score < beta && !stats.stoppedBy) {
        score = search(position, topology, rootPlayer, depth - 1, alpha, beta, ply + 1, deadline, stats, context, qDepth);
      }
    } else {
      score = search(position, topology, rootPlayer, depth - 1, beta - 1, beta, ply + 1, deadline, stats, context, qDepth);
      if (score < beta && score > alpha && !stats.stoppedBy) {
        score = search(position, topology, rootPlayer, depth - 1, alpha, beta, ply + 1, deadline, stats, context, qDepth);
      }
    }
    position.pop();
    searched += 1;
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = cellId;
    }
    if (maximizing) alpha = Math.max(alpha, bestScore);
    else beta = Math.min(beta, bestScore);
    if (beta <= alpha) {
      stats.cutoffs += 1;
      addKiller(context.killers, ply, cellId);
      const key = `${player}:${cellId}`;
      context.history.set(key, Math.min(1_000_000, (context.history.get(key) ?? 0) + depth * depth));
      break;
    }
    if (stats.stoppedBy) break;
  }

  if (!stats.stoppedBy && searched > 0) {
    if (context.table.size >= TT_LIMIT) context.table.clear();
    const bound = bestScore <= originalAlpha ? 'upper' : bestScore >= originalBeta ? 'lower' : 'exact';
    context.table.set(position.hash, { depth, score: bestScore, bound, bestMove });
  }
  return bestScore;
}

function chooseForcedLossMove(position, topology, player) {
  const candidates = generateTopologyCandidates(position, topology, player);
  let selected = candidates[0] ?? position.availableMoves()[0];
  let selectedThreats = Infinity;
  let selectedScore = -Infinity;
  for (const cellId of candidates) {
    position.push(cellId);
    const remainingThreats = position.immediateWinningMoves(-player).length;
    const score = scorePosition(position, topology, player);
    position.pop();
    if (remainingThreats < selectedThreats || (remainingThreats === selectedThreats && score > selectedScore)) {
      selected = cellId;
      selectedThreats = remainingThreats;
      selectedScore = score;
    }
  }
  return selected;
}

/**
 * Search a position using topology-native winning windows. `onInfo` is optional
 * and is called only after a complete iterative-deepening layer.
 */
export function chooseMove(position, topology, options = {}, onInfo = () => {}) {
  const startedAt = performance.now();
  const player = position.toMove;
  const level = LEVELS[options.difficulty] ?? LEVELS.strong;
  const nodeLimit = Math.max(1, Math.min(Math.floor(options.nodeLimit ?? level.nodeLimit), 2_000_000));
  const finish = (result) => ({ ...result, nodeLimit, elapsedMs: Math.round(performance.now() - startedAt) });
  const modelScorer = options.evaluationModel ? createTopologyModelScorer(options.evaluationModel) : null;
  const searchPosition = createTopologyPosition(position.board, player, topology);
  if (searchPosition.status !== 'playing') {
    return finish({
      cellId: null,
      reason: searchPosition.status === 'won' ? 'game-over' : 'draw',
      winner: searchPosition.winner,
      depth: 0,
      nodes: 0,
      timedOut: false,
      engine: '拓扑原生威胁搜索',
    });
  }
  const available = searchPosition.availableMoves();
  if (!available.length) return finish({ cellId: null, reason: 'draw', depth: 0, nodes: 0, timedOut: false, engine: '拓扑原生威胁搜索' });

  const wins = searchPosition.immediateWinningMoves(player);
  if (wins.length) return finish({ cellId: wins[0], reason: 'immediate-win', depth: 0, nodes: 0, timedOut: false, engine: '拓扑原生威胁搜索' });
  const opponentWins = searchPosition.immediateWinningMoves(-player);
  if (opponentWins.length === 1) {
    return finish({ cellId: opponentWins[0], reason: 'forced-block', depth: 0, nodes: 0, timedOut: false, engine: '拓扑原生威胁搜索' });
  }
  if (opponentWins.length > 1) {
    return finish({
      cellId: chooseForcedLossMove(searchPosition, topology, player),
      reason: 'forced-loss',
      depth: 0,
      nodes: 0,
      timedOut: false,
      engine: '拓扑原生威胁搜索',
    });
  }

  const budgetMs = Math.max(0, Math.min(options.budgetMs ?? level.budgetMs, 10_000));
  const deadline = performance.now() + budgetMs;
  const stats = { nodes: 0, nodeLimit, ttHits: 0, cutoffs: 0, timedOut: false, stoppedBy: null };
  const context = { table: new Map(), killers: new Map(), history: new Map(), modelScorer };
  let rootCandidates = generateTopologyCandidates(searchPosition, topology, player);
  if (!rootCandidates.length) rootCandidates = available.slice(0, 1);
  rootCandidates = orderMoves(searchPosition, topology, rootCandidates, player, null, 0, context.killers, context.history, true, modelScorer);
  let selected = rootCandidates[0] ?? available[0];
  let reachedDepth = 0;
  let completedScore = scorePosition(searchPosition, topology, player, modelScorer);

  for (let depth = 1; depth <= level.depth; depth += 1) {
    if (performance.now() >= deadline) {
      stats.timedOut = budgetMs > 0;
      if (stats.timedOut) stats.stoppedBy = 'time';
      break;
    }
    const iterationCandidates = orderMoves(searchPosition, topology, rootCandidates, player, selected, 0, context.killers, context.history, true, modelScorer);
    let iterationMove = null;
    let iterationScore = -Infinity;
    let alpha = -Infinity;
    let complete = true;
    let searched = 0;

    for (const cellId of iterationCandidates) {
      searchPosition.push(cellId);
      let score;
      if (searched === 0) {
        score = search(searchPosition, topology, player, depth - 1, alpha, Infinity, 1, deadline, stats, context, level.qDepth);
      } else {
        score = search(searchPosition, topology, player, depth - 1, alpha, alpha + 1, 1, deadline, stats, context, level.qDepth);
        if (score > alpha && !stats.stoppedBy) {
          score = search(searchPosition, topology, player, depth - 1, alpha, Infinity, 1, deadline, stats, context, level.qDepth);
        }
      }
      searchPosition.pop();
      searched += 1;
      if (stats.stoppedBy) {
        complete = false;
        break;
      }
      if (score > iterationScore) {
        iterationScore = score;
        iterationMove = cellId;
      }
      alpha = Math.max(alpha, iterationScore);
    }

    if (!complete || iterationMove === null) break;
    selected = iterationMove;
    completedScore = iterationScore;
    reachedDepth = depth;
    onInfo({ depth, nodes: stats.nodes, ttHits: stats.ttHits, cutoffs: stats.cutoffs, elapsedMs: Math.round(performance.now() - (deadline - budgetMs)), score: completedScore });
  }

  return finish({
    cellId: selected,
    reason: 'search',
    depth: reachedDepth,
    nodes: stats.nodes,
    ttHits: stats.ttHits,
    cutoffs: stats.cutoffs,
    timedOut: stats.timedOut,
    stoppedBy: stats.stoppedBy,
    engine: '拓扑原生威胁搜索',
  });
}
