import test from 'node:test';
import assert from 'node:assert/strict';
import { TOPOLOGY_IDS, getTopology, getWinner } from '../src/core/topology.mjs';

const expectedIds = ['plane', 'cylinder', 'torus', 'mobius', 'klein', 'projective', 'sphere'];

test('registers all seven topology journeys', () => {
  assert.deepEqual(TOPOLOGY_IDS, expectedIds);
});

test('uses the requested grid dimensions for each topology', () => {
  const expected = {
    plane: [15, 15],
    cylinder: [7, 6],
    torus: [7, 6],
    mobius: [8, 6],
    klein: [7, 6],
    projective: [8, 8],
    sphere: [7, 7],
  };
  for (const [id, [width, height]] of Object.entries(expected)) {
    const topology = getTopology(id);
    assert.deepEqual([topology.width, topology.height], [width, height], id);
  }
});

for (const id of expectedIds) {
  test(`${id} exposes a valid cell graph and seam-crossing winning lines`, () => {
    const topology = getTopology(id);
    assert.ok(topology, `missing topology ${id}`);
    assert.ok(topology.cells.length > 0);
    assert.ok(topology.linesOfFive.length > 0);
    for (const line of topology.linesOfFive) {
      assert.equal(line.cells.length, 5);
      assert.equal(new Set(line.cells).size, 5);
      for (const cell of line.cells) assert.ok(topology.cells.includes(cell));
    }
    const line = id === 'plane'
      ? topology.linesOfFive.find((candidate) => candidate.cells.every((cell) => cell.endsWith(':0')))
      : topology.linesOfFive.find((candidate) => candidate.crossesSeam);
    assert.ok(line, `${id} has no required five-line`);
    if (id === 'plane') assert.equal(line.crossesSeam, false);
    const board = new Map(line.cells.map((cell) => [cell, 1]));
    assert.equal(getWinner(board, topology)?.player, 1);
  });
}

test('plane and wrapped edge mappings are explicit', () => {
  assert.equal(getTopology('plane').stepChart(14, 7, 1, 0), null);
  assert.deepEqual(getTopology('cylinder').stepChart(6, 3, 1, 0), { x: 0, y: 3 });
  assert.deepEqual(getTopology('torus').stepChart(4, 5, 0, 1), { x: 4, y: 0 });
  assert.deepEqual(getTopology('mobius').stepChart(7, 2, 1, 0), { x: 0, y: 3 });
  assert.deepEqual(getTopology('klein').stepChart(2, 5, 0, 1), { x: 4, y: 0 });
});

test('sphere and projective plane have the expected pole and antipodal identifications', () => {
  const sphere = getTopology('sphere');
  const projective = getTopology('projective');
  assert.equal(sphere.cellAt(0, 0), sphere.cellAt(sphere.width - 1, 0));
  assert.equal(sphere.cellAt(0, sphere.height - 1), sphere.cellAt(sphere.width - 1, sphere.height - 1));
  assert.equal(projective.cellAt(0, 0), projective.cellAt(0, projective.height - 1));
  assert.equal(projective.cellAt(0, 1), projective.cellAt(projective.width / 2, projective.height - 2));
});

test('directed steps preserve boundary direction transforms for every non-planar seam', () => {
  const expected = [
    { id: 'cylinder', from: { x: 6, y: 2 }, direction: { x: 1, y: 0 }, to: { x: 0, y: 2 }, after: { x: 1, y: 0 } },
    { id: 'torus', from: { x: 4, y: 5 }, direction: { x: 0, y: 1 }, to: { x: 4, y: 0 }, after: { x: 0, y: 1 } },
    { id: 'mobius', from: { x: 7, y: 1 }, direction: { x: 1, y: 1 }, to: { x: 0, y: 3 }, after: { x: 1, y: -1 } },
    { id: 'klein', from: { x: 1, y: 5 }, direction: { x: 1, y: 1 }, to: { x: 4, y: 0 }, after: { x: -1, y: 1 } },
    { id: 'sphere', from: { x: 3, y: 0 }, direction: { x: 0, y: -1 }, to: { x: 6, y: 1 }, after: { x: 0, y: 1 } },
    { id: 'projective', from: { x: 3, y: 0 }, direction: { x: 0, y: -1 }, to: { x: 7, y: 1 }, after: { x: 0, y: 1 } },
  ];

  for (const sample of expected) {
    const topology = getTopology(sample.id);
    assert.ok(Array.isArray(topology.directedSteps), `${sample.id} must expose directed steps`);
    const step = topology.directedSteps.find((candidate) =>
      candidate.fromChart.x === sample.from.x
      && candidate.fromChart.y === sample.from.y
      && candidate.direction.x === sample.direction.x
      && candidate.direction.y === sample.direction.y);
    assert.ok(step, `${sample.id} is missing its seam step`);
    assert.deepEqual(step.toChart, sample.to, sample.id);
    assert.deepEqual(step.directionAfter, sample.after, sample.id);
    assert.equal(step.crossesSeam, true, sample.id);
  }
});

test('pole chart aliases retain all valid canonical neighbors', () => {
  const sphere = getTopology('sphere');
  const sphereNorth = sphere.cellAt(0, 0);
  assert.ok(Array.isArray(sphere.directedSteps), 'sphere must expose directed steps');
  const sphereNeighbors = new Set(sphere.directedSteps
    .filter((step) => step.from === sphereNorth && step.direction.x === 0 && step.direction.y === 1)
    .map((step) => step.to));
  assert.equal(sphereNeighbors.size, 7);

  const projective = getTopology('projective');
  const projectivePole = projective.cellAt(0, 0);
  assert.ok(Array.isArray(projective.directedSteps), 'projective plane must expose directed steps');
  const projectiveNeighbors = new Set(projective.directedSteps
    .filter((step) => step.from === projectivePole && step.direction.x === 0 && step.direction.y === 1)
    .map((step) => step.to));
  assert.equal(projectiveNeighbors.size, 8);
});

test('precomputed rays stop before repeating a canonical cell', () => {
  for (const id of expectedIds) {
    const topology = getTopology(id);
    assert.ok(Array.isArray(topology.rays), `${id} must expose precomputed rays`);
    for (const ray of topology.rays) {
      assert.ok(ray.cells.length > 0, `${id} has an empty ray`);
      assert.equal(new Set(ray.cells).size, ray.cells.length, `${id} ray revisits a cell`);
      assert.ok(ray.cells.length <= topology.cells.length, `${id} ray exceeds the finite board`);
      assert.equal(ray.steps.length, ray.cells.length - 1, `${id} ray has mismatched steps`);
    }
  }
});
