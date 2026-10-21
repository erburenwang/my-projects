import { TOPOLOGY_IDS } from '../core/topology.mjs';

type Topology = any;
type Props = {
  topologies: Topology[];
  completed: Set<string>;
  onSelect: (id: string) => void;
};

const SHAPES: Record<string, string> = {
  plane: 'shape-plane', cylinder: 'shape-cylinder', torus: 'shape-torus',
  mobius: 'shape-mobius', klein: 'shape-klein', projective: 'shape-projective', sphere: 'shape-sphere',
};
const KIND: Record<string, string> = {
  plane: '平面', cylinder: '圆柱', torus: '环面', mobius: '莫比乌斯环',
  klein: '克莱因瓶', projective: '实射影平面', sphere: '球面',
};

export default function JourneyPage({ topologies, completed, onSelect }: Props) {
  const ordered = TOPOLOGY_IDS.map((id) => topologies.find((topology) => topology.id === id)).filter(Boolean) as Topology[];
  return (
    <main className="journey-page">
      <header className="journey-topbar">
        <a className="wordmark" href="#top" aria-label="拓扑五子棋首页"><span className="wordmark-mark">五</span> 拓扑棋局</a>
        <div className="journey-progress"><span>旅程</span><strong>{completed.size} / 7</strong></div>
        <span className="topbar-note">自由规则 · 五子连线获胜</span>
      </header>

      <section className="journey-layout" id="top">
        <div className="journey-intro">
          <div className="eyebrow"><span className="eyebrow-dot" /> 一盘棋，七种空间</div>
          <h1>拓扑<br />五子棋</h1>
          <p className="journey-lede">边界之外，也能连成一线。</p>
          <p className="journey-copy">棋子穿过接缝继续前进。每一张棋盘，都是一段新的空间旅程。</p>
          <div className="journey-stats">
            <div><strong>07</strong><span>种曲面</span></div>
            <i />
            <div><strong>15×15</strong><span>方庭默认格点</span></div>
          </div>
          <div className="journey-footnote">对弈中可随时调整难度和棋盘视图</div>
        </div>

        <div className="journey-collection" aria-label="选择棋盘旅程">
          <div className="collection-heading"><span>选择一段旅程</span><span>01 — 07</span></div>
          <div className="journey-grid">
            {ordered.map((topology, index) => {
              const done = completed.has(topology.id);
              return (
                <button
                  className={`journey-card ${index === 6 ? 'journey-card-wide' : ''} ${done ? 'is-complete' : ''}`}
                  key={topology.id}
                  onClick={() => onSelect(topology.id)}
                  aria-label={`进入${topology.name}：${topology.width}×${topology.height}格点，${topology.subtitle}${done ? '，已完成' : ''}`}
                >
                  <span className={`topology-glyph ${SHAPES[topology.id]}`} aria-hidden="true"><i /><b /><em /></span>
                  <span className="card-copy"><span className="card-kind">{KIND[topology.id]}</span><strong>{topology.name}</strong><small>{topology.subtitle}</small><small className="card-size">{topology.width} × {topology.height} 格点</small></span>
                  <span className="card-status">{done ? '已通关' : String(index + 1).padStart(2, '0')}</span>
                  <span className="card-arrow" aria-hidden="true">↗</span>
                </button>
              );
            })}
          </div>
          <div className="collection-bottom"><span>从熟悉的平面开始，探索边界如何相遇。</span><span>点击卡片进入对弈 <b>→</b></span></div>
        </div>
      </section>
      <footer className="journey-footer"><span>拓扑五子棋</span><span>由离散曲面定义连线 · 本地保存进度</span><span>无需联网</span></footer>
    </main>
  );
}
