import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chooseMove as chooseTopologyMove } from '../src/core/ai.mjs';
import { chooseMove as chooseBaselineMove } from '../src/core/ai-baseline.mjs';
import { getImmediateWinningMoves, getTopology, getWinner, TOPOLOGY_IDS } from '../src/core/topology.mjs';
import { collectMetrics, createMetrics } from './benchmark-metrics.mjs';

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

function topologySeed(seed, id, index) {
  let value = seed ^ Math.imul(index + 1, 0x45d9f3b);
  for (const char of id) value = Math.imul(value ^ char.charCodeAt(0), 0x01000193);
  return value >>> 0;
}

function makeOpening(topology, seed, length = 4) {
  const random = seededRandom(seed);
  const board = new Map();
  const cells = [];
  let toMove = 1;
  while (cells.length < length) {
    const frontier = new Set();
    if (!cells.length) frontier.add(topology.centerCell);
    else for (const cellId of cells) for (const neighbor of topology.neighbors.get(cellId) ?? []) frontier.add(neighbor);
    let options = [...frontier].filter((cellId) => !board.has(cellId));
    if (!options.length) options = topology.cells.filter((cellId) => !board.has(cellId));
    options.sort((a, b) => a.localeCompare(b));
    options = options.map((cellId) => ({ cellId, key: random() })).sort((a, b) => a.key - b.key);
    let selected = null;
    for (const candidate of options) {
      board.set(candidate.cellId, toMove);
      const winner = getWinner(board, topology);
      board.delete(candidate.cellId);
      if (!winner) { selected = candidate.cellId; break; }
    }
    if (!selected) throw new Error(`无法为 ${topology.id} 生成无胜局开局`);
    board.set(selected, toMove);
    cells.push(selected);
    toMove = -toMove;
  }
  return cells;
}

function findUniqueThreat(topology) {
  for (const line of topology.linesOfFive) {
    for (const omitted of line.cells) {
      const board = new Map(line.cells.filter((cellId) => cellId !== omitted).map((cellId) => [cellId, -1]));
      const wins = getImmediateWinningMoves(board, -1, topology);
      if (wins.length === 1) return { board, winCell: wins[0] };
    }
  }
  return null;
}

