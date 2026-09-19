import './style.css';
import { IcebergScene } from './scene.js';
import { createUI } from './ui.js';
import { checkRoles } from './owner.js';
import { hydrateClassmates } from './store.js';
import { CLASS_INFO, TIERS, CLASSMATES as SEED } from './data/classmates.js';

const canvas = document.getElementById('scene');
const scroller = document.getElementById('scroller');
const loader = document.getElementById('loader');
const loaderText = loader.querySelector('span');

const scene = new IcebergScene(canvas);
const tiers = scene.layoutTiers(TIERS);
scroller.style.height = `${Math.max(5, tiers.length + 1.5) * 100}vh`;

/** @type {any[]} */
let classmates = [];
/** @type {ReturnType<typeof createUI> | null} */
let ui = null;

async function placeOne(person) {
  const tier = tiers[person.tier] ?? tiers[0];
  return scene.addClassmate(person, tier);
}

async function replaceOne(person) {
  const tier = tiers[person.tier] ?? tiers[0];
  return scene.replaceClassmate(person, tier);
}

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
  if (person && ui) ui.openProfile(person);
  if (e.pointerType === 'touch') scene.clearPointer();
});

function loop() {
  scene.update();
  ui?.frame({
    progress: scene.progress,
    cameraY: scene.cameraY,
    screenYForWorldY: (y) => scene.screenYForWorldY(y),
  });
  requestAnimationFrame(loop);
}

async function start() {
  loaderText.textContent = 'Подгружаем правки класса…';
  const roles = await checkRoles();

  try {
    classmates = await hydrateClassmates(SEED);
  } catch (err) {
    console.warn(err);
    classmates = SEED.map((p) => ({ ...p }));
  }

  ui = createUI({
    classInfo: CLASS_INFO,
    tiers,
    classmates,
    roles,
    onPersonSaved: async (person) => {
      await replaceOne(person);
    },
    onPersonAdded: async (person) => {
      await placeOne(person);
    },
  });
  scene.onHover = (person, pos) => ui.showTooltip(person, pos);

  if (roles.isOwner) ui.enableArchive();

  await Promise.all([
    Promise.all(classmates.map((p) => placeOne(p))),
    document.fonts?.ready ?? Promise.resolve(),
  ]);

  onScroll();
  scene.progress = scene.targetProgress;
  loop();
  requestAnimationFrame(() => loader.classList.add('done'));
}

start();
