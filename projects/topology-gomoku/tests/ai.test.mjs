import test from 'node:test';
import assert from 'node:assert/strict';
import { getTopology, getImmediateWinningMoves, getWinner, TOPOLOGY_IDS } from '../src/core/topology.mjs';
import { chooseMove } from '../src/core/ai.mjs';
import { createAIEngine, mapMovesToRapfiBoard } from '../src/core/ai-engine.mjs';

function findDoubleThreatFixture(topology) {
  const lines = topology.linesOfFive;
  for (let firstIndex = 0; firstIndex < lines.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < lines.length; secondIndex += 1) {
      const first = lines[firstIndex].cells;
      const second = lines[secondIndex].cells;
      for (const firstWin of first) for (const secondWin of second) {
        const firstStones = first.filter((cellId) => cellId !== firstWin);
        const secondStones = second.filter((cellId) => cellId !== secondWin);
        if (firstStones.includes(secondWin) || secondStones.includes(firstWin)) continue;
        const board = new Map([...new Set([...firstStones, ...secondStones])].map((cellId) => [cellId, -1]));
        if (getWinner(board, topology)) continue;
        if (getImmediateWinningMoves(board, -1, topology).length > 1) return board;
      }
    }
  }
  return null;
}

test('takes an available immediate win before searching', () => {
  const topology = getTopology('plane');
  const board = new Map([2, 3, 4, 5].map((x) => [topology.cellAt(x, 7), 1]));
  const result = chooseMove({ board, toMove: 1 }, topology, { difficulty: 'max', budgetMs: 1 });
  assert.ok([topology.cellAt(1, 7), topology.cellAt(6, 7)].includes(result.cellId));
  assert.equal(result.reason, 'immediate-win');
});

test('blocks the opponent one-move win before heuristic scoring', () => {
  const topology = getTopology('plane');
  const board = new Map([[topology.cellAt(1, 7), 1], ...[2, 3, 4, 5].map((x) => [topology.cellAt(x, 7), -1])]);
  const result = chooseMove({ board, toMove: 1 }, topology, { difficulty: 'max', budgetMs: 1 });
  assert.ok([topology.cellAt(1, 7), topology.cellAt(6, 7)].includes(result.cellId));
  assert.equal(result.reason, 'forced-block');
});

test('uses topology-aware tactical checks across a seam', () => {
  const topology = getTopology('cylinder');
  const board = new Map([4, 5, 6, 0].map((x) => [topology.cellAt(x, 3), 1]));
  const result = chooseMove({ board, toMove: 1 }, topology, { difficulty: 'high', budgetMs: 10 });
  assert.ok([topology.cellAt(1, 3), topology.cellAt(3, 3)].includes(result.cellId));
  assert.equal(result.reason, 'immediate-win');
});

test('recognizes two independent opponent win points as a forced loss', () => {
  const topology = getTopology('cylinder');
  const board = new Map();
  for (const y of [1, 3]) {
    for (const x of [0, 1, 2, 3]) board.set(topology.cellAt(x, y), -1);
    board.set(topology.cellAt(6, y), 1);
  }
  const result = chooseMove({ board, toMove: 1 }, topology, { difficulty: 'max', budgetMs: 1 });
  assert.equal(result.reason, 'forced-loss');
  assert.ok(topology.cells.includes(result.cellId));
  assert.equal(board.has(result.cellId), false);
});

test('takes a topology-native immediate win in every non-planar journey', () => {
  for (const id of TOPOLOGY_IDS.filter((topologyId) => topologyId !== 'plane')) {
    const topology = getTopology(id);
    const fixture = topology.linesOfFive.find((line) => line.cells.length === 5);
    assert.ok(fixture, `${id} must expose a five-cell winning window`);
    const board = new Map(fixture.cells.slice(0, 4).map((cellId) => [cellId, 1]));
    const result = chooseMove({ board, toMove: 1 }, topology, { difficulty: 'max', budgetMs: 1 });
    const afterMove = new Map(board).set(result.cellId, 1);

    assert.equal(result.reason, 'immediate-win', id);
    assert.equal(getWinner(afterMove, topology)?.player, 1, id);
  }
});