function findDoubleThreat(topology) {
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

function verifyTactics(topology, evaluationModel = null) {
  const options = { difficulty: 'max', budgetMs: 1, ...(evaluationModel ? { evaluationModel } : {}) };
  const directLine = topology.linesOfFive.find((line) => line.cells.length === 5);
  if (!directLine) throw new Error(`${topology.id}: missing five-cell window`);
  const winningBoard = new Map(directLine.cells.slice(0, 4).map((cellId) => [cellId, 1]));
  const winningMove = chooseTopologyMove({ board: winningBoard, toMove: 1 }, topology, options);
  if (getWinner(new Map(winningBoard).set(winningMove.cellId, 1), topology)?.player !== 1) {
    throw new Error(`${topology.id}: failed immediate-win tactical check`);
  }

  const uniqueThreat = findUniqueThreat(topology);
  if (!uniqueThreat) throw new Error(`${topology.id}: no unique mandatory block fixture`);
  const block = chooseTopologyMove({ board: uniqueThreat.board, toMove: 1 }, topology, options);
  if (block.reason !== 'forced-block' || block.cellId !== uniqueThreat.winCell) {
    throw new Error(`${topology.id}: failed mandatory-block tactical check`);
  }

  const doubleThreat = findDoubleThreat(topology);
  if (!doubleThreat) throw new Error(`${topology.id}: no double-threat fixture`);
  const forcedLoss = chooseTopologyMove({ board: doubleThreat, toMove: 1 }, topology, options);
  if (forcedLoss.reason !== 'forced-loss' || !topology.cells.includes(forcedLoss.cellId) || doubleThreat.has(forcedLoss.cellId)) {
    throw new Error(`${topology.id}: failed double-threat tactical check`);
  }

  const seamLine = topology.linesOfFive.find((line) => line.crossesSeam && line.cells.length === 5);
  if (!seamLine) throw new Error(`${topology.id}: no seam-crossing five-cell fixture`);
  const seamBoard = new Map(seamLine.cells.slice(0, 4).map((cellId) => [cellId, 1]));
  const seamMove = chooseTopologyMove({ board: seamBoard, toMove: 1 }, topology, options);
  if (getWinner(new Map(seamBoard).set(seamMove.cellId, 1), topology)?.player !== 1) {
    throw new Error(`${topology.id}: failed seam-crossing win tactical check`);
  }
  return { immediateWin: true, forcedBlock: true, doubleThreat: true, seamWin: true };
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return values.length % 2
    ? sorted[middle]
    : Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
}

function summarizeMetrics(value) {
  if (!value.moves) return { moves: 0, averageNodes: 0, averageDepth: 0, medianCompletedDepth: 0, timeoutRate: 0, nodeLimitRate: 0, nodesPerSecond: 0, averageMs: 0 };
  const nodeLimit = value.nodeLimits.length ? Math.max(...value.nodeLimits) : null;
  return {
    moves: value.moves,
    averageNodes: Math.round(value.nodes / value.moves),
    averageDepth: Number((value.depth / value.moves).toFixed(2)),
    medianCompletedDepth: median(value.completedDepths),
    timeoutRate: Number((value.timeouts / value.moves).toFixed(3)),
    nodeLimitRate: Number((value.nodeLimitStops / value.moves).toFixed(3)),
    nodeLimit,
    nodesPerSecond: value.elapsedMs > 0 ? Math.round(value.nodes / value.elapsedMs * 1000) : 0,
    averageMs: Number((value.elapsedMs / value.moves).toFixed(2)),
  };
}

function playGame(topology, opening, newPlayer, difficulty, budgetMs, evaluationModel = null, compareFeatureSearch = false) {
  const board = new Map();
  let toMove = newPlayer;
  for (const cellId of opening) {
    board.set(cellId, toMove);
    toMove = -toMove;
  }
  if (getWinner(board, topology)) throw new Error(`${topology.id}: generated opening already has a winner`);

  const newStats = createMetrics();
  const baselineStats = createMetrics();
  let winner = null;
  let ply = opening.length;
  while (ply < topology.cells.length) {
    const isNew = toMove === newPlayer;
    const chooser = isNew
      ? (position, boardTopology, options) => chooseTopologyMove(position, boardTopology, { ...options, ...(evaluationModel ? { evaluationModel } : {}) })
      : compareFeatureSearch
        ? chooseTopologyMove
        : chooseBaselineMove;
    const started = performance.now();
    const result = chooser({ board, toMove }, topology, { difficulty, budgetMs });
    const elapsedMs = performance.now() - started;
    collectMetrics(isNew ? newStats : baselineStats, result, elapsedMs);
    if (result.cellId === null) {
      if (topology.cells.some((cellId) => !board.has(cellId))) throw new Error(`${topology.id}: engine returned no move on a live board`);
      break;
    }
    if (!topology.cells.includes(result.cellId) || board.has(result.cellId)) {
      throw new Error(`${topology.id}: ${isNew ? 'new engine' : 'baseline'} returned illegal cell ${result.cellId}`);
    }
    board.set(result.cellId, toMove);
    ply += 1;
    const won = getWinner(board, topology);
    if (won) {
      winner = isNew ? 'new' : 'baseline';
      break;
    }
    toMove = -toMove;
  }
  return { winner: winner ?? 'draw', plies: ply, newStats, baselineStats };
}

function summarizeGames(games) {
  const newStats = createMetrics();
  const baselineStats = createMetrics();
  const byNewEngineSide = {
    first: { wins: 0, draws: 0, losses: 0 },
    second: { wins: 0, draws: 0, losses: 0 },
  };
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const game of games) {
    if (game.winner === 'new') wins += 1;
    else if (game.winner === 'baseline') losses += 1;
    else draws += 1;
    const side = game.newPlayer === 1 ? byNewEngineSide.first : byNewEngineSide.second;
    if (game.winner === 'new') side.wins += 1;
    else if (game.winner === 'baseline') side.losses += 1;
    else side.draws += 1;
    for (const key of ['moves', 'nodes', 'depth', 'timeouts', 'nodeLimitStops', 'elapsedMs']) {
      newStats[key] += game.newStats[key];
      baselineStats[key] += game.baselineStats[key];
    }
    newStats.depths.push(...game.newStats.depths);
    newStats.completedDepths.push(...game.newStats.completedDepths);
    newStats.nodeLimits.push(...game.newStats.nodeLimits);
    baselineStats.depths.push(...game.baselineStats.depths);
    baselineStats.completedDepths.push(...game.baselineStats.completedDepths);
    baselineStats.nodeLimits.push(...game.baselineStats.nodeLimits);
  }
  const scored = wins + draws / 2;
  return {
    games: games.length,
    wins,
    draws,
    losses,
    scoreRate: games.length ? Number((scored / games.length).toFixed(3)) : 0,
    byNewEngineSide,
    averagePlies: games.length ? Number((games.reduce((sum, game) => sum + game.plies, 0) / games.length).toFixed(1)) : 0,
    newEngine: summarizeMetrics(newStats),
    baseline: summarizeMetrics(baselineStats),
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const seed = Number(args.get('seed') ?? '20261017');
  const pairs = Math.max(1, Number(args.get('pairs') ?? '12'));
  const budgetMs = Math.max(1, Number(args.get('budget-ms') ?? '30'));
  const difficulty = args.get('difficulty') ?? 'standard';
  if (!['casual', 'standard', 'strong', 'max'].includes(difficulty)) throw new Error(`无效难度: ${difficulty}`);
  const compareFeatureSearch = args.get('compare') === 'feature';
  const modelPath = args.get('model') ? resolve(args.get('model')) : null;
  const planarControlPath = args.get('planar-control') ? resolve(args.get('planar-control')) : null;
  const evaluationModel = modelPath ? JSON.parse(await readFile(modelPath, 'utf8')) : null;
  const planarRapfiControl = planarControlPath
    ? JSON.parse(await readFile(planarControlPath, 'utf8'))
    : {
      status: 'not-run-in-node-benchmark',
      note: 'Rapfi is shipped and invoked through a browser Worker; this paired benchmark compares topology engines only and does not claim Rapfi parity.',
    };
  if (compareFeatureSearch && !evaluationModel) throw new Error('--compare=feature 需要同时传入 --model');
  const outputPath = resolve(args.get('output') ?? 'reports/topology-ai-benchmark.json');
  const topologyReports = {};

  for (let topologyIndex = 1; topologyIndex < TOPOLOGY_IDS.length; topologyIndex += 1) {
    const id = TOPOLOGY_IDS[topologyIndex];
    const topology = getTopology(id);
    const tacticalChecks = verifyTactics(topology, evaluationModel);
    const games = [];
    for (let openingIndex = 0; openingIndex < pairs; openingIndex += 1) {
      const opening = makeOpening(topology, topologySeed(seed, id, openingIndex));
      for (const newPlayer of [1, -1]) {
        const result = playGame(topology, opening, newPlayer, difficulty, budgetMs, evaluationModel, compareFeatureSearch);
        games.push({
          opening: openingIndex,
          swapped: newPlayer === -1,
          newPlayer,
          newPlayerSide: newPlayer === 1 ? 'first' : 'second',
          winner: result.winner,
          plies: result.plies,
          newStats: result.newStats,
          baselineStats: result.baselineStats,
        });
      }
    }
    topologyReports[id] = { size: `${topology.width}x${topology.height}`, tacticalChecks, summary: summarizeGames(games), games };
    console.log(`${id}: ${topologyReports[id].summary.wins} 胜 / ${topologyReports[id].summary.draws} 和 / ${topologyReports[id].summary.losses} 负，共 ${games.length} 局`);
  }

  const report = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    seed,
    pairsPerTopology: pairs,
    gamesPerTopology: pairs * 2,
    difficulty,
    budgetMsPerMove: budgetMs,
    rules: '自由五子棋；各拓扑使用其自身唯一五连窗口；双方同一拓扑、相同单步预算',
    engines: {
      new: evaluationModel
        ? 'topology-native iterative-deepening alpha-beta/PVS + transposition table + forcing quiescence + experimental 249x64x1 model'
        : 'topology-native iterative-deepening alpha-beta/PVS + incremental window/win/forcing indexes + transposition table + forcing quiescence',
      baseline: compareFeatureSearch
        ? 'same topology-native search and budgets with the hand-authored window feature evaluator'
        : 'ai-before-upgrade.mjs exact snapshot, used as the previous topology-search baseline',
      rapfiParity: 'not measured; planar Rapfi is not a same-topology reference for these wrapped boards',
    },
    model: evaluationModel ? { file: basename(modelPath), metadata: evaluationModel.metadata ?? null } : null,
    topologies: topologyReports,
    planarRapfiControl,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`报告已写入 ${outputPath}`);
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
