import './style.css';
import { IcebergScene } from './scene.js';
import { createUI } from './ui.js';
import { checkOwnerAccess } from './owner.js';
import { CLASS_INFO, TIERS, CLASSMATES } from './data/classmates.js';

const canvas = document.getElementById('scene');
const scroller = document.getElementById('scroller');
const loader = document.getElementById('loader');

const scene = new IcebergScene(canvas);
const tiers = scene.layoutTiers(TIERS);

// высота прокрутки зависит от количества уровней
scroller.style.height = `${Math.max(5, tiers.length + 1.5) * 100}vh`;

const ui = createUI({ classInfo: CLASS_INFO, tiers, classmates: CLASSMATES });
scene.onHover = (person, pos) => ui.showTooltip(person, pos);

// ---------- ввод ----------

function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scene.setScroll(max > 0 ? window.scrollY / max : 0);
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => {
  scene.resize();
  onScroll();
});

let downX = 0;
let downY = 0;
let downTime = 0;

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  scene.setPointer(e.clientX, e.clientY);
});
canvas.addEventListener('pointerleave', () => scene.clearPointer());
canvas.addEventListener('pointerdown', (e) => {
  downX = e.clientX;
  downY = e.clientY;
  downTime = performance.now();
});
canvas.addEventListener('pointerup', (e) => {
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  if (moved > 8 || performance.now() - downTime > 600) return;
  const person = scene.pick(e.clientX, e.clientY);
  if (person) ui.openProfile(person);
  if (e.pointerType === 'touch') scene.clearPointer();
});

// ---------- одноклассники ----------

async function placeClassmates() {
  await Promise.all(
    CLASSMATES.map((person) => {
      const tier = tiers[person.tier] ?? tiers[0];
      return scene.addClassmate(person, tier);
    }),
  );
}

// ---------- цикл ----------

function loop() {
  scene.update();
  ui.frame({
    progress: scene.progress,
    cameraY: scene.cameraY,
    screenYForWorldY: (y) => scene.screenYForWorldY(y),
  });
  requestAnimationFrame(loop);
}

async function start() {
  const [, owner] = await Promise.all([
    placeClassmates(),
    checkOwnerAccess(),
    document.fonts?.ready ?? Promise.resolve(),
  ]);
  if (owner.isOwner) ui.enableArchive();
  onScroll();
  scene.progress = scene.targetProgress;
  loop();
  requestAnimationFrame(() => loader.classList.add('done'));
}

start();