test('blocks a unique topology-native immediate win in every journey', () => {
  for (const id of TOPOLOGY_IDS) {
    const topology = getTopology(id);
    let fixture = null;
    for (const line of topology.linesOfFive) {
      for (const omitted of line.cells) {
        const board = new Map(line.cells.filter((cellId) => cellId !== omitted).map((cellId) => [cellId, -1]));
        const wins = getImmediateWinningMoves(board, -1, topology);
        if (wins.length === 1) {
          fixture = { board, winCell: wins[0] };
          break;
        }
      }
      if (fixture) break;
    }
    assert.ok(fixture, `${id} must have a unique immediate defensive point`);
    const result = chooseMove({ board: fixture.board, toMove: 1 }, topology, { difficulty: 'max', budgetMs: 1 });

    assert.equal(result.cellId, fixture.winCell, id);
    assert.equal(result.reason, 'forced-block', id);
  }
});

test('reports an unavoidable immediate double threat in every non-planar journey', () => {
  for (const id of TOPOLOGY_IDS.filter((topologyId) => topologyId !== 'plane')) {
    const topology = getTopology(id);
    const board = findDoubleThreatFixture(topology);
    assert.ok(board, `${id} must provide a pair of independent immediate win points`);
    const threats = getImmediateWinningMoves(board, -1, topology);
    const result = chooseMove({ board, toMove: 1 }, topology, { difficulty: 'max', budgetMs: 1 });

    assert.ok(threats.length > 1, id);
    assert.equal(result.reason, 'forced-loss', id);
    assert.ok(topology.cells.includes(result.cellId), id);
    assert.equal(board.has(result.cellId), false, id);
  }
});

test('returns draw for a full plane with no five and reports an already won full board', () => {
  const topology = getTopology('plane');
  const drawBoard = new Map();
  for (const { x, y, cellId } of topology.chart) drawBoard.set(cellId, (x + 2 * y) % 5 < 2 ? 1 : -1);
  assert.equal(getWinner(drawBoard, topology), null);
  assert.equal(chooseMove({ board: drawBoard, toMove: 1 }, topology).reason, 'draw');

  const wonBoard = new Map(topology.cells.map((cellId) => [cellId, 1]));
  const result = chooseMove({ board: wonBoard, toMove: -1 }, topology);
  assert.equal(result.reason, 'game-over');
  assert.equal(result.winner, 1);
});

test('returns a legal move when a non-tactical search times out', () => {
  const topology = getTopology('plane');
  const board = new Map();
  for (let index = 0; index < 14; index += 1) {
    const x = (index * 7 + 2) % topology.width;
    const y = (index * 5 + 1) % topology.height;
    const cellId = topology.cellAt(x, y);
    if (!board.has(cellId)) board.set(cellId, index % 2 ? -1 : 1);
  }
  const result = chooseMove({ board, toMove: 1 }, topology, { difficulty: 'max', budgetMs: 1 });

  assert.ok(topology.cells.includes(result.cellId));
  assert.equal(board.has(result.cellId), false);
  assert.equal(typeof result.timedOut, 'boolean');
  assert.ok(Number.isFinite(result.elapsedMs));
  if (result.timedOut) assert.ok(result.elapsedMs >= 1, 'elapsedMs reports the full search time, not only the last completed layer');
});

test('honors an explicit search node ceiling and reports why the iteration stopped', () => {
  const topology = getTopology('cylinder');
  const board = new Map([
    [topology.cellAt(3, 3), 1],
    [topology.cellAt(4, 3), -1],
  ]);
  const result = chooseMove({ board, toMove: 1 }, topology, {
    difficulty: 'max',
    budgetMs: 100,
    nodeLimit: 1,
  });

  assert.ok(topology.cells.includes(result.cellId));
  assert.equal(board.has(result.cellId), false);
  assert.ok(result.nodes <= 1);
  assert.equal(result.stoppedBy, 'node-limit');
});

