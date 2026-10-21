import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getSurfacePosition } from './surface-geometry';

type Topology = any;
type Props = {
  topology: Topology;
  board: Map<string, number>;
  lastMove: string | null;
  winningLine: string[] | null;
  onMove: (cellId: string) => void;
};

export default function SurfaceBoard({ topology, board, lastMove, winningLine, onMove }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stoneGroupRef = useRef<THREE.Group | null>(null);
  const pointPositionsRef = useRef<Map<string, THREE.Vector3[]>>(new Map());
  const targetsRef = useRef<THREE.Mesh[]>([]);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f8f6ef');
    scene.add(new THREE.AmbientLight('#fff8e6', 2.4));
    const keyLight = new THREE.DirectionalLight('#ffffff', 3.8);
    keyLight.position.set(-3, 5, 7);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight('#9bb8a9', 1.4);
    fillLight.position.set(4, -2, -5);
    scene.add(fillLight);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    camera.position.set(0, 0.8, topology.surface === 'plane' ? 9.5 : 8.2);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.replaceChildren(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', `${topology.name}三维棋盘，可拖动旋转`);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minDistance = 4.5;
    controls.maxDistance = 12;
    controls.target.set(0, 0, 0);
    controls.update();

    const pointPositions = new Map<string, THREE.Vector3[]>();
    const flatPoints = topology.chart as Array<{ x: number; y: number; cellId: string }>;
    for (const point of flatPoints) {
      const position = getSurfacePosition(topology, point.x, point.y);
      const entries = pointPositions.get(point.cellId) ?? [];
      entries.push(position);
      pointPositions.set(point.cellId, entries);
    }
    pointPositionsRef.current = pointPositions;

    const lineVertices: number[] = [];
    const drawn = new Set<string>();
    for (const point of flatPoints) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const next = topology.stepChart(point.x, point.y, dx, dy);
        if (!next) continue;
        const aKey = `${point.x}:${point.y}`;
        const bKey = `${next.x}:${next.y}`;
        if (aKey === bKey) continue;
        const key = [aKey, bKey].sort().join('|');
        if (drawn.has(key)) continue;
        drawn.add(key);
        const start = getSurfacePosition(topology, point.x, point.y);
        const end = getSurfacePosition(topology, next.x, next.y);
        if (start.distanceToSquared(end) < 0.0001) continue;
        lineVertices.push(start.x, start.y, start.z, end.x, end.y, end.z);
      }
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lineVertices, 3));
    const grid = new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: '#8c988b', transparent: true, opacity: 0.55 }));
    scene.add(grid);

    const visiblePoints = new THREE.Group();
    const pointMaterial = new THREE.MeshBasicMaterial({ color: '#789184', transparent: true, opacity: 0.6 });
    const pointGeometry = new THREE.SphereGeometry(0.035, 8, 8);
    const pickGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const pickMaterial = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    const pickTargets: THREE.Mesh[] = [];
    const pickGroup = new THREE.Group();
    for (const point of flatPoints) {
      const position = getSurfacePosition(topology, point.x, point.y);
      const marker = new THREE.Mesh(pointGeometry, pointMaterial);
      marker.position.copy(position);
      visiblePoints.add(marker);
      const target = new THREE.Mesh(pickGeometry, pickMaterial);
      target.position.copy(position);
      target.userData.cellId = point.cellId;
      pickGroup.add(target);
      pickTargets.push(target);
    }
    scene.add(visiblePoints);
    scene.add(pickGroup);
    targetsRef.current = pickTargets;
    const stones = new THREE.Group();
    scene.add(stones);
    stoneGroupRef.current = stones;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const handlePointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
    const handlePointerUp = (event: PointerEvent) => {
      if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) {
        down = null;
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const selected = raycaster.intersectObjects(pickTargets, false)[0]?.object.userData.cellId;
      if (typeof selected === 'string') onMoveRef.current(selected);
      down = null;
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    let frame = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    render();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      gridGeometry.dispose();
      grid.material.dispose();
      pointGeometry.dispose();
      pointMaterial.dispose();
      pickGeometry.dispose();
      pickMaterial.dispose();
      renderer.dispose();
      stoneGroupRef.current = null;
      targetsRef.current = [];
      host.replaceChildren();
    };
  }, [topology]);

  useEffect(() => {
    const group = stoneGroupRef.current;
    if (!group) return;
    for (const child of [...group.children]) {
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    const winning = new Set(winningLine ?? []);
    const shown = new Set<string>();
    for (const point of topology.chart as Array<{ x: number; y: number; cellId: string }>) {
      const player = board.get(point.cellId);
      if (!player) continue;
      const position = getSurfacePosition(topology, point.x, point.y);
      const positionKey = `${position.x.toFixed(3)}:${position.y.toFixed(3)}:${position.z.toFixed(3)}`;
      const shownKey = `${point.cellId}:${positionKey}`;
      if (shown.has(shownKey)) continue;
      shown.add(shownKey);

      if (winning.has(point.cellId) || point.cellId === lastMove) {
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(0.205, 16, 16),
          new THREE.MeshBasicMaterial({ color: winning.has(point.cellId) ? '#c59b4d' : '#93b9a8', transparent: true, opacity: 0.8 }),
        );
        halo.position.copy(position);
        group.add(halo);
      }
      const stone = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 24, 24),
        new THREE.MeshStandardMaterial({
          color: player === 1 ? '#17342e' : '#fffdf5',
          roughness: player === 1 ? 0.24 : 0.4,
          metalness: 0.06,
          emissive: player === 1 ? '#06130f' : '#807c70',
          emissiveIntensity: player === 1 ? 0.13 : 0.025,
        }),
      );
      stone.position.copy(position);
      group.add(stone);
    }
  }, [topology, board, lastMove, winningLine]);

  return (
    <div className="surface-canvas-shell">
      <div ref={hostRef} className="surface-canvas" />
      <div className="surface-tip"><span className="gesture-icon" aria-hidden="true">↻</span> 拖动旋转 · 滚轮缩放</div>
      {(topology.id === 'klein' || topology.id === 'projective') && (
        <div className="surface-disclaimer">三维自交示意 · 规则按拓扑接缝判定</div>
      )}
    </div>
  );
}
