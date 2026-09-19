// Рисует круглую аватарку: фото (если есть) или инициалы на градиенте.
// Используется и для 3D-маркера на айсберге, и для страницы одноклассника.

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function paint(ctx, size, person, img) {
  const cx = size / 2;
  const r = size / 2 - 16;
  ctx.clearRect(0, 0, size, size);

  // мягкая тень
  ctx.save();
  ctx.shadowColor = 'rgba(0, 30, 70, 0.55)';
  ctx.shadowBlur = size * 0.09;
  ctx.shadowOffsetY = size * 0.03;
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // содержимое
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cx, r - 7, 0, Math.PI * 2);
  ctx.clip();

  if (img) {
    const s = Math.max(size / img.width, size / img.height);
    const w = img.width * s;
    const h = img.height * s;
    ctx.drawImage(img, cx - w / 2, cx - h / 2, w, h);
  } else {
    const hue = hashHue(person.name || person.id || '?');
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, `hsl(${hue}, 75%, 62%)`);
    g.addColorStop(1, `hsl(${(hue + 50) % 360}, 70%, 40%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `700 ${Math.round(size * 0.34)}px Unbounded, Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(person.name || '?'), cx, cx + size * 0.02);
  }
  ctx.restore();

  // белое кольцо
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cx, r - 3.5, 0, Math.PI * 2);
  ctx.stroke();
}

export async function drawAvatar(person, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = await loadImage(person.photo);
  paint(ctx, size, person, img);
  return { canvas, hasPhoto: !!img };
}
