import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chooseMove } from '../src/core/ai.mjs';
import { getTopology, getWinner, TOPOLOGY_IDS } from '../src/core/topology.mjs';

function parseArguments(argv) {
  const values = new Map();
  for (const item of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
    if (match) values.set(match[1], match[2] ?? 'true');
  }
  return values;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makeOpening(topology, seed, length) {
  const random = seededRandom(seed ^ Math.imul(topology.id.length, 0x45d9f3b));
  const board = new Map();
  const moves = [];
  let toMove = 1;
  while (moves.length < length) {
    const frontier = new Set();
    if (!moves.length) frontier.add(topology.centerCell);
    else for (const cellId of moves) for (const neighbor of topology.neighbors.get(cellId) ?? []) frontier.add(neighbor);
    let options = [...frontier].filter((cellId) => !board.has(cellId));
    if (!options.length) options = topology.cells.filter((cellId) => !board.has(cellId));
    options.sort((left, right) => left.localeCompare(right));
    options = options.map((cellId) => ({ cellId, key: random() })).sort((left, right) => left.key - right.key);

    let selected = null;
    for (const candidate of options) {
      board.set(candidate.cellId, toMove);
      const won = getWinner(board, topology);
      board.delete(candidate.cellId);
      if (!won) {
        selected = candidate.cellId;
        break;
      }
    }
    if (!selected) break;
    board.set(selected, toMove);
    moves.push(selected);
    toMove = -toMove;
  }
  return { board, moves, toMove };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const seed = Number(args.get('seed') ?? '20261017');
  const budgetMs = Math.max(1, Number(args.get('budget-ms') ?? '5000'));
  const openingPlies = Math.max(4, Number(args.get('opening-plies') ?? '8'));
  const outputPath = resolve(args.get('output') ?? 'reports/topology-search-depth.json');
  const topologyResults = {};

  for (const id of TOPOLOGY_IDS.slice(1)) {
    const topology = getTopology(id);
    const opening = makeOpening(topology, seed, openingPlies);
    const startedAt = performance.now();
    const result = chooseMove(opening, topology, { difficulty: 'max', budgetMs });
    topologyResults[id] = {
      size: `${topology.width}x${topology.height}`,
      opening: opening.moves,
      toMove: opening.toMove,
      selectedMove: result.cellId,
      completedDepth: result.depth,
      nodes: result.nodes,
      nodeLimit: result.nodeLimit,
      elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
      stoppedBy: result.stoppedBy ?? null,
    };
    console.log(`${id}: depth ${result.depth}, ${result.nodes} nodes, ${topologyResults[id].elapsedMs} ms`);
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    engine: '拓扑原生增量局面 + alpha-beta/PVS + 置换表 + 拓扑威胁扩展',
    seed,
    openingPlies,
    difficulty: 'max',
    budgetMs,
    topologies: topologyResults,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`报告已写入 ${outputPath}`);
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
