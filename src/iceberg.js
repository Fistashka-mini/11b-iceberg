import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

// Уровень воды и вертикальные границы айсберга (в юнитах сцены)
export const WATER_Y = 0;
export const ICE_TOP = 7.5;
export const ICE_BOTTOM = -27;

// Профиль радиуса: [доля высоты (0 — дно, 1 — вершина), радиус]
// Ватерлиния ≈ 0.806 — над водой торчит только «верхушка».
const PROFILE = [
  [0.0, 0.6],
  [0.08, 3.4],
  [0.22, 7.6],
  [0.4, 9.6],
  [0.58, 8.4],
  [0.72, 6.2],
  [0.78, 4.9],
  [0.86, 4.0],
  [0.94, 2.9],
  [1.0, 1.6],
];

function catmull(a, b, c, d, u) {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
}

export function profileRadius(t) {
  const n = PROFILE.length;
  let i = 0;
  while (i < n - 2 && t > PROFILE[i + 1][0]) i++;
  const p0 = PROFILE[Math.max(i - 1, 0)];
  const p1 = PROFILE[i];
  const p2 = PROFILE[i + 1];
  const p3 = PROFILE[Math.min(i + 2, n - 1)];
  const u = THREE.MathUtils.clamp((t - p1[0]) / (p2[0] - p1[0]), 0, 1);
  return Math.max(catmull(p0[1], p1[1], p2[1], p3[1], u), 0.05);
}

// детерминированный рандом — форма айсберга одинаковая при каждой загрузке
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createIceberg(seed = 2028) {
  const simplex = new SimplexNoise({ random: mulberry32(seed) });

  const geo = new THREE.CylinderGeometry(1, 1, 1, 64, 80, false);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cAbove = new THREE.Color(0xf6fbff);
  const cWaterline = new THREE.Color(0xc9e8ff);
  const cDeep = new THREE.Color(0x7db6e6);
  const tWater = (WATER_Y - ICE_BOTTOM) / (ICE_TOP - ICE_BOTTOM);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp(y + 0.5, 0, 1); // 0 — дно, 1 — верх
    const r0 = Math.sqrt(x * x + z * z); // 1 на боках, 0..1 на крышках

    // шум зависит только от исходной позиции — швы между крышкой и боками остаются закрытыми
    const n1 = simplex.noise3d(x * 1.5, t * 3.2, z * 1.5);
    const n2 = simplex.noise3d(x * 3.6 + 7, t * 7.5, z * 3.6 - 3);
    const n3 = simplex.noise3d(x * 2.2 - 5, t * 5.0 + 11, z * 2.2);

    const aboveBoost = THREE.MathUtils.smoothstep(t, 0.74, 1.0);
    const amp = 0.24 + 0.16 * aboveBoost;
    const radius = profileRadius(t) * r0 * (1 + amp * n1 + 0.1 * n2);
    const yWorld = THREE.MathUtils.lerp(ICE_BOTTOM, ICE_TOP, t) + n3 * (0.7 + 0.6 * aboveBoost);

    pos.setXYZ(i, x * radius / (r0 || 1), yWorld, z * radius / (r0 || 1));

    if (t >= tWater) {
      tmp.copy(cAbove).lerp(cWaterline, THREE.MathUtils.clamp(1 - (t - tWater) / 0.06, 0, 1) * 0.5);
    } else {
      tmp.copy(cDeep).lerp(cWaterline, Math.pow(t / tWater, 1.4));
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.52,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'iceberg';
  return mesh;
}
