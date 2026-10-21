import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurfacePosition } from '../src/ui/surface-geometry.ts';
import { clampCursor } from '../src/ui/board-cursor.mjs';
import { getTopology } from '../src/core/topology.mjs';

test('torus first and last chart rows occupy distinct 3D positions', () => {
  const topology = getTopology('torus');
  assert.deepEqual([topology.width, topology.height], [7, 6]);
  const firstRow = getSurfacePosition(topology, 4, 0);
  const lastRow = getSurfacePosition(topology, 4, topology.height - 1);
  assert.ok(firstRow.distanceTo(lastRow) > 0.1);
});

test('keyboard cursor stays on the selected topology grid after a dimension change', () => {
  assert.deepEqual(clampCursor({ x: 7, y: 8 }, 7, 6), { x: 6, y: 5 });
  assert.deepEqual(clampCursor({ x: -1, y: 8 }, 8, 6), { x: 0, y: 5 });
});