test('topology evaluation reports exact win points and nonzero threat pressure', async () => {
  const { evaluateTopology } = await import('../src/core/topology-evaluation.mjs').catch(() => ({}));
  assert.equal(typeof evaluateTopology, 'function', 'topology evaluator must exist');

  const topology = getTopology('cylinder');
  const line = topology.linesOfFive.find((candidate) => candidate.axis === 'east' && candidate.crossesSeam);
  assert.ok(line, 'cylinder must have a horizontal seam window');
  const board = new Map(line.cells.slice(0, 4).map((cell) => [cell, 1]));
  const evaluation = evaluateTopology({ board, toMove: -1 }, topology, 1);
  assert.ok(evaluation.score > 0);
  assert.ok(evaluation.winningMoves.some((cellId) => line.cells.includes(cellId)));
  assert.ok(evaluation.threats.fourWindows.length > 0);
});

test('topology evaluation distinguishes an open three from a blocked pattern', async () => {
  const { evaluateTopology } = await import('../src/core/topology-evaluation.mjs').catch(() => ({}));
  assert.equal(typeof evaluateTopology, 'function', 'topology evaluator must exist');
  const topology = getTopology('plane');
  const openBoard = new Map([6, 7, 8].map((x) => [topology.cellAt(x, 7), 1]));
  const blockedBoard = new Map([
    ...openBoard,
    [topology.cellAt(5, 7), -1],
    [topology.cellAt(9, 7), -1],
  ]);
  const open = evaluateTopology({ board: openBoard }, topology, 1);
  const blocked = evaluateTopology({ board: blockedBoard }, topology, 1);

  assert.ok(open.threats.threeWindows.length > 0);
  assert.ok(open.score > blocked.score);
  assert.ok(open.winningMoves.length < 2, 'an open three is not an immediate win');
});

test('finding forcing moves detects a seam-crossing fork with two winning replies', async () => {
  const { findForcingMoves } = await import('../src/core/topology-evaluation.mjs').catch(() => ({}));
  assert.equal(typeof findForcingMoves, 'function', 'topology forcing move search must exist');
  const topology = getTopology('cylinder');
  const board = new Map([5, 6, 0].map((x) => [topology.cellAt(x, 3), 1]));
  const forcingMoves = findForcingMoves(board, topology, 1);
  const expectedForks = [topology.cellAt(1, 3), topology.cellAt(4, 3)];

  for (const cellId of expectedForks) {
    assert.ok(forcingMoves.some((move) => move.cellId === cellId && move.winningReplies.length === 2), cellId);
  }
});

test('candidate generation includes every open win window beyond a two-cell radius', async () => {
  const { generateTopologyCandidates } = await import('../src/core/topology-evaluation.mjs').catch(() => ({}));
  assert.equal(typeof generateTopologyCandidates, 'function', 'topology candidate generation must exist');
  const topology = getTopology('plane');
  const board = new Map([[topology.cellAt(7, 7), 1]]);
  const candidates = generateTopologyCandidates(board, topology, 1);

  assert.ok(candidates.includes(topology.cellAt(10, 7)));
  assert.ok(candidates.every((cellId) => topology.cells.includes(cellId) && !board.has(cellId)));
});

test('search prefers a seam-crossing move that creates two winning replies', () => {
  const topology = getTopology('cylinder');
  const board = new Map([5, 6, 0].map((x) => [topology.cellAt(x, 3), 1]));
  const expectedForks = [topology.cellAt(1, 3), topology.cellAt(4, 3)];
  const result = chooseMove({ board, toMove: 1 }, topology, { difficulty: 'strong', budgetMs: 250 });

  assert.ok(expectedForks.includes(result.cellId));
});

test('maps shared cell ids into Rapfi coordinates and preserves stone colors', () => {
  const topology = getTopology('plane');
  const state = { toMove: -1, moves: [{ cellId: topology.cellAt(7, 7), player: 1 }] };
  assert.deepEqual(mapMovesToRapfiBoard(state, topology), [{ x: 7, y: 7, player: 1 }]);
});

test('engine wrapper takes immediate wins before starting Rapfi', async () => {
  const topology = getTopology('plane');
  const board = new Map([3, 4, 5, 6].map((x) => [topology.cellAt(x, 7), 1]));
  const state = { board, moves: [], toMove: 1 };
  const result = await createAIEngine().chooseMove(state, topology, { difficulty: 'max' });
  assert.equal(result.reason, 'immediate-win');
  assert.ok([topology.cellAt(2, 7), topology.cellAt(7, 7)].includes(result.cellId));
});

