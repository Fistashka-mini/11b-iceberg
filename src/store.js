import { KV_APP_KEY, KV_BASE, ABOUT_MAX, FACT_MAX, FACTS_MAX } from './data/config.js';

function toB64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64Url(str) {
  if (!str) return '';
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function kvGet(key) {
  const res = await fetch(`${KV_BASE}/GetValue/${KV_APP_KEY}/${encodeURIComponent(key)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const text = (await res.text()).replace(/^"|"$/g, '');
  if (!text || text === 'null') return null;
  try {
    return JSON.parse(fromB64Url(text));
  } catch {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}

async function kvSet(key, value) {
  const payload = toB64Url(JSON.stringify(value));
  if (payload.length > 1000) {
    throw new Error('Слишком длинный текст — укороти описание (лимит хранилища).');
  }
  const res = await fetch(
    `${KV_BASE}/UpdateValue/${KV_APP_KEY}/${encodeURIComponent(key)}/${payload}`,
    { method: 'POST' },
  );
  if (!res.ok) throw new Error('Не удалось сохранить. Попробуй ещё раз.');
}

function clampPerson(p) {
  const facts = (p.facts ?? [])
    .map((f) => String(f).slice(0, FACT_MAX))
    .filter(Boolean)
    .slice(0, FACTS_MAX);
  return {
    id: p.id,
    name: String(p.name ?? '').slice(0, 40),
    nickname: String(p.nickname ?? '').slice(0, 80),
    tier: Math.max(0, Math.min(4, Number(p.tier) || 0)),
    angle: Number.isFinite(p.angle) ? p.angle : 0,
    offset: Number.isFinite(p.offset) ? Math.max(-1, Math.min(1, p.offset)) : 0,
    about: String(p.about ?? '').slice(0, ABOUT_MAX),
    facts,
    photo: String(p.photo ?? '').slice(0, 120),
    gallery: Array.isArray(p.gallery) ? p.gallery.slice(0, 6) : [],
    custom: !!p.custom,
    fullName: p.fullName ? String(p.fullName).slice(0, 120) : undefined,
    removed: !!p.removed,
  };
}

function snapshot(p) {
  const c = clampPerson(p);
  return {
    name: c.name,
    nickname: c.nickname,
    tier: c.tier,
    angle: c.angle,
    offset: c.offset,
    about: c.about,
    facts: c.facts,
    photo: c.photo,
    removed: c.removed,
  };
}

function editorName() {
  try {
    return localStorage.getItem('iceberg-editor-name') || '';
  } catch {
    return '';
  }
}

export function setEditorName(name) {
  try {
    localStorage.setItem('iceberg-editor-name', String(name || '').slice(0, 40));
  } catch {
    /* ignore */
  }
}

export function getEditorName() {
  return editorName();
}

async function readMeta() {
  const meta = (await kvGet('meta')) || { version: 1, logNext: 0, customIds: [], logIds: [] };
  if (!Array.isArray(meta.customIds)) meta.customIds = [];
  if (!Array.isArray(meta.logIds)) meta.logIds = [];
  if (!Number.isFinite(meta.logNext)) meta.logNext = 0;
  return meta;
}

async function writeMeta(meta) {
  // keep logIds short — only last 80 ids in meta
  const trimmed = {
    ...meta,
    logIds: (meta.logIds || []).slice(-80),
    customIds: (meta.customIds || []).slice(-100),
  };
  await kvSet('meta', trimmed);
}

export async function hydrateClassmates(seed) {
  const meta = await readMeta();
  const overrides = {};
  await Promise.all(
    seed.map(async (p) => {
      const o = await kvGet(`p_${p.id}`);
      if (o) overrides[p.id] = o;
    }),
  );

  const custom = [];
  await Promise.all(
    meta.customIds.map(async (id) => {
      const o = await kvGet(`p_${id}`);
      if (o && !o.removed) custom.push({ ...o, id, custom: true, fullName: o.fullName || o.name });
    }),
  );

  const merged = seed
    .map((p) => {
      const o = overrides[p.id];
      if (!o) return { ...p };
      if (o.removed) return null;
      return {
        ...p,
        ...clampPerson({ ...p, ...o, id: p.id, custom: false, fullName: p.fullName }),
        fullName: p.fullName,
      };
    })
    .filter(Boolean);

  return [...merged, ...custom.map((c) => ({ photo: '', gallery: [], ...clampPerson(c), fullName: c.fullName || c.name }))];
}

export async function savePersonChange({ before, after, action, summary }) {
  const person = clampPerson(after);
  await kvSet(`p_${person.id}`, person);

  const meta = await readMeta();
  if (person.custom && !meta.customIds.includes(person.id)) {
    meta.customIds.push(person.id);
  }

  const logId = `l${meta.logNext++}`;
  const entry = {
    id: logId,
    at: new Date().toISOString(),
    action,
    personId: person.id,
    personName: person.name,
    by: editorName() || 'аноним',
    summary,
  };

  // snapshots in separate keys if needed
  if (before) await kvSet(`s_${logId}_b`, snapshot(before));
  await kvSet(`s_${logId}_a`, snapshot(after));
  await kvSet(`log_${logId}`, entry);

  meta.logIds.push(logId);
  await writeMeta(meta);
  return entry;
}

export async function listChangelog() {
  const meta = await readMeta();
  const ids = [...(meta.logIds || [])].reverse();
  const entries = await Promise.all(
    ids.map(async (id) => {
      const e = await kvGet(`log_${id}`);
      return e ? { ...e, id } : null;
    }),
  );
  return entries.filter(Boolean);
}

export async function loadSnapshots(logId) {
  const [before, after] = await Promise.all([kvGet(`s_${logId}_b`), kvGet(`s_${logId}_a`)]);
  return { before, after };
}

export async function restoreFromLog(logId, classmates, use = 'before') {
  const { before, after } = await loadSnapshots(logId);
  const snap = use === 'after' ? after : before;
  if (!snap) throw new Error('В этой записи нет снимка для восстановления.');

  const entry = await kvGet(`log_${logId}`);
  const personId = entry?.personId;
  if (!personId) throw new Error('Битая запись лога.');

  const current = classmates.find((c) => c.id === personId);
  const restored = {
    ...(current || { id: personId, custom: true, photo: '', gallery: [], fullName: snap.name }),
    ...snap,
    id: personId,
  };

  await savePersonChange({
    before: current || null,
    after: restored,
    action: 'restore',
    summary: `Восстановлено из лога ${logId} (${use})`,
  });

  return restored;
}

export function newPersonId(name) {
  const slug = String(name || 'person')
    .toLowerCase()
    .replace(/[^a-zа-яёіїєґ0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `c_${slug || 'person'}_${Date.now().toString(36)}`;
}

export { snapshot, clampPerson };
