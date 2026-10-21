import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { getTopology, getWinner, TOPOLOGY_IDS } from '../src/core/topology.mjs';
import { chooseMove } from '../src/core/ai.mjs';
import { extractTopologyFeatures } from '../src/core/topology-model.mjs';

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

function deriveSeed(seed, topologyId, gameIndex) {
  let value = seed ^ Math.imul(gameIndex + 1, 0x45d9f3b);
  for (const char of topologyId) value = Math.imul(value ^ char.charCodeAt(0), 0x01000193);
  return value >>> 0;
}

function makeOpening(topology, seed, length = 4) {
  const random = seededRandom(seed);
  const board = new Map();
  const cells = [];
  let player = 1;
  while (cells.length < length) {
    const frontier = new Set();
    if (!cells.length) frontier.add(topology.centerCell);
    else for (const cellId of cells) for (const neighbor of topology.neighbors.get(cellId) ?? []) frontier.add(neighbor);
    const available = [...frontier].filter((cellId) => !board.has(cellId));
    const candidates = (available.length ? available : topology.cells.filter((cellId) => !board.has(cellId)))
      .sort((a, b) => a.localeCompare(b))
      .map((cellId) => ({ cellId, random: random() }))
      .sort((a, b) => a.random - b.random);
    const selected = candidates.find(({ cellId }) => {
      board.set(cellId, player);
      const safe = !getWinner(board, topology);
      board.delete(cellId);
      return safe;
    })?.cellId;
    if (!selected) throw new Error(`无法为 ${topology.id} 生成无胜局开局`);
    board.set(selected, player);
    cells.push(selected);
    player = -player;
  }
  return cells;
}

function playSelfGame(topology, seed, budgetMs) {
  const opening = makeOpening(topology, seed);
  const board = new Map();
  const samples = [];
  let toMove = 1;
  for (const cellId of opening) {
    board.set(cellId, toMove);
    toMove = -toMove;
  }
  let winner = getWinner(board, topology)?.player ?? null;
  let plies = opening.length;
  while (!winner && plies < topology.cells.length) {
    samples.push({ player: toMove, features: extractTopologyFeatures({ board, toMove }, topology, toMove) });
    const result = chooseMove({ board, toMove }, topology, { difficulty: 'strong', budgetMs });
    if (!result.cellId || !topology.cells.includes(result.cellId) || board.has(result.cellId)) {
      throw new Error(`${topology.id}: 自我对弈引擎返回非法落点`);
    }
    board.set(result.cellId, toMove);
    plies += 1;
    winner = getWinner(board, topology)?.player ?? null;
    toMove = -toMove;
  }
  return {
    winner,
    plies,
    samples: samples.map((sample) => ({
      topologyId: topology.id,
      openingSeed: seed,
      split: seed % 5 === 0 ? 'validation' : 'train',
      player: sample.player,
      features: sample.features,
      label: winner === null ? 0 : winner === sample.player ? 1 : -1,
    })),
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const seed = Number(args.get('seed') ?? '20261017');
  const gamesPerTopology = Math.max(1, Number(args.get('games-per-topology') ?? '24'));
  const budgetMs = Math.max(1, Number(args.get('budget-ms') ?? '12'));
  const outputPath = resolve(args.get('output') ?? 'work/topology-training-data.jsonl');
  const rows = [];
  let totalGames = 0;
  for (let topologyIndex = 1; topologyIndex < TOPOLOGY_IDS.length; topologyIndex += 1) {
    const id = TOPOLOGY_IDS[topologyIndex];
    const topology = getTopology(id);
    let wins = 0;
    let draws = 0;
    let moves = 0;
    for (let gameIndex = 0; gameIndex < gamesPerTopology; gameIndex += 1) {
      const gameSeed = deriveSeed(seed, id, gameIndex);
      const game = playSelfGame(topology, gameSeed, budgetMs);
      if (game.winner) wins += 1;
      else draws += 1;
      moves += game.plies;
      rows.push(...game.samples);
      totalGames += 1;
    }
    console.log(`${id}: ${gamesPerTopology} 局自我对弈，${wins} 胜局、${draws} 和局，平均 ${(moves / gamesPerTopology).toFixed(1)} 手`);
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
  const trainCount = rows.filter((row) => row.split === 'train').length;
  const validationCount = rows.length - trainCount;
  console.log(`共 ${totalGames} 局 / ${rows.length} 个局面；训练 ${trainCount}，验证 ${validationCount}；写入 ${outputPath}`);
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
