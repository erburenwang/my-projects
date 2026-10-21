import { getWinner } from './topology.mjs';

export function createGameState(topology) {
  return {
    topologyId: topology.id,
    board: new Map(),
    moves: [],
    toMove: 1,
    status: 'playing',
    winner: null,
    winningLine: null,
  };
}

export function playMove(state, cellId, topology) {
  if (state.status !== 'playing') throw new Error('Game is finished');
  if (!topology.cells.includes(cellId)) throw new Error('Cell is outside this topology');
  if (state.board.has(cellId)) throw new Error('Cell is occupied');

  const board = new Map(state.board);
  board.set(cellId, state.toMove);
  const moves = [...state.moves, { cellId, player: state.toMove }];
  const outcome = getWinner(board, topology);
  const isDraw = !outcome && board.size >= topology.cells.length;

  return {
    ...state,
    board,
    moves,
    toMove: -state.toMove,
    status: outcome ? 'won' : isDraw ? 'draw' : 'playing',
    winner: outcome?.player ?? null,
    winningLine: outcome?.line ?? null,
  };
}

export function replayAt(state, ply, topology) {
  if (!Number.isInteger(ply) || ply < 0 || ply > state.moves.length) throw new RangeError('Replay position is outside the move history');
  let replay = createGameState(topology);
  for (const move of state.moves.slice(0, ply)) {
    if (replay.status !== 'playing') break;
    replay = playMove(replay, move.cellId, topology);
  }
  return replay;
}

export function undoMoves(state, count, topology) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('Undo count must be a non-negative integer');
  return replayAt(state, Math.max(0, state.moves.length - count), topology);
}
