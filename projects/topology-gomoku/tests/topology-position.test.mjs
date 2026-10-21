import test from 'node:test';
import assert from 'node:assert/strict';
import { getTopology, getImmediateWinningMoves, getWinner, TOPOLOGY_IDS } from '../src/core/topology.mjs';

const positionModule = await import('../src/core/topology-position.mjs').catch(() => null);

function slowForcingMoves(board, topology, player) {
  const candidates = new Set();
  for (const line of topology.linesOfFive) {
    let own = 0;
    let blocked = false;
    for (const cellId of line.cells) {
      const stone = board.get(cellId);
      if (stone === player) own += 1;
      else if (stone === -player) {
        blocked = true;
        break;
      }
    }
    if (!blocked && own >= 2) for (const cellId of line.cells) if (!board.has(cellId)) candidates.add(cellId);
  }

  const results = [];
  for (const cellId of candidates) {
    board.set(cellId, player);
    const winsNow = Boolean(getWinner(board, topology));
    const winningReplies = winsNow ? [] : getImmediateWinningMoves(board, player, topology);
    board.delete(cellId);
    if (winsNow || winningReplies.length) results.push({ cellId, winsNow, winningReplies });
  }
  return results.sort((left, right) =>
    Number(right.winsNow) - Number(left.winsNow)
    || right.winningReplies.length - left.winningReplies.length
    || left.cellId.localeCompare(right.cellId));
}

test('topology position has stable hashes independent of map insertion order', () => {
  assert.ok(positionModule?.createTopologyPosition, 'topology position module must exist');
  const topology = getTopology('plane');
  const entries = [[topology.cellAt(6, 7), 1], [topology.cellAt(8, 7), -1], [topology.cellAt(7, 8), 1]];
  const first = positionModule.createTopologyPosition(new Map(entries), -1, topology);
  const second = positionModule.createTopologyPosition(new Map([...entries].reverse()), -1, topology);
  const otherTurn = positionModule.createTopologyPosition(new Map(entries), 1, topology);

  assert.equal(first.hash, second.hash);
  assert.notEqual(first.hash, otherTurn.hash);
});

test('push and pop restore the board, turn, winner, and position hash', () => {
  assert.ok(positionModule?.createTopologyPosition, 'topology position module must exist');
  const topology = getTopology('plane');
  const board = new Map([1, 2, 3, 4].map((x) => [topology.cellAt(x, 7), 1]));
  const position = positionModule.createTopologyPosition(board, 1, topology);
  const initialHash = position.hash;

  position.push(topology.cellAt(5, 7));
  assert.equal(position.toMove, -1);
  assert.equal(position.status, 'won');
  assert.equal(position.winner, 1);
  assert.notEqual(position.hash, initialHash);

  position.pop();
  assert.equal(position.toMove, 1);
  assert.equal(position.status, 'playing');
  assert.equal(position.winner, null);
  assert.equal(position.hash, initialHash);
  assert.deepEqual([...position.board], [...board]);
});

test('topology position rejects occupied and out-of-board moves', () => {
  assert.ok(positionModule?.createTopologyPosition, 'topology position module must exist');
  const topology = getTopology('cylinder');
  const occupied = topology.cellAt(2, 2);
  const position = positionModule.createTopologyPosition(new Map([[occupied, 1]]), -1, topology);

  assert.throws(() => position.push(occupied), /occupied/i);
  assert.throws(() => position.push('not-a-cell'), /topology|cell/i);
});

test('incremental window scores and winning points stay exact through moves and rollback on every topology', () => {
  assert.ok(positionModule?.createTopologyPosition, 'topology position module must exist');
  const weights = [0, 1, 12, 180, 14_000, 1_000_000_000];
  const slowWindowScore = (board, topology, player) => topology.linesOfFive.reduce((total, line) => {
    let own = 0;
    let opponent = 0;
    for (const cellId of line.cells) {
      if (board.get(cellId) === player) own += 1;
      else if (board.get(cellId) === -player) opponent += 1;
    }
    if (own && opponent) return total;
    return total + (own ? weights[own] : -weights[opponent]);
  }, 0);

  for (const id of TOPOLOGY_IDS) {
    const topology = getTopology(id);
    const position = positionModule.createTopologyPosition(new Map(), 1, topology);
    let seed = 20_261_017;
    const cells = [...topology.cells];
    for (let i = cells.length - 1; i > 0; i -= 1) {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      const j = seed % (i + 1);
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const verify = () => {
      for (const player of [1, -1]) {
        assert.equal(position.windowScore(player), slowWindowScore(position.board, topology, player), `${id} score for ${player}`);
        assert.deepEqual(position.immediateWinningMoves(player), getImmediateWinningMoves(position.board, player, topology), `${id} winning points for ${player}`);
      }
    };

    verify();
    for (const cellId of cells.slice(0, 18)) {
      if (position.status !== 'playing') break;
      position.push(cellId);
      verify();
    }
    while (position.history.length) {
      position.pop();
      verify();
    }
    assert.equal(position.board.size, 0, `${id} rollback should restore the empty board`);
  }
});

test('incremental forcing moves match the full topology scan on every curved board', () => {
  assert.ok(positionModule?.createTopologyPosition, 'topology position module must exist');
  for (const id of TOPOLOGY_IDS.filter((topologyId) => topologyId !== 'plane')) {
    const topology = getTopology(id);
    const line = topology.linesOfFive.find((candidate) => candidate.cells.length === 5 && new Set(candidate.cells).size === 5);
    assert.ok(line, `${id} must have a distinct five-cell window`);
    const board = new Map(line.cells.slice(0, 3).map((cellId) => [cellId, 1]));
    for (const cellId of topology.cells) {
      if (board.size >= 7) break;
      if (!board.has(cellId) && !line.cells.includes(cellId)) board.set(cellId, -1);
    }
    const position = positionModule.createTopologyPosition(board, 1, topology);

    const verify = () => {
      for (const player of [1, -1]) {
        assert.deepEqual(position.forcingMoves(player), slowForcingMoves(new Map(position.board), topology, player), `${id} forcing moves for ${player}`);
      }
    };
    verify();

    position.push(line.cells[3]);
    verify();
    const reply = topology.cells.find((cellId) => !position.board.has(cellId)
      && !line.cells.includes(cellId)
      && !getWinner(new Map(position.board).set(cellId, -1), topology));
    assert.ok(reply, `${id} should have a legal reply outside the threatened window`);
    position.push(reply);
    verify();
    position.pop();
    verify();
    position.pop();
    verify();
  }
});
