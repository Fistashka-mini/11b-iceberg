import * as THREE from 'three';
import { createIceberg, ICE_TOP, ICE_BOTTOM, WATER_Y } from './iceberg.js';
import { createWater } from './water.js';
import { createSky } from './sky.js';
import { createParticles } from './particles.js';
import { createLightShafts } from './shafts.js';
import { drawAvatar } from './avatar.js';

const MARKER_SIZE = 2.4;
const MARKER_SIZE_HOVER = 3.0;

const SKY_FOG = new THREE.Color(0xe4f1fb);
const DEEP_A = new THREE.Color(0x1477b8); // сразу под поверхностью
const DEEP_B = new THREE.Color(0x061a36); // самое дно

export class IcebergScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(SKY_FOG.getHex(), 0.0025);
    this.scene.background = new THREE.Color().copy(SKY_FOG);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900);
    this.cameraTarget = new THREE.Vector3();

    this.clock = new THREE.Clock();
    this.progress = 0;
    this.targetProgress = 0;
    this.mouse = new THREE.Vector2(0, 0);
    this.mouseSmooth = new THREE.Vector2(0, 0);
    this.pointer = new THREE.Vector2(-10, -10);
    this.pointerDirty = false;
    this.raycaster = new THREE.Raycaster();

    this.markers = [];
    this.hovered = null;
    this.onHover = null; // (person|null, screenPos)

    this._fogTarget = new THREE.Color();
    this._v = new THREE.Vector3();

    this._build();
    this.resize();
  }

  _build() {
    // свет
    this.hemi = new THREE.HemisphereLight(0xd6ecff, 0x1c4d80, 1.15);
    this.sun = new THREE.DirectionalLight(0xfff3dc, 2.3);
    this.sun.position.set(18, 30, 16);
    this.fill = new THREE.DirectionalLight(0x6fb8ff, 0.55);
    this.fill.position.set(-22, -12, 12);
    this.scene.add(this.hemi, this.sun, this.fill);

    // небо
    this.sky = createSky();
    this.scene.add(this.sky.mesh);

    // айсберг (группа — чтобы качать вместе с маркерами)
    this.icebergGroup = new THREE.Group();
    this.iceberg = createIceberg();
    this.icebergGroup.add(this.iceberg);
    this.scene.add(this.icebergGroup);

    // вода
    this.water = createWater();
    this.scene.add(this.water.mesh);

    // лучи и частицы
    this.shafts = createLightShafts();
    this.scene.add(this.shafts.group);
    this.particles = createParticles();
    this.scene.add(this.particles.group);
  }

  // ---------- уровни ----------

  /** Проставляет каждому уровню координату y и «полувысоту» для смещения маркеров */
  layoutTiers(tiers) {
    const n = tiers.length;
    const topUnder = WATER_Y - 3.5;
    const bottomUnder = ICE_BOTTOM + 4.5;
    return tiers.map((tier, i) => {
      let y;
      if (i === 0) y = (ICE_TOP + WATER_Y) / 2 + 0.6;
      else y = n > 2 ? THREE.MathUtils.lerp(topUnder, bottomUnder, (i - 1) / (n - 2)) : topUnder;
      const spacing = n > 2 ? (topUnder - bottomUnder) / (n - 2) : 8;
      return { ...tier, index: i, y, half: spacing * 0.35 };
    });
  }

  // ---------- одноклассники ----------

  async addClassmate(person, tier) {
    const { canvas } = await drawAvatar(person, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      color: 0xe9f1f8,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 3;
    sprite.scale.setScalar(MARKER_SIZE);
    sprite.userData.person = person;
    sprite.userData.targetScale = MARKER_SIZE;

    // позиция: луч снаружи к оси айсберга на нужной высоте — попадаем точно на поверхность льда
    const y = tier.y + THREE.MathUtils.clamp(person.offset ?? 0, -1, 1) * tier.half;
    const a = THREE.MathUtils.degToRad(person.angle ?? 0);
    const origin = new THREE.Vector3(Math.sin(a) * 80, y, Math.cos(a) * 80);
    const dir = new THREE.Vector3(0, y, 0).sub(origin).normalize();
    this.raycaster.set(origin, dir);
    const hit = this.raycaster.intersectObject(this.iceberg, false)[0];

    if (hit) {
      const normal = hit.face.normal.clone();
      sprite.position.copy(hit.point).addScaledVector(normal, 1.1).addScaledVector(dir, -0.9);
    } else {
      sprite.position.set(Math.sin(a) * 6, y, Math.cos(a) * 6);
    }

    this.icebergGroup.add(sprite);
    this.markers.push(sprite);
    return sprite;
  }

  // ---------- ввод ----------

  setScroll(fraction) {
    this.targetProgress = THREE.MathUtils.clamp(fraction, 0, 1);
  }

  setPointer(clientX, clientY) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.pointer.set((clientX / w) * 2 - 1, -(clientY / h) * 2 + 1);
    this.mouse.set(this.pointer.x, this.pointer.y);
    this.pointerDirty = true;
  }

  clearPointer() {
    this.pointer.set(-10, -10);
    this.pointerDirty = true;
  }

  /** Возвращает одноклассника под указателем (или null) */
  pick(clientX, clientY) {
    this.setPointer(clientX, clientY);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.markers, false)[0];
    return hit ? hit.object.userData.person : null;
  }

  // ---------- вспомогательное ----------

  worldToScreen(vec) {
    this._v.copy(vec).project(this.camera);
    return {
      x: (this._v.x + 1) / 2 * window.innerWidth,
      y: (1 - this._v.y) / 2 * window.innerHeight,
      visible: this._v.z < 1,
    };
  }

  screenYForWorldY(y) {
    this._v.set(0, y + this.icebergGroup.position.y, 0);
    return this.worldToScreen(this._v).y;
  }

  get cameraY() {
    return this.camera.position.y;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- кадр ----------

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    // сглаживание скролла и мыши
    this.progress += (this.targetProgress - this.progress) * (1 - Math.exp(-dt * 5.5));
    this.mouseSmooth.lerp(this.mouse, 1 - Math.exp(-dt * 3.5));

    // камера: спуск сверху вниз + лёгкий поворот от мыши
    const p = this.progress;
    const camY = THREE.MathUtils.lerp(ICE_TOP + 2.0, ICE_BOTTOM + 4.0, p);
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const dist = Math.max(31, 13.5 / (Math.tan(halfFov) * this.camera.aspect));
    const ang = this.mouseSmooth.x * 0.32;
    this.camera.position.set(Math.sin(ang) * dist, camY + this.mouseSmooth.y * 1.4, Math.cos(ang) * dist);
    this.cameraTarget.set(0, camY - 2.6, 0);
    this.camera.lookAt(this.cameraTarget);

    // среда: над водой — небо, под водой — синева, темнеющая с глубиной
    const under = this.camera.position.y < WATER_Y;
    const depth = THREE.MathUtils.clamp((WATER_Y - this.camera.position.y) / (WATER_Y - ICE_BOTTOM), 0, 1);
    let targetDensity;
    if (under) {
      this._fogTarget.copy(DEEP_A).lerp(DEEP_B, Math.pow(depth, 0.8));
      targetDensity = THREE.MathUtils.lerp(0.016, 0.024, depth);
    } else {
      this._fogTarget.copy(SKY_FOG);
      targetDensity = 0.0025;
    }
    const k = 1 - Math.exp(-dt * 6);
    this.scene.fog.color.lerp(this._fogTarget, k);
    this.scene.fog.density += (targetDensity - this.scene.fog.density) * k;
    this.scene.background.copy(this.scene.fog.color);
    this.sky.setFog(this.scene.fog.color, under ? 1 : 0);
    this.sky.mesh.position.copy(this.camera.position);

    this.sun.intensity = THREE.MathUtils.lerp(2.3, 1.1, under ? depth : 0);
    this.hemi.intensity = THREE.MathUtils.lerp(1.15, 0.85, under ? depth : 0);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 0.95, under ? depth : 0);

    // анимации
    this.icebergGroup.position.y = Math.sin(t * 0.55) * 0.12;
    this.icebergGroup.rotation.z = Math.sin(t * 0.4) * 0.008;
    this.icebergGroup.rotation.x = Math.cos(t * 0.47) * 0.006;
    this.water.update(t);
    this.particles.update(dt, t);
    this.shafts.update(t, this.camera, under ? 1 - depth * 0.7 : 0.35);

    // наведение на маркеры
    if (this.pointerDirty) {
      this.pointerDirty = false;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.markers, false)[0];
      const next = hit ? hit.object : null;
      if (next !== this.hovered) {
        if (this.hovered) {
          this.hovered.userData.targetScale = MARKER_SIZE;
          this.hovered.material.color.setHex(0xe9f1f8);
        }
        this.hovered = next;
        if (next) {
          next.userData.targetScale = MARKER_SIZE_HOVER;
          next.material.color.setHex(0xffffff);
        }
        this.canvas.style.cursor = next ? 'pointer' : '';
      }
    }
    if (this.onHover) {
      if (this.hovered) {
        this.hovered.getWorldPosition(this._v);
        this._v.y += this.hovered.scale.y * 0.5;
        this.onHover(this.hovered.userData.person, this.worldToScreen(this._v));
      } else {
        this.onHover(null);
      }
    }
    for (const m of this.markers) {
      const s = m.scale.x + (m.userData.targetScale - m.scale.x) * (1 - Math.exp(-dt * 10));
      m.scale.setScalar(s);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
