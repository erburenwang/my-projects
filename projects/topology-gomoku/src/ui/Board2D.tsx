import { useEffect, useMemo, useState } from 'react';
import { clampCursor } from './board-cursor.mjs';

type Topology = any;
type Props = {
  topology: Topology;
  board: Map<string, number>;
  moves: Array<{ cellId: string; player: number }>;
  lastMove: string | null;
  winningLine: string[] | null;
  coordinates: boolean;
  disabled?: boolean;
  onMove: (cellId: string) => void;
};

const LETTERS = 'ABCDEFGHIJKLMNOP';

export default function Board2D({ topology, board, moves, lastMove, winningLine, coordinates, disabled, onMove }: Props) {
  const [cursor, setCursor] = useState({ x: Math.floor(topology.width / 2), y: Math.floor(topology.height / 2) });
  const activeCursor = clampCursor(cursor, topology.width, topology.height);
  useEffect(() => {
    setCursor((current) => clampCursor(current, topology.width, topology.height));
  }, [topology.id, topology.width, topology.height]);
  const step = 44;
  const innerWidth = (topology.width - 1) * step;
  const innerHeight = (topology.height - 1) * step;
  const marginX = (900 - innerWidth) / 2;
  const marginY = (900 - innerHeight) / 2;
  const moveIndex = useMemo(() => new Map(moves.map((move, index) => [move.cellId, index + 1])), [moves]);
  const winning = new Set(winningLine ?? []);
  const latestMoves = new Set(moves.slice(-5).map((move) => move.cellId));

  const point = (x: number, y: number) => ({ x: marginX + x * step, y: marginY + y * step });
  const clickCell = (x: number, y: number) => {
    const nextCursor = clampCursor({ x, y }, topology.width, topology.height);
    setCursor(nextCursor);
    const cellId = topology.cellAt(x, y);
    if (!disabled && cellId) onMove(cellId);
  };

  const handleKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    let { x, y } = activeCursor;
    if (event.key === 'ArrowLeft') x = Math.max(0, x - 1);
    else if (event.key === 'ArrowRight') x = Math.min(topology.width - 1, x + 1);
    else if (event.key === 'ArrowUp') y = Math.max(0, y - 1);
    else if (event.key === 'ArrowDown') y = Math.min(topology.height - 1, y + 1);
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      clickCell(activeCursor.x, activeCursor.y);
      return;
    } else return;
    event.preventDefault();
    setCursor({ x, y });
  };

  const showChartPoint = (x: number, y: number) => {
    if ((topology.id === 'sphere' || topology.id === 'projective') && (y === 0 || y === topology.height - 1)) {
      return x === Math.floor(topology.width / 2);
    }
    return true;
  };
  const left = marginX;
  const right = marginX + innerWidth;
  const top = marginY;
  const bottom = marginY + innerHeight;

  return (
    <svg
      className="board-svg"
      viewBox="0 0 900 900"
      role="grid"
      tabIndex={0}
      aria-label={`${topology.name}二维棋盘。使用方向键移动，回车落子。`}
      onKeyDown={handleKeyDown}
    >
      <defs>
        <radialGradient id="wood" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#f9f7f0" />
          <stop offset="100%" stopColor="#f2efe6" />
        </radialGradient>
        <filter id="stone-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#1d2c26" floodOpacity="0.16" />
        </filter>
        <marker id="seam-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#6b9385" />
        </marker>
      </defs>
      <rect x="18" y="18" width="864" height="864" rx="34" fill="url(#wood)" />

      {Array.from({ length: topology.height }, (_, y) => {
        const p1 = point(0, y);
        const p2 = point(topology.width - 1, y);
        const isPole = (topology.id === 'sphere' || topology.id === 'projective') && (y === 0 || y === topology.height - 1);
        return <line key={`row-${y}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className={isPole ? 'board-line board-line-pole' : 'board-line'} />;
      })}
      {Array.from({ length: topology.width }, (_, x) => {
        const p1 = point(x, 0);
        const p2 = point(x, topology.height - 1);
        return <line key={`col-${x}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="board-line" />;
      })}

      {['cylinder', 'torus', 'mobius', 'klein'].includes(topology.id) && (
        <g className="seam-guides" aria-hidden="true">
          <path d={`M${left - 18} ${top + 18} C${left - 34} ${top + 130}, ${left - 34} ${bottom - 130}, ${left - 18} ${bottom - 18}`} markerEnd="url(#seam-arrow)" />
          <path d={`M${right + 18} ${bottom - 18} C${right + 34} ${bottom - 130}, ${right + 34} ${top + 130}, ${right + 18} ${top + 18}`} markerEnd="url(#seam-arrow)" />
          <text x="450" y="54" textAnchor="middle">{topology.id === 'mobius' ? '扭转接缝' : '相接边界'}</text>
        </g>
      )}
      {topology.id === 'torus' && (
        <g className="seam-guides seam-guides-horizontal" aria-hidden="true">
          <path d={`M${left + 18} ${top - 18} C${left + 160} ${top - 34}, ${right - 160} ${top - 34}, ${right - 18} ${top - 18}`} markerEnd="url(#seam-arrow)" />
          <path d={`M${right - 18} ${bottom + 18} C${right - 160} ${bottom + 34}, ${left + 160} ${bottom + 34}, ${left + 18} ${bottom + 18}`} markerEnd="url(#seam-arrow)" />
        </g>
      )}
      {(topology.id === 'sphere' || topology.id === 'projective') && (
        <g className="pole-labels" aria-hidden="true">
          <text x="450" y={top - 16} textAnchor="middle">{topology.id === 'sphere' ? '北极 · 经线汇聚' : '对跖点识别'}</text>
          <text x="450" y={bottom + 28} textAnchor="middle">{topology.id === 'sphere' ? '南极 · 经线汇聚' : '对跖点识别'}</text>
        </g>
      )}
      {topology.id === 'plane' && <text x="450" y="54" textAnchor="middle" className="flat-board-label">边界止步</text>}

      {coordinates && Array.from({ length: topology.width }, (_, x) => {
        const p = point(x, 0);
        return <text key={`letter-${x}`} className="coordinate-label" x={p.x} y={top - 25} textAnchor="middle">{LETTERS[x]}</text>;
      })}
      {coordinates && Array.from({ length: topology.height }, (_, y) => {
        const p = point(0, y);
        return <text key={`number-${y}`} className="coordinate-label" x={left - 30} y={p.y + 5} textAnchor="middle">{y + 1}</text>;
      })}

      {topology.chart.filter((entry: any) => showChartPoint(entry.x, entry.y)).map((entry: any) => {
        const p = point(entry.x, entry.y);
        const player = board.get(entry.cellId);
        const move = moveIndex.get(entry.cellId);
        const isCursor = activeCursor.x === entry.x && activeCursor.y === entry.y;
        const repeated = topology.id === 'projective' && topology.chart.some((other: any) => other.cellId === entry.cellId && (other.x !== entry.x || other.y !== entry.y));
        return (
          <g key={`${entry.x}:${entry.y}`} className="board-intersection" onClick={() => clickCell(entry.x, entry.y)}>
            <circle cx={p.x} cy={p.y} r="21" fill="transparent" className="intersection-hit" />
            {repeated && !player && <circle cx={p.x} cy={p.y} r="2.4" className="antipodal-point" />}
            {isCursor && <circle cx={p.x} cy={p.y} r="19" className="keyboard-cursor" />}
            {player && (
              <g filter="url(#stone-shadow)">
                {(entry.cellId === lastMove || winning.has(entry.cellId)) && <circle cx={p.x} cy={p.y} r="19" className={winning.has(entry.cellId) ? 'stone-halo winning-halo' : 'stone-halo'} />}
                <circle cx={p.x} cy={p.y} r="15.5" className={player === 1 ? 'stone-black' : 'stone-white'} />
                {latestMoves.has(entry.cellId) && <text x={p.x} y={p.y + 4} textAnchor="middle" className={player === 1 ? 'move-number move-number-light' : 'move-number'}>{move}</text>}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
