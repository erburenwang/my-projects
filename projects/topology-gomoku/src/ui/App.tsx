import { useCallback, useEffect, useRef, useState } from 'react';
import { createAIEngine } from '../core/ai-engine.mjs';
import { createGameState, playMove, replayAt, undoMoves } from '../core/game-state.mjs';
import { getTopology, TOPOLOGY_IDS } from '../core/topology.mjs';
import GamePage from './GamePage';
import JourneyPage from './JourneyPage';

type Topology = any;
type GameState = any;
type AIStatus = { thinking: boolean; engine: string; message: string; warning: string | null; error: string | null; depth?: number | null; nodes?: number | null; elapsedMs?: number | null; timedOut?: boolean; stoppedBy?: string | null };
type Preferences = { topology: string; difficulty: string; view: '2d' | '3d'; coordinates: boolean; humanPlayer: number };
const PREFS_KEY = 'topology-gomoku.preferences.v1';
const PROGRESS_KEY = 'topology-gomoku.progress.v1';
const VALID_DIFFICULTIES = ['casual', 'standard', 'strong', 'max'];

function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return {
      topology: TOPOLOGY_IDS.includes(saved.topology) ? saved.topology : 'plane',
      difficulty: VALID_DIFFICULTIES.includes(saved.difficulty) ? saved.difficulty : 'max',
      view: saved.view === '3d' ? '3d' : '2d',
      coordinates: saved.coordinates !== false,
      humanPlayer: saved.humanPlayer === -1 ? -1 : 1,
    };
  } catch {
    return { topology: 'plane', difficulty: 'max', view: '2d', coordinates: true, humanPlayer: 1 };
  }
}

function readProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]');
    return new Set(Array.isArray(value) ? value.filter((id) => TOPOLOGY_IDS.includes(id)) : []);
  } catch { return new Set<string>(); }
}

const STARTUP_PREFERENCES = readPreferences();
const BUDGETS: Record<string, number> = { casual: 300, standard: 700, strong: 1400, max: 5000 };

