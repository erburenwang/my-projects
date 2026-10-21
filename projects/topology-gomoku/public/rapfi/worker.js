/* Rapfi GPL-3.0-or-later. Local single-threaded WASM worker. */
let instance;
let initializing = false;
let ready = false;
let currentRequest = null;
let sawFreestyleWeight = false;
let freestyleWeightLoaded = false;

function emitEngineLine(line) {
  line = String(line).trim();
  if (/nnue: load weight from mix9svqfreestyle_bsmix\.bin\.lz4/.test(line)) sawFreestyleWeight = true;
  if (sawFreestyleWeight && /nnue: weight loaded in \d+ms/.test(line)) freestyleWeightLoaded = true;
  if (!currentRequest) return;
  if (currentRequest.type === 'init') {
    if (/^\d+,\d+$/.test(line)) {
      if (!freestyleWeightLoaded) {
        self.postMessage({ type: 'error', message: '未确认自由规则 NNUE 权重加载成功，拒绝启动平面强引擎' });
        currentRequest = null;
        return;
      }
      try { instance.sendCommand('RESTART'); } catch { /* engine is already idle */ }
      ready = true;
      currentRequest = null;
      self.postMessage({ type: 'ready', metadata: { version: 'Rapfi WASM · freestyle NNUE' } });
    }
    return;
  }
  if (currentRequest.type === 'search') {
    const coordinate = /^(\d+),(\d+)$/.exec(line);
    if (coordinate) {
      const request = currentRequest;
      currentRequest = null;
      self.postMessage({
        type: 'result',
        requestId: request.requestId,
        x: Number(coordinate[1]),
        y: Number(coordinate[2]),
        depth: request.depth,
        nodes: request.nodes,
        elapsedMs: Math.round(performance.now() - request.startedAt),
      });
      return;
    }
    const depth = /^INFO DEPTH (\d+)$/.exec(line);
    const nodes = /^INFO NODES (\d+)$/.exec(line);
    if (depth || nodes) {
      if (depth) currentRequest.depth = Number(depth[1]);
      if (nodes) currentRequest.nodes = Number(nodes[1]);
      self.postMessage({ type: 'info', requestId: currentRequest.requestId, info: {
        depth: depth ? Number(depth[1]) : undefined,
        nodes: nodes ? Number(nodes[1]) : undefined,
        elapsedMs: Math.round(performance.now() - currentRequest.startedAt),
      } });
    }
  }
}

async function initialize() {
  if (ready || initializing) return;
  initializing = true;
  const base = new URL('/rapfi/', self.location.href).href;
  const scriptUrl = `${base}rapfi-single-simd128.js`;
  importScripts(scriptUrl);
  instance = await self.Rapfi({
    mainScriptUrlOrBlob: scriptUrl,
    locateFile: (name) => `${base}${/^rapfi.*\.data$/.test(name) ? 'rapfi.data' : name}`,
    onReceiveStdout: emitEngineLine,
    onReceiveStderr: emitEngineLine,
    onExit: (code) => self.postMessage({ type: 'error', message: `Rapfi 退出，代码 ${code}` }),
    onAbort: (reason) => self.postMessage({ type: 'error', message: `Rapfi 初始化失败：${reason}` }),
    wasmMemory: new WebAssembly.Memory({ initial: 1024, maximum: 32768, shared: false }),
  });
  const configResponse = await fetch(`${base}integration-config.toml`);
  if (!configResponse.ok) throw new Error('Rapfi 本地配置文件加载失败');
  const configBytes = new Uint8Array(await configResponse.arrayBuffer());
  try { instance.FS_unlink('/config.toml'); } catch { /* first initialization */ }
  instance.FS_createDataFile('/', 'config.toml', configBytes, true, true);
  instance.sendCommand('START 15');
  instance.sendCommand('INFO RULE 0');
  instance.sendCommand('INFO TIMEOUT_TURN 10000');
  instance.sendCommand('INFO THREAD_NUM 1');
  instance.sendCommand('INFO HASH_SIZE 131072');
  instance.sendCommand('INFO SHOW_DETAIL 2');
  currentRequest = { type: 'init' };
  instance.sendCommand('BOARD\n7,7,2\nDONE');
  setTimeout(() => {
    if (!ready) self.postMessage({ type: 'error', message: 'Rapfi 初始化超时，请检查本地模型资源' });
  }, 45000);
  initializing = false;
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      await initialize();
      return;
    }
    if (data.type === 'cancel') {
      currentRequest = null;
      try { instance?.sendCommand('YXSTOP'); } catch { /* worker will be restarted if needed */ }
      return;
    }
    if (data.type !== 'search') return;
    await initialize();
    if (!ready) throw new Error('Rapfi 尚未完成权重验证');
    if (currentRequest) throw new Error('Rapfi 已有搜索正在运行');
    currentRequest = { type: 'search', requestId: data.requestId, startedAt: performance.now(), depth: null, nodes: null };
    instance.sendCommand('RESTART');
    instance.sendCommand('INFO RULE 0');
    instance.sendCommand(`INFO TIMEOUT_TURN ${Math.max(100, Math.min(data.budgetMs, 120000))}`);
    instance.sendCommand('INFO TIME_LEFT 2147483647');
    instance.sendCommand('INFO THREAD_NUM 1');
    instance.sendCommand('INFO HASH_SIZE 524288');
    instance.sendCommand('INFO SHOW_DETAIL 2');
    if (!data.moves.length) instance.sendCommand('BEGIN');
    else {
      const rows = data.moves.map((move) => `${move.x},${move.y},${move.player === data.toMove ? 1 : 2}`);
      instance.sendCommand(['BOARD', ...rows, 'DONE'].join('\n'));
    }
    setTimeout(() => {
      if (currentRequest?.requestId === data.requestId) {
        self.postMessage({ type: 'error', message: 'Rapfi 搜索超过时限' });
        currentRequest = null;
      }
    }, Math.max(100, Math.min(data.budgetMs, 120000)) + 4000);
  } catch (error) {
    initializing = false;
    self.postMessage({ type: 'error', message: error?.message ?? String(error) });
  }
};
