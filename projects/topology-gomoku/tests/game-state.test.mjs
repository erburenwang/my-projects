import test from 'node:test';
import assert from 'node:assert/strict';
import { getTopology } from '../src/core/topology.mjs';
import { createGameState, playMove, undoMoves, replayAt } from '../src/core/game-state.mjs';

test('applies moves immutably and alternates turns', () => {
  const topology = getTopology('plane');
  const initial = createGameState(topology);
  const one = playMove(initial, topology.cellAt(7, 7), topology);
  const two = playMove(one, topology.cellAt(7, 8), topology);
  assert.equal(initial.moves.length, 0);
  assert.equal(two.moves.length, 2);
  assert.equal(two.toMove, 1);
  assert.equal(two.board.get(topology.cellAt(7, 7)), 1);
  assert.equal(two.board.get(topology.cellAt(7, 8)), -1);
});

test('undo and replay restore the requested prefix of a game', () => {
  const topology = getTopology('plane');
  let state = createGameState(topology);
  for (const [x, y] of [[7, 7], [7, 8], [8, 8], [6, 6]]) state = playMove(state, topology.cellAt(x, y), topology);
  const undone = undoMoves(state, 2, topology);
  assert.equal(undone.moves.length, 2);
  assert.equal(undone.board.has(topology.cellAt(8, 8)), false);
  const replay = replayAt(state, 3, topology);
  assert.equal(replay.moves.length, 3);
  assert.equal(replay.board.has(topology.cellAt(8, 8)), true);
  assert.equal(replay.board.has(topology.cellAt(6, 6)), false);
});

test('rejects occupied cells and moves after a terminal result', () => {
  const topology = getTopology('plane');
  let state = createGameState(topology);
  state = playMove(state, topology.cellAt(2, 7), topology);
  assert.throws(() => playMove(state, topology.cellAt(2, 7), topology), /occupied/i);
  for (const [x, y] of [[0, 0], [3, 7], [0, 1], [4, 7], [1, 0], [5, 7], [1, 1]]) {
    state = playMove(state, topology.cellAt(x, y), topology);
  }
  state = playMove(state, topology.cellAt(6, 7), topology);
  assert.equal(state.status, 'won');
  assert.throws(() => playMove(state, topology.cellAt(9, 9), topology), /finished/i);
});
