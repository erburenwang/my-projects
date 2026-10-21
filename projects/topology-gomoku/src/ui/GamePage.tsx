import { lazy, Suspense } from 'react';
import Board2D from './Board2D';

const SurfaceBoard = lazy(() => import('./SurfaceBoard'));

type Topology = any;
type GameState = any;
type Props = {
  topology: Topology;
  state: GameState;
  displayState: GameState;
  humanPlayer: number;
  difficulty: string;
  view: '2d' | '3d';
  coordinates: boolean;
  replayPly: number | null;
  aiStatus: { thinking: boolean; engine: string; message: string; warning: string | null; error: string | null; depth?: number | null; nodes?: number | null; timedOut?: boolean };
  onBack: () => void;
  onChangeTopology: (id: string) => void;
  onMove: (cellId: string) => void;
  onRestart: () => void;
  onUndo: () => void;
  onSetDifficulty: (difficulty: string) => void;
  onSetHumanPlayer: (player: number) => void;
  onSetView: (view: '2d' | '3d') => void;
  onSetCoordinates: (show: boolean) => void;
  onReplay: (ply: number | null) => void;
  onRetryAI: () => void;
};

const LABELS: Record<string, string> = {
  plane: '方庭', cylinder: '回廊', torus: '环游', mobius: '扭带', klein: '瓶界', projective: '双生', sphere: '归圆',
};
const DIFFICULTIES = [
  { id: 'casual', name: '入门' }, { id: 'standard', name: '标准' }, { id: 'strong', name: '强力' }, { id: 'max', name: '最高' },
];

