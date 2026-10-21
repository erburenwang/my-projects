import { chooseMove } from './ai.mjs';
import { getTopology } from './topology.mjs';

self.onmessage = ({ data }) => {
  if (data?.type !== 'search') return;
  try {
    const topology = getTopology(data.topologyId);
    if (!topology) throw new Error('未知棋盘拓扑');
    const position = { board: new Map(data.board), toMove: data.toMove };
    const result = chooseMove(position, topology, data.options, (info) => {
      self.postMessage({ type: 'info', requestId: data.requestId, info });
    });
    self.postMessage({ type: 'result', requestId: data.requestId, result });
  } catch (error) {
    self.postMessage({ type: 'error', requestId: data.requestId, message: error?.message ?? String(error) });
  }
};
