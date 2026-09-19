import * as THREE from 'three';
import { WATER_Y } from './iceberg.js';

// Солнечные лучи под водой — полупрозрачные плоскости с градиентом, всегда повёрнуты к камере
function shaftTexture(w = 64, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const fy = 1 - y / h; // 1 сверху
    const av = Math.pow(fy, 1.6);
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * 2 - 1;
      const ax = Math.pow(Math.max(0, 1 - fx * fx), 1.5);
      const i = (y * w + x) * 4;
      img.data[i] = 200;
      img.data[i + 1] = 235;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * av * ax);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLightShafts(count = 9) {
  const group = new THREE.Group();
  const tex = shaftTexture();
  const shafts = [];

  for (let i = 0; i < count; i++) {
    const width = THREE.MathUtils.randFloat(3, 7);
    const height = THREE.MathUtils.randFloat(22, 34);
    const geo = new THREE.PlaneGeometry(width, height);
    geo.translate(0, -height / 2, 0); // якорь — верхняя кромка
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const r = THREE.MathUtils.randFloat(11, 26);
    mesh.position.set(Math.cos(a) * r, WATER_Y - 0.3, Math.sin(a) * r);
    mesh.renderOrder = 2;
    group.add(mesh);
    shafts.push({ mesh, phase: Math.random() * Math.PI * 2, base: THREE.MathUtils.randFloat(0.06, 0.14) });
  }

  const target = new THREE.Vector3();
  return {
    group,
    update(t, camera, depthFade) {
      for (const s of shafts) {
        target.set(camera.position.x, s.mesh.position.y, camera.position.z);
        s.mesh.lookAt(target);
        s.mesh.rotateZ(0.14);
        s.mesh.material.opacity = (s.base + Math.sin(t * 0.7 + s.phase) * 0.03) * depthFade;
      }
    },
  };
}