export default function GamePage(props: Props) {
  const { topology, state, displayState, humanPlayer, difficulty, view, coordinates, replayPly, aiStatus } = props;
  const replaying = replayPly !== null;
  const isHumanTurn = state.toMove === humanPlayer;
  let headline = '';
  let subline = '';
  if (replaying) {
    headline = '棋谱复盘'; subline = `正在查看第 ${replayPly} 手 / 共 ${state.moves.length} 手`;
  } else if (state.status === 'won') {
    headline = state.winner === humanPlayer ? '这局赢了' : '再试一次';
    subline = state.winner === humanPlayer ? '五子连线，旅程完成。' : '引擎形成了连线。调整策略，再来一局。';
  } else if (state.status === 'draw') {
    headline = '和棋'; subline = '棋盘已满，重新开始一局吧。';
  } else if (aiStatus.error) {
    headline = '引擎暂时不可用'; subline = aiStatus.error;
  } else if (aiStatus.thinking) {
    headline = '引擎思考中'; subline = aiStatus.message || '正在分析攻防与连线…';
  } else if (isHumanTurn) {
    headline = '轮到你'; subline = `${humanPlayer === 1 ? '深色棋子' : '浅色棋子'} · 点击棋盘落子`;
  } else {
    headline = '轮到引擎'; subline = aiStatus.message || '引擎正在准备下一手。';
  }
  const canPlay = !replaying && state.status === 'playing' && isHumanTurn && !aiStatus.thinking && !aiStatus.error;
  const shownMove = displayState.moves.at(-1);
  const replayPosition = replayPly ?? 0;
  const coordinate = (move: any) => {
    if (!move) return '—';
    const points = topology.chart.filter((entry: any) => entry.cellId === move.cellId);
    if (topology.id === 'sphere') {
      if (points[0]?.y === 0) return '北极';
      if (points[0]?.y === topology.height - 1) return '南极';
    }
    if (topology.id === 'projective' && move.cellId === 'projective:pole') return '对跖极';
    const labels = [...new Set(points.map((point: any) => `${String.fromCharCode(65 + point.x)}${point.y + 1}`))];
    return labels.slice(0, 2).join(' / ') || move.cellId;
  };

  return (
    <main className="game-page">
      <header className="game-topbar">
        <button className="back-button" onClick={props.onBack} aria-label="返回旅程"><span>←</span><b>旅程</b></button>
        <div className="game-brand"><span className="wordmark-mark">五</span><span>拓扑棋局</span></div>
        <div className="mode-switcher" aria-label="选择棋盘旅程">
          {Object.entries(LABELS).map(([id, label]) => <button key={id} className={topology.id === id ? 'active' : ''} onClick={() => props.onChangeTopology(id)}>{label}</button>)}
        </div>
      </header>

      <section className="game-layout">
        <div className={`board-panel ${view === '3d' ? 'board-panel-3d' : ''}`}>
          <div className="board-panel-header">
            <div><span className="eyebrow"><span className="eyebrow-dot" /> 当前旅程</span><h1>{topology.name}<span>{topology.subtitle}</span></h1></div>
            <div className="view-switch" role="group" aria-label="棋盘视图">
              <button className={view === '2d' ? 'active' : ''} onClick={() => props.onSetView('2d')} aria-pressed={view === '2d'}><span>▦</span> 二维</button>
              <button className={view === '3d' ? 'active' : ''} onClick={() => props.onSetView('3d')} aria-pressed={view === '3d'}><span>◉</span> 三维</button>
            </div>
          </div>
          <div className="board-stage">
            {view === '2d' ? (
              <Board2D topology={topology} board={displayState.board} moves={displayState.moves} lastMove={displayState.moves.at(-1)?.cellId ?? null} winningLine={displayState.winningLine} coordinates={coordinates} disabled={!canPlay} onMove={props.onMove} />
            ) : (
              <Suspense fallback={<div className="surface-loading">正在载入本地三维视图…</div>}>
                <SurfaceBoard topology={topology} board={displayState.board} lastMove={displayState.moves.at(-1)?.cellId ?? null} winningLine={displayState.winningLine} onMove={(cellId) => canPlay && props.onMove(cellId)} />
              </Suspense>
            )}
            <div className="board-caption"><span>{topology.width} × {topology.height} 格点</span><span>{coordinates && displayState.moves.length ? `当前落点 ${coordinate(displayState.moves.at(-1))}` : coordinates ? '落子坐标会显示于此' : topology.surface === 'plane' ? '边界止步' : '越过接缝继续连线'}</span></div>
          </div>
          <div className="replay-bar">
            <button disabled={state.moves.length === 0 || (replaying && replayPly === 0)} onClick={() => props.onReplay(replaying ? Math.max(0, replayPly - 1) : Math.max(0, state.moves.length - 1))}><span>←</span> 上一步</button>
            <button className={replaying ? 'replay-active' : ''} disabled={state.moves.length === 0} onClick={() => props.onReplay(replaying ? null : 0)}><span>↶</span>{replaying ? '回到对局' : '复盘'}</button>
            <button disabled={!replaying || replayPosition >= state.moves.length} onClick={() => props.onReplay(Math.min(state.moves.length, replayPosition + 1))}>下一步 <span>→</span></button>
            {replaying && <span className="replay-count">{replayPly} / {state.moves.length}</span>}
          </div>
        </div>

        <aside className="game-sidebar">
          <div className="status-card">
            <div className="status-overline"><span className={aiStatus.thinking ? 'status-pulse' : ''} /> {replaying ? '棋谱复盘' : state.status === 'playing' ? (aiStatus.thinking ? '引擎分析' : '对局进行中') : '本局结束'}</div>
            <h2>{headline}</h2>
            <p>{subline}</p>
            {aiStatus.warning && <div className="engine-note"><strong>已切换分析来源</strong><span>{aiStatus.warning}</span></div>}
            {aiStatus.error && !replaying && <button className="retry-button" onClick={props.onRetryAI}>重试引擎 <span>↻</span></button>}
            <div className="turn-indicator">
              <div className={`turn-stone ${state.toMove === 1 ? 'dark' : 'light'} ${state.status !== 'playing' ? 'muted' : ''}`} />
              <span>{replaying ? displayState.status === 'won' ? '这一手形成胜局' : `之后应由${displayState.toMove === 1 ? '深色' : '浅色'}落子` : state.status === 'playing' ? `下一手：${state.toMove === 1 ? '深色' : '浅色'}` : state.status === 'draw' ? '双方战平' : `${state.winner === 1 ? '深色' : '浅色'}获胜`}</span>
              <span className="move-count">{replaying ? `${displayState.moves.length} / ${state.moves.length}` : `${state.moves.length} 手`}</span>
            </div>
            {!replaying && !aiStatus.thinking && aiStatus.message && (
              <div className="engine-result-note"><span>{aiStatus.engine}</span><span>{aiStatus.message}</span></div>
            )}
          </div>

          <div className="control-card">
            <div className="section-heading"><div><span className="eyebrow">对弈设置</span><h3>选择你的策略</h3></div><span className="settings-mark">✳</span></div>
            <div className="control-row">
              <span>你的棋子</span>
              <div className="segmented-control" role="group" aria-label="选择先后手">
                <button className={humanPlayer === 1 ? 'active' : ''} onClick={() => props.onSetHumanPlayer(1)}><i className="mini-stone dark" />先手</button>
                <button className={humanPlayer === -1 ? 'active' : ''} onClick={() => props.onSetHumanPlayer(-1)}><i className="mini-stone light" />后手</button>
              </div>
            </div>
            <div className="difficulty-label"><span>引擎难度</span><span className="engine-tag">{aiStatus.engine || '本地引擎'}</span></div>
            <div className="difficulty-options">
              {DIFFICULTIES.map((level, index) => <button key={level.id} className={difficulty === level.id ? 'active' : ''} onClick={() => props.onSetDifficulty(level.id)}><span>{String(index + 1).padStart(2, '0')}</span>{level.name}</button>)}
            </div>
            <label className="coordinate-toggle"><span><b>显示坐标</b><small>便于记录棋谱落点</small></span><input type="checkbox" checked={coordinates} onChange={(event) => props.onSetCoordinates(event.target.checked)} /><i aria-hidden="true" /></label>
            <div className="action-row">
              <button disabled={!state.moves.length || replaying || aiStatus.thinking} onClick={props.onUndo}><span>↶</span>悔棋</button>
              <button onClick={props.onRestart}><span>⟳</span>重新开始</button>
            </div>
          </div>

          <div className="move-card">
            <div className="move-card-heading"><div><span className="eyebrow">棋谱</span><h3>最近落子</h3></div><span>{state.moves.length.toString().padStart(2, '0')}</span></div>
            {state.moves.length ? (
              <div className="move-list">
                {state.moves.slice(-5).reverse().map((move: any, index: number) => (
                  <div className={`move-list-row ${index === 0 ? 'latest' : ''}`} key={`${move.cellId}-${state.moves.length - index}`}>
                    <span className={`mini-stone ${move.player === 1 ? 'dark' : 'light'}`} />
                    <span>{move.player === humanPlayer ? '你' : '引擎'}</span>
                    <b>{coordinate(move)}</b>
                    <small>第 {state.moves.length - index} 手</small>
                  </div>
                ))}
              </div>
            ) : <p className="empty-moves">第一手落下后，棋谱会显示在这里。</p>}
            {shownMove && <div className="last-move-note">当前局面 · {coordinate(shownMove)}</div>}
          </div>
          <p className="engine-disclaimer">AI 会优先识别立即胜点与必须防守。对完美棋手的胜负不作保证。</p>
        </aside>
      </section>
      <footer className="game-footer"><span>拓扑棋局 / {topology.name}</span><span>棋局保存在此设备的浏览器中</span><button onClick={props.onBack}>返回旅程 ↗</button></footer>
    </main>
  );
}
