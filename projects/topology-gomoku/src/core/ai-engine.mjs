import { getImmediateWinningMoves } from './topology.mjs';

let requestSequence = 0;

export function mapMovesToRapfiBoard(state, topology) {
  return state.moves.map((move) => {
    const point = topology.chart.find((entry) => entry.cellId === move.cellId);
    if (!point) throw new Error(`棋谱落点无法映射到 Rapfi 坐标：${move.cellId}`);
    return { x: point.x, y: point.y, player: move.player };
  });
}

class RapfiClient {
  worker = null;
  ready = false;
  initializing = null;
  pending = null;

  ensureWorker() {
    if (this.worker) return;
    const worker = new Worker('/rapfi/worker.js');
    this.worker = worker;
    worker.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        this.ready = true;
        const initializing = this.initializing;
        this.initializing = null;
        initializing?.resolve(data.metadata);
        return;
      }
      if (data.type === 'info') {
        const pending = this.pending;
        if (pending && (!data.requestId || pending.requestId === data.requestId)) pending.onInfo?.(data.info);
        return;
      }
      if (data.type === 'result') {
        const pending = this.pending;
        if (!pending || pending.requestId !== data.requestId) return;
        this.pending = null;
        clearTimeout(pending.timer);
        pending.resolve(data);
        return;
      }
      if (data.type === 'error') {
        const error = new Error(data.message || 'Rapfi 引擎发生错误');
        this.initializing?.reject(error);
        this.initializing = null;
        if (this.pending) {
          clearTimeout(this.pending.timer);
          this.pending.reject(error);
          this.pending = null;
        }
        this.worker?.terminate();
        this.worker = null;
        this.ready = false;
      }
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Rapfi Worker 加载失败');
      this.initializing?.reject(error);
      this.initializing = null;
      if (this.pending) {
        clearTimeout(this.pending.timer);
        this.pending.reject(error);
        this.pending = null;
      }
      this.destroy();
    };
  }

  initialize() {
    if (this.ready) return Promise.resolve();
    if (this.initializing) return this.initializing.promise;
    this.ensureWorker();
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    this.initializing = { promise, resolve, reject };
    this.worker.postMessage({ type: 'init' });
    return promise;
  }

  async search(state, topology, budgetMs, onInfo) {
    await this.initialize();
    const requestId = ++requestSequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.requestId !== requestId) return;
        this.pending = null;
        reject(new Error('Rapfi 搜索超出时限'));
        this.destroy();
      }, budgetMs + 5000);
      this.pending = { requestId, resolve, reject, timer, onInfo };
      const moves = mapMovesToRapfiBoard(state, topology);
      this.worker.postMessage({
        type: 'search',
        requestId,
        moves,
        toMove: state.toMove,
        budgetMs,
        boardSize: topology.width,
      });
    });
  }

  destroy() {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new DOMException('搜索已取消', 'AbortError'));
      this.pending = null;
    }
    if (this.initializing) {
      this.initializing.reject(new DOMException('引擎初始化已取消', 'AbortError'));
      this.initializing = null;
    }
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }
}

function searchTopology(state, topology, options, onInfo, setActiveWorker) {
  const worker = new Worker(new URL('./topology-search.worker.js', import.meta.url), { type: 'module' });
  const requestId = ++requestSequence;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      worker.terminate();
      setActiveWorker(null);
      reject(new Error('拓扑搜索超出时限'));
    }, Math.max(3000, (options.budgetMs ?? 800) + 1500));
    const cancelHandle = { terminate: () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      setActiveWorker(null);
      reject(new DOMException('搜索已取消', 'AbortError'));
    } };
    setActiveWorker(cancelHandle);
    worker.onmessage = ({ data }) => {
      if (settled || data.requestId !== requestId) return;
      if (data.type === 'info') {
        onInfo?.({ ...data.info, status: 'searching', engine: '拓扑原生威胁搜索' });
        return;
      }
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      setActiveWorker(null);
      if (data.type === 'error') reject(new Error(data.message));
      else resolve({ ...data.result, engine: '拓扑原生威胁搜索' });
    };
    worker.onerror = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      setActiveWorker(null);
      reject(new Error(event.message || '拓扑搜索 Worker 失败'));
    };
    worker.postMessage({
      type: 'search',
      requestId,
      topologyId: topology.id,
      board: [...state.board],
      toMove: state.toMove,
      options,
    });
    onInfo?.({ status: 'searching', engine: '拓扑原生威胁搜索' });
  });
}

function validateTopologyResult(result, state, topology) {
  if (result.cellId === null) {
    if (topology.cells.some((cellId) => !state.board.has(cellId))) throw new Error('拓扑搜索未返回合法落点');
    return result;
  }
  if (!topology.cells.includes(result.cellId) || state.board.has(result.cellId)) {
    throw new Error('拓扑搜索返回了非法落点');
  }
  return result;
}

export function createAIEngine() {
  const rapfi = new RapfiClient();
  let activeSearchWorker = null;
  let generation = 0;

  return {
    /** @param {any} state @param {any} topology @param {any} [options] @param {(info: any) => void} [onInfo] */
    async chooseMove(state, topology, options = {}, onInfo = () => {}) {
      const requestGeneration = ++generation;
      activeSearchWorker?.terminate();
      activeSearchWorker = null;
      if (rapfi.pending || rapfi.initializing) rapfi.destroy();
      const wins = getImmediateWinningMoves(state.board, state.toMove, topology);
      if (wins.length) return { cellId: wins[0], reason: 'immediate-win', engine: '战术检查', depth: 0, nodes: 0 };
      const opponentWins = getImmediateWinningMoves(state.board, -state.toMove, topology);
      if (opponentWins.length === 1) return { cellId: opponentWins[0], reason: 'forced-block', engine: '战术检查', depth: 0, nodes: 0 };
      if (topology.id === 'plane') {
        try {
          const result = await rapfi.search(state, topology, options.budgetMs ?? 1200, onInfo);
          if (generation !== requestGeneration) throw new DOMException('搜索已取消', 'AbortError');
          const cellId = topology.cellAt(result.x, result.y);
          if (!cellId || state.board.has(cellId)) throw new Error('Rapfi 返回了非法落点');
          return { cellId, reason: 'engine-search', engine: 'Rapfi WASM', depth: result.depth, nodes: result.nodes, elapsedMs: result.elapsedMs };
        } catch (error) {
          if (error?.name === 'AbortError' || generation !== requestGeneration) throw new DOMException('搜索已取消', 'AbortError');
          rapfi.destroy();
          const result = validateTopologyResult(
            await searchTopology(state, topology, options, onInfo, (worker) => { activeSearchWorker = worker; }),
            state,
            topology,
          );
          if (generation !== requestGeneration) throw new DOMException('搜索已取消', 'AbortError');
          return { ...result, engine: '拓扑原生威胁搜索（Rapfi 回退）', warning: `Rapfi 不可用：${error.message}` };
        }
      }
      const result = validateTopologyResult(
        await searchTopology(state, topology, options, onInfo, (worker) => { activeSearchWorker = worker; }),
        state,
        topology,
      );
      if (generation !== requestGeneration) throw new DOMException('搜索已取消', 'AbortError');
      return result;
    },
    cancel() {
      generation += 1;
      activeSearchWorker?.terminate();
      activeSearchWorker = null;
      rapfi.destroy();
    },
    destroy() {
      this.cancel();
    },
  };
}
