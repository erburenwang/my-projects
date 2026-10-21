const BOARD_SIZE = 15;
const GRID_SIZE = {
  plane: [BOARD_SIZE, BOARD_SIZE],
  cylinder: [7, 6],
  torus: [7, 6],
  mobius: [8, 6],
  klein: [7, 6],
  projective: [8, 8],
  sphere: [7, 7],
};
const DIRECTIONS = [
  { x: 1, y: 0, axis: 'east' },
  { x: 0, y: 1, axis: 'south' },
  { x: 1, y: 1, axis: 'southeast' },
  { x: 1, y: -1, axis: 'northeast' },
];

export const TOPOLOGY_IDS = ['plane', 'cylinder', 'torus', 'mobius', 'klein', 'projective', 'sphere'];

const META = {
  plane: { name: '方庭', surface: 'plane', subtitle: '边界止步，直线延伸' },
  cylinder: { name: '回廊', surface: 'cylinder', subtitle: '左右相接，绕行成线' },
  torus: { name: '环游', surface: 'torus', subtitle: '两组边界彼此相连' },
  mobius: { name: '扭带', surface: 'mobius', subtitle: '绕过接缝，方向翻转' },
  klein: { name: '瓶界', surface: 'klein', subtitle: '闭合曲面上的反向接缝' },
  projective: { name: '双生', surface: 'projective', subtitle: '对跖位置视作同一点' },
  sphere: { name: '归圆', surface: 'sphere', subtitle: '经线汇聚于两极' },
};

const mod = (value, base) => ((value % base) + base) % base;

function sphereBaseCell(x, y, width, height) {
  if (y === 0) return 'sphere:north';
  if (y === height - 1) return 'sphere:south';
  return `sphere:${y}:${mod(x, width)}`;
}

function projectiveCell(x, y, width, height) {
  if (y === 0 || y === height - 1) return 'projective:pole';
  const first = `sphere:${y}:${mod(x, width)}`;
  const oppositeY = height - 1 - y;
  const oppositeX = mod(x + width / 2, width);
  const second = `sphere:${oppositeY}:${oppositeX}`;
  return `projective:${[first, second].sort()[0]}`;
}

function createCellMapper(id, width, height) {
  if (id === 'sphere') return (x, y) => sphereBaseCell(x, y, width, height);
  if (id === 'projective') return (x, y) => projectiveCell(x, y, width, height);
  return (x, y) => `${id}:${mod(x, width)}:${y}`;
}

function walk(topology, x, y, dx, dy) {
  let nx = x + dx;
  let ny = y + dy;
  let nextDx = dx;
  let nextDy = dy;
  let crossed = false;
  const { id, width, height } = topology;

  if (id === 'plane') {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return null;
  } else if (id === 'cylinder' || id === 'torus') {
    if (nx < 0 || nx >= width) {
      nx = mod(nx, width);
      crossed = true;
    }
    if (ny < 0 || ny >= height) {
      if (id === 'cylinder') return null;
      ny = mod(ny, height);
      crossed = true;
    }
  } else if (id === 'mobius') {
    if (nx < 0 || nx >= width) {
      nx = mod(nx, width);
      ny = height - 1 - ny;
      nextDy = -nextDy;
      crossed = true;
    }
    if (ny < 0 || ny >= height) return null;
  } else if (id === 'klein') {
    if (nx < 0 || nx >= width) {
      nx = mod(nx, width);
      crossed = true;
    }
    if (ny < 0 || ny >= height) {
      ny = mod(ny, height);
      nx = width - 1 - nx;
      nextDx = -nextDx;
      crossed = true;
    }
  } else if (id === 'sphere' || id === 'projective') {
    nx = mod(nx, width);
    if (ny < 0) {
      ny = -ny;
      nx = mod(nx + Math.floor(width / 2), width);
      nextDy = -nextDy;
      crossed = true;
    } else if (ny >= height) {
      ny = 2 * (height - 1) - ny;
      nx = mod(nx + Math.floor(width / 2), width);
      nextDy = -nextDy;
      crossed = true;
    }
    if (x + dx < 0 || x + dx >= width) crossed = true;
  }

  return { x: nx, y: ny, dx: nextDx, dy: nextDy, crossed };
}

function lineKey(cells) {
  const forward = cells.join('>');
  const reverse = [...cells].reverse().join('>');
  return forward < reverse ? forward : reverse;
}

function stepKey(x, y, dx, dy) {
  return `${x},${y},${dx},${dy}`;
}

