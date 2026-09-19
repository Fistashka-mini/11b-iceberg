import * as THREE from 'three';
import { WATER_Y, ICE_BOTTOM } from './iceberg.js';

function softCircleTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeField({ count, box, size, color, opacity, blending, speed }) {
  const positions = new Float32Array(count * 3);
  const vel = new Float32Array(count * 2); // [скорость по y, фаза дрейфа]
  for (let i = 0; i < count; i++) {
    positions[i * 3] = THREE.MathUtils.randFloat(box.x[0], box.x[1]);
    positions[i * 3 + 1] = THREE.MathUtils.randFloat(box.y[0], box.y[1]);
    positions[i * 3 + 2] = THREE.MathUtils.randFloat(box.z[0], box.z[1]);
    vel[i * 2] = THREE.MathUtils.randFloat(speed[0], speed[1]);
    vel[i * 2 + 1] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: softCircleTexture(),
    size,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, positions, vel, box, count };
}

export function createParticles() {
  const group = new THREE.Group();

  // снег над водой
  const snow = makeField({
    count: 700,
    box: { x: [-45, 45], y: [WATER_Y, WATER_Y + 32], z: [-45, 45] },
    size: 0.32,
    color: 0xffffff,
    opacity: 0.85,
    blending: THREE.NormalBlending,
    speed: [-1.4, -0.5],
  });

  // планктон / пузырьки под водой
  const plankton = makeField({
    count: 1100,
    box: { x: [-50, 50], y: [ICE_BOTTOM - 6, WATER_Y - 0.5], z: [-50, 50] },
    size: 0.2,
    color: 0xa9dcff,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    speed: [0.15, 0.6],
  });

  group.add(snow.points, plankton.points);

  function step(field, dt, t, drift) {
    const { positions, vel, box, count } = field;
    const yMin = box.y[0];
    const yMax = box.y[1];
    for (let i = 0; i < count; i++) {
      let y = positions[i * 3 + 1] + vel[i * 2] * dt;
      if (y < yMin) y = yMax;
      if (y > yMax) y = yMin;
      positions[i * 3 + 1] = y;
      positions[i * 3] += Math.sin(t * 0.6 + vel[i * 2 + 1]) * drift * dt;
    }
    field.points.geometry.attributes.position.needsUpdate = true;
  }

  return {
    group,
    update(dt, t) {
      step(snow, dt, t, 0.8);
      step(plankton, dt, t, 0.25);
    },
  };
}
