import { ARTICLE_MAX, ARTICLE_TITLE_MAX } from './data/config.js';

// thin kv helpers (same store as classmates)
import { KV_APP_KEY, KV_BASE } from './data/config.js';

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
  try {
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
  } catch {
    return null;
  }
}

async function kvSet(key, value) {
  const payload = toB64Url(JSON.stringify(value));
  if (payload.length > 1000) throw new Error('Слишком длинный текст статьи.');
  const res = await fetch(
    `${KV_BASE}/UpdateValue/${KV_APP_KEY}/${encodeURIComponent(key)}/${payload}`,
    { method: 'POST' },
  );
  if (!res.ok) throw new Error('Не удалось сохранить статью.');
}

async function readArticleMeta() {
  const meta = (await kvGet('ameta')) || { next: 0, ids: [] };
  if (!Array.isArray(meta.ids)) meta.ids = [];
  if (!Number.isFinite(meta.next)) meta.next = 0;
  return meta;
}

function clampArticle(a) {
  return {
    id: a.id,
    personId: String(a.personId || ''),
    personName: String(a.personName || '').slice(0, 40),
    title: String(a.title || '').slice(0, ARTICLE_TITLE_MAX),
    body: String(a.body || '').slice(0, ARTICLE_MAX),
    photo: String(a.photo || '').slice(0, 160),
    by: String(a.by || 'модер').slice(0, 40),
    at: a.at || new Date().toISOString(),
  };
}

export async function listArticles() {
  const meta = await readArticleMeta();
  const ids = [...meta.ids].reverse();
  const items = await Promise.all(ids.map((id) => kvGet(`a_${id}`)));
  return items.filter(Boolean).map(clampArticle);
}

export async function saveArticle(article) {
  const meta = await readArticleMeta();
  let id = article.id;
  if (!id) id = `a${meta.next++}`;
  const row = clampArticle({
    ...article,
    id,
    by: article.by || 'модер',
    at: article.at || new Date().toISOString(),
  });
  await kvSet(`a_${id}`, row);
  if (!meta.ids.includes(id)) meta.ids.push(id);
  meta.ids = meta.ids.slice(-40);
  await kvSet('ameta', meta);
  return row;
}

export function newArticleId() {
  return `a_${Date.now().toString(36)}`;
}