function buildTopology(id) {
  const meta = META[id];
  const [width, height] = GRID_SIZE[id];
  const cellAt = createCellMapper(id, width, height);
  const topology = { id, ...meta, width, height, cells: [], chart: [], directedSteps: [], rays: [], linesOfFive: [], neighbors: new Map(), cellAt };
  const cellSet = new Set();

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cellId = cellAt(x, y);
      topology.chart.push({ x, y, cellId });
      cellSet.add(cellId);
    }
  }
  topology.cells = [...cellSet];
  topology.centerCell = cellAt(Math.floor(width / 2), Math.floor(height / 2));
  topology.stepChart = (x, y, dx, dy) => {
    const step = walk(topology, x, y, dx, dy);
    return step ? { x: step.x, y: step.y } : null;
  };

  const stepIndex = new Map();
  for (const chartPoint of topology.chart) {
    const from = chartPoint.cellId;
    for (const direction of DIRECTIONS) {
      for (const sign of [-1, 1]) {
        const dx = direction.x * sign;
        const dy = direction.y * sign;
        const step = walk(topology, chartPoint.x, chartPoint.y, dx, dy);
        if (!step) continue;
        const directedStep = {
          fromChart: { x: chartPoint.x, y: chartPoint.y },
          toChart: { x: step.x, y: step.y },
          from,
          to: cellAt(step.x, step.y),
          direction: { x: dx || 0, y: dy || 0 },
          directionAfter: { x: step.dx || 0, y: step.dy || 0 },
          axis: direction.axis,
          crossesSeam: step.crossed,
        };
        topology.directedSteps.push(directedStep);
        stepIndex.set(stepKey(chartPoint.x, chartPoint.y, dx, dy), directedStep);
      }
    }
  }

  for (const chartPoint of topology.chart) {
    for (const direction of DIRECTIONS) {
      for (const sign of [-1, 1]) {
        const initialDirection = { x: direction.x * sign || 0, y: direction.y * sign || 0 };
        let cursor = {
          x: chartPoint.x,
          y: chartPoint.y,
          dx: initialDirection.x,
          dy: initialDirection.y,
        };
        const cells = [chartPoint.cellId];
        const steps = [];
        const seen = new Set(cells);
        let closed = false;

        while (steps.length < topology.cells.length) {
          const step = stepIndex.get(stepKey(cursor.x, cursor.y, cursor.dx, cursor.dy));
          if (!step) break;
          if (seen.has(step.to)) {
            closed = step.to === cells[0];
            break;
          }
          cells.push(step.to);
          steps.push(step);
          seen.add(step.to);
          cursor = { ...step.toChart, dx: step.directionAfter.x, dy: step.directionAfter.y };
        }

        topology.rays.push({
          startChart: { x: chartPoint.x, y: chartPoint.y },
          start: chartPoint.cellId,
          axis: direction.axis,
          direction: initialDirection,
          cells,
          steps,
          closed,
        });
      }
    }
  }

  const lines = new Map();
  for (const ray of topology.rays) {
    for (let start = 0; start <= ray.cells.length - 5; start += 1) {
      const cells = ray.cells.slice(start, start + 5);
      if (new Set(cells).size !== 5) continue;
      const crossesSeam = ray.steps.slice(start, start + 4).some((step) => step.crossesSeam);
      const key = `${ray.axis}:${lineKey(cells)}`;
      const previous = lines.get(key);
      if (previous) previous.crossesSeam ||= crossesSeam;
      else lines.set(key, { cells, axis: ray.axis, direction: ray.direction, crossesSeam });
    }
  }
  topology.linesOfFive = [...lines.values()];

  for (const cell of topology.cells) topology.neighbors.set(cell, new Set());
  for (const step of topology.directedSteps) {
    if (step.from !== step.to) topology.neighbors.get(step.from).add(step.to);
  }
  topology.neighbors = new Map([...topology.neighbors].map(([cell, set]) => [cell, [...set]]));
  topology.linesByCell = new Map(topology.cells.map((cell) => [cell, []]));
  for (const line of topology.linesOfFive) for (const cell of line.cells) topology.linesByCell.get(cell).push(line);

  return topology;
}

const topologyMap = new Map(TOPOLOGY_IDS.map((id) => [id, buildTopology(id)]));

export function getTopology(id) {
  return topologyMap.get(id) ?? null;
}

export function getWinner(board, topology) {
  for (const line of topology.linesOfFive) {
    const player = board.get(line.cells[0]);
    if (!player) continue;
    if (line.cells.every((cell) => board.get(cell) === player)) return { player, line: line.cells, crossesSeam: line.crossesSeam };
  }
  return null;
}

export function getImmediateWinningMoves(board, player, topology) {
  const moves = new Set();
  for (const line of topology.linesOfFive) {
    let count = 0;
    let empty = null;
    let blocked = false;
    for (const cell of line.cells) {
      const occupant = board.get(cell);
      if (occupant === player) count += 1;
      else if (occupant === undefined) {
        if (empty !== null) {
          blocked = true;
          break;
        }
        empty = cell;
      } else {
        blocked = true;
        break;
      }
    }
    if (!blocked && count === 4 && empty !== null) moves.add(empty);
  }
  return [...moves];
}

export function createEmptyBoard() {
  return new Map();
}