export default function App() {
  const [selectedId, setSelectedId] = useState(STARTUP_PREFERENCES.topology);
  const [onJourney, setOnJourney] = useState(true);
  const [game, setGame] = useState<GameState>(() => createGameState(getTopology(STARTUP_PREFERENCES.topology)));
  const [difficulty, setDifficulty] = useState(STARTUP_PREFERENCES.difficulty);
  const [view, setView] = useState<'2d' | '3d'>(STARTUP_PREFERENCES.view);
  const [coordinates, setCoordinates] = useState(STARTUP_PREFERENCES.coordinates);
  const [humanPlayer, setHumanPlayer] = useState(STARTUP_PREFERENCES.humanPlayer);
  const [completed, setCompleted] = useState<Set<string>>(readProgress);
  const [replayPly, setReplayPly] = useState<number | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [aiStatus, setAIStatus] = useState<AIStatus>({
    thinking: false, engine: STARTUP_PREFERENCES.topology === 'plane' ? 'Rapfi WASM' : '拓扑原生威胁搜索',
    message: '', warning: null, error: null,
  });
  const engineRef = useRef<ReturnType<typeof createAIEngine> | null>(null);
  const searchSequenceRef = useRef(0);
  const topology = getTopology(selectedId) as Topology;
  const allTopologies = TOPOLOGY_IDS.map((id) => getTopology(id));

  if (!engineRef.current) engineRef.current = createAIEngine();

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ topology: selectedId, difficulty, view, coordinates, humanPlayer }));
  }, [selectedId, difficulty, view, coordinates, humanPlayer]);

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...completed]));
  }, [completed]);

  useEffect(() => {
    if (game.status !== 'won' || game.winner !== humanPlayer) return;
    setCompleted((previous) => {
      if (previous.has(selectedId)) return previous;
      const next = new Set(previous);
      next.add(selectedId);
      return next;
    });
  }, [game.status, game.winner, humanPlayer, selectedId]);

  useEffect(() => {
    if (onJourney || replayPly !== null || game.status !== 'playing' || game.toMove === humanPlayer) return;
    const engine = engineRef.current!;
    const request = ++searchSequenceRef.current;
    let lastSearchInfo: any = {};
    setAIStatus((previous) => ({ ...previous, thinking: true, engine: selectedId === 'plane' ? 'Rapfi WASM' : '拓扑原生威胁搜索', message: '正在读取当前局面的攻防机会…', warning: null, error: null, depth: null, nodes: null, elapsedMs: null, timedOut: false }));
    engine.chooseMove(game, topology, { difficulty, budgetMs: BUDGETS[difficulty] }, (info: any) => {
      if (searchSequenceRef.current !== request) return;
      lastSearchInfo = { ...lastSearchInfo, ...info };
      setAIStatus((previous) => ({
        ...previous,
        thinking: true,
        engine: info?.engine || previous.engine,
        depth: Number.isFinite(info?.depth) ? info.depth : previous.depth,
        nodes: Number.isFinite(info?.nodes) ? info.nodes : previous.nodes,
        elapsedMs: Number.isFinite(info?.elapsedMs) ? info.elapsedMs : previous.elapsedMs,
        message: Number.isFinite(info?.depth) ? `搜索深度 ${info.depth} · ${info.nodes ?? 0} 个局面 · ${info.elapsedMs ?? 0} ms` : '正在分析攻防与连线…',
      }));
    }).then((result: any) => {
      if (searchSequenceRef.current !== request) return;
      const depth = Number.isFinite(result.depth) ? result.depth : Number.isFinite(lastSearchInfo.depth) ? lastSearchInfo.depth : null;
      const nodes = Number.isFinite(result.nodes) ? result.nodes : Number.isFinite(lastSearchInfo.nodes) ? lastSearchInfo.nodes : null;
      const elapsedMs = Number.isFinite(result.elapsedMs) ? result.elapsedMs : Number.isFinite(lastSearchInfo.elapsedMs) ? lastSearchInfo.elapsedMs : null;
      const statisticParts = [
        depth !== null ? `深度 ${depth}` : '',
        nodes !== null ? `${nodes} 个局面` : '',
        elapsedMs !== null ? `${elapsedMs} ms` : '',
      ].filter(Boolean);
      const stopLabel = result.stoppedBy === 'time' ? '已到时间预算' : result.stoppedBy === 'node-limit' ? '已到节点预算' : '';
      const searchStats = statisticParts.length ? ` · ${statisticParts.join(' · ')}${stopLabel ? ` · ${stopLabel}` : ''}` : '';
      setAIStatus({
        thinking: false,
        engine: result.engine || (selectedId === 'plane' ? 'Rapfi WASM' : '拓扑原生威胁搜索'),
        depth,
        nodes,
        elapsedMs,
        timedOut: Boolean(result.timedOut),
        message: result.reason === 'immediate-win' ? '抓住了立即获胜的落点。' : result.reason === 'forced-block' ? '挡住对手的一手胜势。' : result.reason === 'forced-loss' ? '对手已有多个立即胜点，无法用一手全部防住。' : result.stoppedBy === 'time' ? `搜索时间已用尽${searchStats}` : result.stoppedBy === 'node-limit' ? `搜索达到节点预算${searchStats}` : searchStats ? `搜索完成${searchStats}` : result.reason === 'engine-search' ? '引擎已返回落点。' : result.cellId ? '预算内未完成搜索层。' : '已完成局面分析。',
        warning: result.warning ?? null,
        error: null,
      });
      if (result.cellId) setGame((current: GameState) => {
        if (current !== game || current.status !== 'playing' || current.toMove === humanPlayer) return current;
        return playMove(current, result.cellId, topology);
      });
    }).catch((error: any) => {
      if (searchSequenceRef.current !== request || error?.name === 'AbortError') return;
      setAIStatus((previous) => ({ ...previous, thinking: false, error: error?.message || 'AI 搜索失败', message: '', warning: null }));
    });
    return () => {
      searchSequenceRef.current += 1;
      engine.cancel();
    };
  }, [game, topology, selectedId, humanPlayer, difficulty, replayPly, retryToken, onJourney]);

  useEffect(() => () => engineRef.current?.destroy(), []);

  const resetAIStatus = useCallback((id = selectedId) => setAIStatus({
    thinking: false, engine: id === 'plane' ? 'Rapfi WASM' : '拓扑原生威胁搜索', message: '', warning: null, error: null, depth: null, nodes: null, elapsedMs: null, timedOut: false,
  }), [selectedId]);

  const selectTopology = (id: string) => {
    const nextTopology = getTopology(id) as Topology;
    if (!nextTopology) return;
    engineRef.current?.cancel();
    setSelectedId(id);
    setOnJourney(false);
    setGame(createGameState(nextTopology));
    setReplayPly(null);
    resetAIStatus(id);
  };

  const restart = () => {
    engineRef.current?.cancel();
    setGame(createGameState(topology));
    setReplayPly(null);
    resetAIStatus();
  };

  const changeSide = (player: number) => {
    if (player === humanPlayer) return;
    engineRef.current?.cancel();
    setHumanPlayer(player);
    setGame(createGameState(topology));
    setReplayPly(null);
    resetAIStatus();
  };

  const undo = () => {
    if (!game.moves.length) return;
    engineRef.current?.cancel();
    const count = game.toMove === humanPlayer && game.moves.length > 1 ? 2 : 1;
    setGame(undoMoves(game, count, topology));
    setReplayPly(null);
    resetAIStatus();
  };

  const move = (cellId: string) => {
    if (game.status !== 'playing' || game.toMove !== humanPlayer || aiStatus.thinking || aiStatus.error) return;
    try {
      setGame(playMove(game, cellId, topology));
      setReplayPly(null);
      setAIStatus((previous) => ({ ...previous, message: '', error: null, warning: null, depth: null, nodes: null, elapsedMs: null, timedOut: false }));
    } catch { /* occupied and invalid points are ignored by the shared state rules */ }
  };

  const setReplay = (ply: number | null) => {
    if (ply === null) { setReplayPly(null); return; }
    setReplayPly(Math.max(0, Math.min(game.moves.length, ply)));
  };

  const displayState = replayPly === null ? game : replayAt(game, replayPly, topology);

  return onJourney ? (
    <JourneyPage topologies={allTopologies} completed={completed} onSelect={selectTopology} />
  ) : (
    <GamePage
      topology={topology}
      state={game}
      displayState={displayState}
      humanPlayer={humanPlayer}
      difficulty={difficulty}
      view={view}
      coordinates={coordinates}
      replayPly={replayPly}
      aiStatus={aiStatus}
      onBack={() => { engineRef.current?.cancel(); setOnJourney(true); setReplayPly(null); }}
      onChangeTopology={selectTopology}
      onMove={move}
      onRestart={restart}
      onUndo={undo}
      onSetDifficulty={setDifficulty}
      onSetHumanPlayer={changeSide}
      onSetView={setView}
      onSetCoordinates={setCoordinates}
      onReplay={setReplay}
      onRetryAI={() => { engineRef.current?.cancel(); setAIStatus((previous) => ({ ...previous, error: null, thinking: false })); setRetryToken((value) => value + 1); }}
    />
  );
}
