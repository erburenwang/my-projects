import { getWinner } from './topology.mjs';
import { scoreWindowCounts } from './topology-weights.mjs';

const MASK_64 = (1n << 64n) - 1n;
const TURN_KEY = 0x9e3779b97f4a7c15n;
const zobristCache = new Map();

function hashText(value) {
  let hash = 0xcbf29ce484222325n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0));
    hash = (hash * 0x100000001b3n) & MASK_64;
  }
  return hash;
}

function mix64(value) {
  let mixed = (value + TURN_KEY) & MASK_64;
  mixed = ((mixed ^ (mixed >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK_64;
  mixed = ((mixed ^ (mixed >> 27n)) * 0x94d049bb133111ebn) & MASK_64;
  return (mixed ^ (mixed >> 31n)) & MASK_64;
}

function adjustWinningMoveReference(winningMoves, cellId, lineIndex, delta) {
  if (!cellId) return;
  const lineIndexes = winningMoves.get(cellId) ?? new Set();
  if (delta > 0) lineIndexes.add(lineIndex);
  else lineIndexes.delete(lineIndex);
  if (lineIndexes.size) winningMoves.set(cellId, lineIndexes);
  else winningMoves.delete(cellId);
}

function cellsByFirstLine(references, lines) {
  return [...references]
    .map(([cellId, lineIndexes]) => {
      const firstLineIndex = Math.min(...lineIndexes);
      return { cellId, firstLineIndex, cellIndex: lines[firstLineIndex].cells.indexOf(cellId) };
    })
    .sort((left, right) => left.firstLineIndex - right.firstLineIndex || left.cellIndex - right.cellIndex)
    .map(({ cellId }) => cellId);
}

function updateWinningMoveReferences(winningMovesByPlayer, board, lineIndex, line, counts, delta) {
  if (counts[0] === 4 && counts[1] === 0) {
    adjustWinningMoveReference(winningMovesByPlayer.get(1), line.cells.find((cellId) => !board.has(cellId)), lineIndex, delta);
  }
  if (counts[1] === 4 && counts[0] === 0) {
    adjustWinningMoveReference(winningMovesByPlayer.get(-1), line.cells.find((cellId) => !board.has(cellId)), lineIndex, delta);
  }
}

function createZobrist(topology) {
  const key = `${topology.id}:${topology.cells.join('|')}`;
  if (zobristCache.has(key)) return zobristCache.get(key);
  const seed = hashText(key);
  const stoneKeys = new Map();
  topology.cells.forEach((cellId, index) => {
    stoneKeys.set(`${cellId}:1`, mix64(seed ^ BigInt(index * 2)));
    stoneKeys.set(`${cellId}:-1`, mix64(seed ^ BigInt(index * 2 + 1)));
  });
  const table = { stoneKeys };
  zobristCache.set(key, table);
  return table;
}

export function createTopologyPosition(initialBoard, initialToMove, topology) {
  if (!topology || !Array.isArray(topology.cells)) throw new TypeError('A valid topology is required');
  if (initialToMove !== 1 && initialToMove !== -1) throw new TypeError('toMove must be 1 or -1');

  const cellSet = new Set(topology.cells);
  const { stoneKeys } = createZobrist(topology);
  const board = new Map(initialBoard ?? []);
  const lineCounts = topology.linesOfFive.map(() => [0, 0]);
  const lineIndexesByCell = new Map(topology.cells.map((cellId) => [cellId, []]));
  const activeLineIndices = new Set();
  const winningMovesByPlayer = new Map([[1, new Map()], [-1, new Map()]]);
  let blackWindowScore = 0;

  topology.linesOfFive.forEach((line, lineIndex) => {
    const counts = lineCounts[lineIndex];
    for (const cellId of line.cells) {
      lineIndexesByCell.get(cellId)?.push(lineIndex);
      const stone = board.get(cellId);
      if (stone === 1) counts[0] += 1;
      else if (stone === -1) counts[1] += 1;
    }
    blackWindowScore += scoreWindowCounts(counts[0], counts[1]);
    if (!counts[0] || !counts[1]) activeLineIndices.add(lineIndex);
    updateWinningMoveReferences(winningMovesByPlayer, board, lineIndex, line, counts, 1);
  });

  let hash = initialToMove === -1 ? TURN_KEY : 0n;
  for (const [cellId, player] of board) {
    if (!cellSet.has(cellId)) throw new Error(`Cell is outside topology: ${cellId}`);
    if (player !== 1 && player !== -1) throw new TypeError(`Invalid player at ${cellId}`);
    hash ^= stoneKeys.get(`${cellId}:${player}`);
  }

  const initialWinner = getWinner(board, topology);
  const position = {
    board,
    toMove: initialToMove,
    status: initialWinner ? 'won' : board.size >= topology.cells.length ? 'draw' : 'playing',
    winner: initialWinner?.player ?? null,
    winningLine: initialWinner?.line ?? null,
    hash,
    history: [],
    activeLineIndices,
    windowScore(player = 1) {
      if (player !== 1 && player !== -1) throw new TypeError('player must be 1 or -1');
      const score = blackWindowScore * player;
      return score === 0 ? 0 : score;
    },
    push(cellId) {
      if (this.status !== 'playing') throw new Error('Game is finished');
      if (!cellSet.has(cellId)) throw new Error('Cell is outside this topology');
      if (this.board.has(cellId)) throw new Error('Cell is occupied');

      const player = this.toMove;
      const move = {
        cellId,
        player,
        previousStatus: this.status,
        previousWinner: this.winner,
        previousWinningLine: this.winningLine,
      };
      const touchedLines = lineIndexesByCell.get(cellId) ?? [];
      for (const lineIndex of touchedLines) {
        updateWinningMoveReferences(winningMovesByPlayer, this.board, lineIndex, topology.linesOfFive[lineIndex], lineCounts[lineIndex], -1);
      }
      this.board.set(cellId, player);
      this.hash ^= stoneKeys.get(`${cellId}:${player}`) ^ TURN_KEY;
      this.toMove = -player;

      let winningLine = null;
      for (const lineIndex of touchedLines) {
        const counts = lineCounts[lineIndex];
        blackWindowScore -= scoreWindowCounts(counts[0], counts[1]);
        counts[player === 1 ? 0 : 1] += 1;
        blackWindowScore += scoreWindowCounts(counts[0], counts[1]);
        if (counts[0] && counts[1]) activeLineIndices.delete(lineIndex);
        else activeLineIndices.add(lineIndex);
        updateWinningMoveReferences(winningMovesByPlayer, this.board, lineIndex, topology.linesOfFive[lineIndex], counts, 1);
        if (counts[player === 1 ? 0 : 1] === 5) winningLine = topology.linesOfFive[lineIndex];
      }

      this.status = winningLine ? 'won' : this.board.size >= topology.cells.length ? 'draw' : 'playing';
      this.winner = winningLine ? player : null;
      this.winningLine = winningLine?.cells ?? null;
      this.history.push(move);
      return move;
    },
    pop() {
      const move = this.history.pop();
      if (!move) throw new RangeError('No move to undo');
      const touchedLines = lineIndexesByCell.get(move.cellId) ?? [];
      for (const lineIndex of touchedLines) {
        updateWinningMoveReferences(winningMovesByPlayer, this.board, lineIndex, topology.linesOfFive[lineIndex], lineCounts[lineIndex], -1);
      }
      this.board.delete(move.cellId);
      this.hash ^= stoneKeys.get(`${move.cellId}:${move.player}`) ^ TURN_KEY;

      for (const lineIndex of touchedLines) {
        const counts = lineCounts[lineIndex];
        blackWindowScore -= scoreWindowCounts(counts[0], counts[1]);
        counts[move.player === 1 ? 0 : 1] -= 1;
        blackWindowScore += scoreWindowCounts(counts[0], counts[1]);
        if (counts[0] && counts[1]) activeLineIndices.delete(lineIndex);
        else activeLineIndices.add(lineIndex);
        updateWinningMoveReferences(winningMovesByPlayer, this.board, lineIndex, topology.linesOfFive[lineIndex], counts, 1);
      }

      this.toMove = move.player;
      this.status = move.previousStatus;
      this.winner = move.previousWinner;
      this.winningLine = move.previousWinningLine;
      return move;
    },
    availableMoves() {
      return topology.cells.filter((cellId) => !this.board.has(cellId));
    },
    immediateWinningMoves(player = this.toMove) {
      if (player !== 1 && player !== -1) throw new TypeError('player must be 1 or -1');
      return cellsByFirstLine(winningMovesByPlayer.get(player), topology.linesOfFive);
    },
    forcingMoves(player = this.toMove) {
      if (player !== 1 && player !== -1) throw new TypeError('player must be 1 or -1');
      const ownIndex = player === 1 ? 0 : 1;
      const opponentIndex = 1 - ownIndex;
      const candidates = new Set();
      for (const lineIndex of activeLineIndices) {
        const counts = lineCounts[lineIndex];
        if (counts[ownIndex] < 2 || counts[opponentIndex] !== 0) continue;
        for (const cellId of topology.linesOfFive[lineIndex].cells) {
          if (!this.board.has(cellId)) candidates.add(cellId);
        }
      }

      const currentWinningMoves = winningMovesByPlayer.get(player);
      const results = [];
      for (const cellId of candidates) {
        const touchedLines = lineIndexesByCell.get(cellId) ?? [];
        const winsNow = touchedLines.some((lineIndex) => {
          const counts = lineCounts[lineIndex];
          return counts[ownIndex] === 4 && counts[opponentIndex] === 0;
        });
        const winningReplyLines = new Map();
        if (!winsNow) {
          for (const [reply, lineIndexes] of currentWinningMoves) {
            if (reply !== cellId) winningReplyLines.set(reply, Math.min(...lineIndexes));
          }
          for (const lineIndex of touchedLines) {
            const counts = lineCounts[lineIndex];
            if (counts[ownIndex] !== 3 || counts[opponentIndex] !== 0) continue;
            for (const reply of topology.linesOfFive[lineIndex].cells) {
              if (reply === cellId || this.board.has(reply)) continue;
              const previous = winningReplyLines.get(reply);
              if (previous === undefined || lineIndex < previous) winningReplyLines.set(reply, lineIndex);
            }
          }
        }

        const winningReplies = [...winningReplyLines]
          .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))
          .map(([reply]) => reply);
        if (winsNow || winningReplies.length) results.push({ cellId, winsNow, winningReplies });
      }

      return results.sort((left, right) =>
        Number(right.winsNow) - Number(left.winsNow)
        || right.winningReplies.length - left.winningReplies.length
        || left.cellId.localeCompare(right.cellId));
    },
    clone() {
      return createTopologyPosition(this.board, this.toMove, topology);
    },
  };
  return position;
}
