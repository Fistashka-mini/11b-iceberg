import { KV_APP_KEY, KV_BASE } from './data/config.js';

const CHUNK = 680; // после обёртки base64url уложится в лимит ~1000
const cache = new Map();

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
  if (payload.length > 1000) throw new Error('Фрагмент фото слишком большой.');
  const res = await fetch(
    `${KV_BASE}/UpdateValue/${KV_APP_KEY}/${encodeURIComponent(key)}/${payload}`,
    { method: 'POST' },
  );
  if (!res.ok) throw new Error('Не удалось загрузить фото.');
}

/** Сжимает файл до квадратного JPEG для аватарки */
export function compressAvatarFile(file, { size = 256, quality = 0.58 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Выбери файл изображения (jpg, png, webp).'));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('Файл больше 12 МБ — возьми фото полегче.'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.fillStyle = '#123';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

      let q = quality;
      const tryEncode = () => {
        const dataUrl = canvas.toDataURL('image/jpeg', q);
        // raw base64 без префикса
        const raw = dataUrl.split(',')[1] || '';
        if (raw.length > CHUNK * 55 && q > 0.35) {
          q -= 0.08;
          tryEncode();
          return;
        }
        if (raw.length > CHUNK * 55) {
          reject(new Error('Фото всё ещё слишком тяжёлое. Попробуй другое.'));
          return;
        }
        resolve({ dataUrl, raw, mime: 'image/jpeg' });
      };
      tryEncode();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать изображение.'));
    };
    img.src = url;
  });
}

export function photoRef(personId) {
  return `kv://${personId}`;
}

export function isStoredPhoto(photo) {
  return typeof photo === 'string' && (photo.startsWith('kv://') || photo.startsWith('data:') || /^https?:\/\//i.test(photo));
}

/** Сохраняет jpeg в облако кусками, возвращает ссылку kv://id */
export async function uploadAvatar(personId, { raw, mime = 'image/jpeg' }, onProgress) {
  const n = Math.ceil(raw.length / CHUNK) || 1;
  if (n > 55) throw new Error('Фото слишком большое даже после сжатия.');

  await kvSet(`ph_${personId}_m`, { n, mime, at: Date.now() });
  for (let i = 0; i < n; i++) {
    const part = raw.slice(i * CHUNK, (i + 1) * CHUNK);
    await kvSet(`ph_${personId}_${i}`, part);
    onProgress?.(i + 1, n);
  }
  cache.delete(personId);
  return photoRef(personId);
}

/** Собирает data URL из облака (с кэшем) */
export async function resolvePhotoSrc(photo) {
  if (!photo) return '';
  if (photo.startsWith('data:') || /^https?:\/\//i.test(photo) || photo.startsWith('photos/')) {
    return photo;
  }
  if (!photo.startsWith('kv://')) return photo;

  const id = photo.slice(5);
  if (cache.has(id)) return cache.get(id);

  const meta = await kvGet(`ph_${id}_m`);
  if (!meta?.n || meta.n > 60) return '';

  try {
    const parts = [];
    for (let i = 0; i < meta.n; i++) {
      const part = await kvGet(`ph_${id}_${i}`);
      if (typeof part !== 'string') return '';
      parts.push(part);
    }
    const dataUrl = `data:${meta.mime || 'image/jpeg'};base64,${parts.join('')}`;
    cache.set(id, dataUrl);
    return dataUrl;
  } catch {
    return '';
  }
}

export function clearPhotoCache(personId) {
  if (personId) cache.delete(personId);
  else cache.clear();
}