test('reuses initialized Rapfi and forwards its actual depth, node count, and progress', async () => {
  const originalWorker = globalThis.Worker;
  const workers = [];
  let searches = 0;
  class FakeRapfiWorker {
    onmessage = null;
    onerror = null;
    constructor() { workers.push(this); }
    postMessage(message) {
      if (message.type === 'init') {
        queueMicrotask(() => this.onmessage?.({ data: { type: 'ready', metadata: { version: 'fake-rapfi' } } }));
      } else if (message.type === 'search') {
        const index = searches++;
        const x = 7 + index;
        const depth = 6 + index;
        const nodes = 900 + index;
        queueMicrotask(() => this.onmessage?.({ data: { type: 'info', requestId: message.requestId, info: { depth, nodes, elapsedMs: 11 } } }));
        queueMicrotask(() => this.onmessage?.({ data: { type: 'result', requestId: message.requestId, x, y: 7, depth, nodes, elapsedMs: 12 } }));
      }
    }
    terminate() {}
  }
  globalThis.Worker = FakeRapfiWorker;
  try {
    const topology = getTopology('plane');
    const engine = createAIEngine();
    const progress = [];
    const first = await engine.chooseMove({ board: new Map(), moves: [], toMove: 1 }, topology, { budgetMs: 100 }, (info) => progress.push(info));
    const secondState = {
      board: new Map([[topology.cellAt(7, 7), 1]]),
      moves: [{ cellId: topology.cellAt(7, 7), player: 1 }],
      toMove: -1,
    };
    const second = await engine.chooseMove(secondState, topology, { budgetMs: 100 }, (info) => progress.push(info));

    assert.equal(workers.length, 1, 'the verified worker remains initialized across turns');
    assert.equal(first.depth, 6);
    assert.equal(first.nodes, 900);
    assert.equal(second.depth, 7);
    assert.equal(second.nodes, 901);
    assert.ok(progress.some((info) => info.depth === 7 && info.nodes === 901));
    engine.destroy();
  } finally {
    if (originalWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = originalWorker;
  }
});

test('overlapping Rapfi requests cancel the older request without stranding either promise', async () => {
  const originalWorker = globalThis.Worker;
  class FakeWorker {
    terminated = false;
    onmessage = null;
    onerror = null;
    postMessage(message) {
      if (message.type === 'init') {
        queueMicrotask(() => this.onmessage?.({ data: { type: 'ready', metadata: { version: 'fake' } } }));
      } else if (message.type === 'search') {
        setTimeout(() => {
          if (!this.terminated) this.onmessage?.({ data: { type: 'result', requestId: message.requestId, x: 7, y: 7 } });
        }, 0);
      }
    }
    terminate() { this.terminated = true; }
  }
  globalThis.Worker = FakeWorker;
  try {
    const topology = getTopology('plane');
    const state = { board: new Map(), moves: [], toMove: 1 };
    const engine = createAIEngine();
    const first = engine.chooseMove(state, topology, { budgetMs: 100 });
    const second = engine.chooseMove(state, topology, { budgetMs: 100 });
    await assert.rejects(first, { name: 'AbortError' });
    const result = await second;
    assert.equal(result.cellId, topology.cellAt(7, 7));
    assert.equal(result.engine, 'Rapfi WASM');
    engine.destroy();
  } finally {
    if (originalWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = originalWorker;
  }
});

test('a new Rapfi turn cancels an already-running search before replacing its worker', async () => {
  const originalWorker = globalThis.Worker;
  const workers = [];
  class FakeWorker {
    terminated = false;
    searches = 0;
    onmessage = null;
    onerror = null;
    constructor() { workers.push(this); }
    postMessage(message) {
      if (message.type === 'init') {
        queueMicrotask(() => this.onmessage?.({ data: { type: 'ready', metadata: { version: 'fake' } } }));
      } else if (message.type === 'search') {
        this.searches += 1;
        setTimeout(() => {
          if (!this.terminated) this.onmessage?.({ data: { type: 'result', requestId: message.requestId, x: 7, y: 7 } });
        }, 15);
      }
    }
    terminate() { this.terminated = true; }
  }
  globalThis.Worker = FakeWorker;
  try {
    const topology = getTopology('plane');
    const state = { board: new Map(), moves: [], toMove: 1 };
    const engine = createAIEngine();
    const first = engine.chooseMove(state, topology, { budgetMs: 100 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(workers[0].searches, 1, 'the first Rapfi search is already pending');

    const second = engine.chooseMove(state, topology, { budgetMs: 100 });
    await assert.rejects(first, { name: 'AbortError' });
    const result = await second;

    assert.equal(workers.length, 2);
    assert.equal(workers[0].terminated, true);
    assert.equal(workers[1].searches, 1);
    assert.equal(result.cellId, topology.cellAt(7, 7));
    assert.equal(result.engine, 'Rapfi WASM');
    engine.destroy();
  } finally {
    if (originalWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = originalWorker;
  }
});

test('topology worker progress reaches the caller and its result is validated', async () => {
  const originalWorker = globalThis.Worker;
  class FakeWorker {
    terminated = false;
    onmessage = null;
    onerror = null;
    postMessage(message) {
      if (message.type !== 'search') return;
      const cellId = getTopology('cylinder').cellAt(0, 0);
      queueMicrotask(() => this.onmessage?.({ data: { type: 'info', requestId: message.requestId, info: { depth: 2, nodes: 45, elapsedMs: 12 } } }));
      queueMicrotask(() => this.onmessage?.({ data: { type: 'result', requestId: message.requestId, result: { cellId, depth: 2, nodes: 45, timedOut: false } } }));
    }
    terminate() { this.terminated = true; }
  }
  globalThis.Worker = FakeWorker;
  try {
    const topology = getTopology('cylinder');
    const state = { board: new Map(), moves: [], toMove: 1 };
    const progress = [];
    const engine = createAIEngine();
    const result = await engine.chooseMove(state, topology, { difficulty: 'standard', budgetMs: 100 }, (info) => progress.push(info));

    assert.equal(result.cellId, topology.cellAt(0, 0));
    assert.equal(result.engine, '拓扑原生威胁搜索');
    const report = progress.find((info) => info.depth === 2);
    assert.ok(report);
    assert.equal(report.nodes, 45);
    engine.destroy();
  } finally {
    if (originalWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = originalWorker;
  }
});

test('canceling a topology search terminates its worker and rejects with AbortError', async () => {
  const originalWorker = globalThis.Worker;
  let spawned;
  class HangingWorker {
    terminated = false;
    onmessage = null;
    onerror = null;
    constructor() { spawned = this; }
    postMessage() {}
    terminate() { this.terminated = true; }
  }
  globalThis.Worker = HangingWorker;
  try {
    const topology = getTopology('torus');
    const engine = createAIEngine();
    const pending = engine.chooseMove({ board: new Map(), moves: [], toMove: 1 }, topology, { budgetMs: 100 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    engine.cancel();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(spawned.terminated, true);
    engine.destroy();
  } finally {
    if (originalWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = originalWorker;
  }
});

test('rejects an illegal topology-worker move instead of applying it', async () => {
  const originalWorker = globalThis.Worker;
  class IllegalWorker {
    onmessage = null;
    onerror = null;
    postMessage(message) {
      if (message.type !== 'search') return;
      const occupied = message.board[0][0];
      queueMicrotask(() => this.onmessage?.({ data: { type: 'result', requestId: message.requestId, result: { cellId: occupied } } }));
    }
    terminate() {}
  }
  globalThis.Worker = IllegalWorker;
  try {
    const topology = getTopology('klein');
    const occupied = topology.cellAt(2, 2);
    const state = { board: new Map([[occupied, 1]]), moves: [], toMove: -1 };
    const engine = createAIEngine();
    await assert.rejects(engine.chooseMove(state, topology, { budgetMs: 100 }), /非法落点/);
    engine.destroy();
  } finally {
    if (originalWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = originalWorker;
  }
});
