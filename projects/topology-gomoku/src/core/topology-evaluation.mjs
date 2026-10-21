import { getImmediateWinningMoves, getWinner } from './topology.mjs';
import { createTopologyPosition } from './topology-position.mjs';
import { WINDOW_WEIGHTS } from './topology-weights.mjs';

export function evaluateTopology(position, topology, player) {
  if (player !== 1 && player !== -1) throw new TypeError('player must be 1 or -1');
  const board = position instanceof Map ? position : position?.board;
  if (!(board instanceof Map)) throw new TypeError('position must contain a board Map');

  const winner = getWinner(board, topology);
  const winningMoves = position instanceof Map || typeof position.immediateWinningMoves !== 'function'
    ? getImmediateWinningMoves(board, player, topology)
    : position.immediateWinningMoves(player);
  const opponentWinningMoves = position instanceof Map || typeof position.immediateWinningMoves !== 'function'
    ? getImmediateWinningMoves(board, -player, topology)
    : position.immediateWinningMoves(-player);
  if (winner) {
    return {
      score: winner.player === player ? WINDOW_WEIGHTS[5] : -WINDOW_WEIGHTS[5],
      winningMoves,
      threats: { fourWindows: [], threeWindows: [], opponentWinningMoves },
    };
  }

  let score = 0;
  const fourWindows = [];
  const threeWindows = [];
  const lineIndices = !(position instanceof Map) && position?.activeLineIndices instanceof Set
    ? position.activeLineIndices
    : topology.linesOfFive.keys();
  for (const lineIndex of lineIndices) {
    const line = topology.linesOfFive[lineIndex];
    if (!line) continue;
    let own = 0;
    let opponent = 0;
    const emptyCells = [];
    for (const cellId of line.cells) {
      const stone = board.get(cellId);
      if (stone === player) own += 1;
      else if (stone === -player) opponent += 1;
      else emptyCells.push(cellId);
    }
    if (own && opponent) continue;

    const count = own || opponent;
    if (count === 0) continue;
    const value = WINDOW_WEIGHTS[count] ?? 0;
    score += own ? value : -value;
    if (own === 4 && emptyCells.length === 1) fourWindows.push({ line, winningCell: emptyCells[0] });
    if (own === 3 && emptyCells.length === 2) threeWindows.push({ line, emptyCells });
  }

  if (winningMoves.length) score = Math.max(score, WINDOW_WEIGHTS[4] * winningMoves.length);
  if (opponentWinningMoves.length) score = Math.min(score, -WINDOW_WEIGHTS[4] * opponentWinningMoves.length);
  return {
    score,
    winningMoves,
    threats: { fourWindows, threeWindows, opponentWinningMoves },
  };
}

export function findForcingMoves(positionOrBoard, topology, player) {
  const board = positionOrBoard instanceof Map ? positionOrBoard : positionOrBoard?.board;
  if (!(board instanceof Map)) throw new TypeError('position must contain a board Map');
  if (player !== 1 && player !== -1) throw new TypeError('player must be 1 or -1');
  const position = typeof positionOrBoard?.forcingMoves === 'function'
    ? positionOrBoard
    : createTopologyPosition(board, player, topology);
  return position.forcingMoves(player);
}

export function generateTopologyCandidates(position, topology, player = position?.toMove ?? 1) {
  const board = position instanceof Map ? position : position?.board;
  if (!(board instanceof Map)) throw new TypeError('position must contain a board Map');
  if (player !== 1 && player !== -1) throw new TypeError('player must be 1 or -1');
  if (board.size === 0) return [topology.centerCell];

  const candidates = new Set([
    ...(position instanceof Map
      ? getImmediateWinningMoves(board, player, topology)
      : position.immediateWinningMoves(player)),
    ...(position instanceof Map
      ? getImmediateWinningMoves(board, -player, topology)
      : position.immediateWinningMoves(-player)),
  ]);
  const lineIndices = !(position instanceof Map) && position?.activeLineIndices instanceof Set
    ? position.activeLineIndices
    : topology.linesOfFive.keys();
  for (const lineIndex of lineIndices) {
    const line = topology.linesOfFive[lineIndex];
    if (!line) continue;
    for (const cellId of line.cells) if (!board.has(cellId)) candidates.add(cellId);
  }
  return [...candidates];
}
