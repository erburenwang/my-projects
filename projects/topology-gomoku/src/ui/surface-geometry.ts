import * as THREE from 'three';

type TopologyShape = {
  id: string;
  surface: string;
  width: number;
  height: number;
};

export type ChartPoint = { x: number; y: number; cellId: string };

export function getSurfacePosition(topology: TopologyShape, x: number, y: number) {
  const u = (x / topology.width) * Math.PI * 2;
  const v = topology.height > 1
    ? y / (topology.surface === 'torus' ? topology.height : topology.height - 1)
    : 0.5;
  const centeredY = (0.5 - v) * 3.4;
  const scale = 2.15;

  switch (topology.surface) {
    case 'cylinder': {
      const radius = 1.6;
      return new THREE.Vector3(radius * Math.cos(u), centeredY, radius * Math.sin(u));
    }
    case 'torus': {
      const tube = 0.78;
      const ring = 1.48 + tube * Math.cos(v * Math.PI * 2);
      return new THREE.Vector3(ring * Math.cos(u), tube * Math.sin(v * Math.PI * 2), ring * Math.sin(u));
    }
    case 'mobius': {
      const transverse = (v - 0.5) * 1.45;
      const radius = 1.7 + transverse * Math.cos(u / 2);
      return new THREE.Vector3(radius * Math.cos(u), transverse * Math.sin(u / 2), radius * Math.sin(u));
    }
    case 'klein': {
      const a = u;
      const b = v * Math.PI * 2;
      const ring = 1.55 + Math.cos(b / 2) * Math.sin(a) - Math.sin(b / 2) * Math.sin(2 * a);
      return new THREE.Vector3(ring * Math.cos(b), ring * Math.sin(b), Math.sin(b / 2) * Math.sin(a) + Math.cos(b / 2) * Math.sin(2 * a));
    }
    case 'sphere':
    case 'projective': {
      const latitude = (v - 0.5) * Math.PI;
      const longitude = u;
      return new THREE.Vector3(
        scale * Math.cos(latitude) * Math.cos(longitude),
        scale * Math.sin(latitude),
        scale * Math.cos(latitude) * Math.sin(longitude),
      );
    }
    default:
      return new THREE.Vector3((x / (topology.width - 1) - 0.5) * 4.25, centeredY, 0);
  }
}
