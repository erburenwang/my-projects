import assert from 'node:assert/strict';
import test from 'node:test';
import { collectMetrics, createMetrics } from '../scripts/benchmark-metrics.mjs';

test('does not count an incomplete depth-zero iteration as completed', () => {
  const metrics = createMetrics();
  collectMetrics(metrics, { nodes: 3, depth: 0 }, 1);
  assert.deepEqual(metrics.completedDepths, []);
});
