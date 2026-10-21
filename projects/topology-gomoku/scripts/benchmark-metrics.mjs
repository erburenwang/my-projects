export function createMetrics() {
  return { moves: 0, nodes: 0, depth: 0, depths: [], completedDepths: [], nodeLimits: [], timeouts: 0, nodeLimitStops: 0, elapsedMs: 0 };
}

export function collectMetrics(target, result, elapsedMs) {
  target.moves += 1;
  target.nodes += Number(result.nodes ?? 0);
  const depth = Number(result.depth ?? 0);
  target.depth += depth;
  target.depths.push(depth);
  if (depth > 0 && Number(result.nodes ?? 0) > 0) target.completedDepths.push(depth);
  if (Number.isFinite(result.nodeLimit)) target.nodeLimits.push(result.nodeLimit);
  target.timeouts += Number(Boolean(result.timedOut));
  target.nodeLimitStops += Number(result.stoppedBy === 'node-limit');
  target.elapsedMs += elapsedMs;
}
