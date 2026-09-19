import { drawAvatar } from './avatar.js';

const $ = (sel, root = document) => root.querySelector(sel);

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createUI({ classInfo, tiers, classmates }) {
  // ---------- заголовок ----------
  const hero = $('#hero');
  for (const [field, value] of Object.entries(classInfo)) {
    const el = hero.querySelector(`[data-field="${field}"]`);
    if (el) el.textContent = value;
  }

  // ---------- уровни ----------
  const tiersRoot = $('#tiers');
  const tierEls = tiers.map((tier, i) => {
    const el = document.createElement('div');
    el.className = 'tier';
    el.innerHTML = `
      <span class="tier-index">УРОВЕНЬ ${String(i + 1).padStart(2, '0')}</span>
      <h2>${escapeHtml(tier.title)}</h2>
      <p>${escapeHtml(tier.subtitle ?? '')}</p>`;
    tiersRoot.appendChild(el);
    return el;
  });

  // ---------- подсказка ----------
  const tooltip = $('#tooltip');
  let tooltipPerson = null;

  function showTooltip(person, pos) {
    if (!person) {
      if (tooltipPerson) {
        tooltip.classList.remove('show');
        tooltipPerson = null;
      }
      return;
    }
    if (tooltipPerson !== person) {
      tooltip.textContent = person.name;
      tooltip.hidden = false;
      tooltip.classList.add('show');
      tooltipPerson = person;
    }
    tooltip.style.left = `${pos.x}px`;
    tooltip.style.top = `${pos.y}px`;
  }

  // ---------- страница одноклассника ----------
  const profile = $('#profile');
  const avatarImg = $('.profile-avatar img', profile);
  const nameEl = $('.profile-name', profile);
  const nickEl = $('.profile-nick', profile);
  const tierEl = $('.profile-tier', profile);
  const aboutEl = $('.profile-about', profile);
  const factsEl = $('.profile-facts', profile);
  const galleryEl = $('.profile-gallery', profile);
  const prevBtn = $('.profile-prev', profile);
  const nextBtn = $('.profile-next', profile);
  let current = null;

  async function renderProfile(person) {
    current = person;
    const tier = tiers[person.tier] ?? tiers[0];
    tierEl.textContent = `Уровень ${String((tier?.index ?? 0) + 1).padStart(2, '0')} · ${tier?.title ?? ''}`;
    nameEl.textContent = person.name;
    nickEl.textContent = person.nickname ?? '';

    aboutEl.innerHTML = String(person.about ?? '')
      .split(/\n\s*\n/)
      .filter((p) => p.trim())
      .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
      .join('');

    factsEl.innerHTML = (person.facts ?? []).map((f) => `<li>${escapeHtml(f)}</li>`).join('');

    galleryEl.innerHTML = (person.gallery ?? [])
      .map(
        (src) =>
          `<a href="${escapeHtml(src)}" target="_blank" rel="noopener"><img src="${escapeHtml(src)}" alt="" loading="lazy"></a>`,
      )
      .join('');

    const idx = classmates.indexOf(person);
    const prev = classmates[idx - 1];
    const next = classmates[idx + 1];
    prevBtn.disabled = !prev;
    nextBtn.disabled = !next;
    $('b', prevBtn).textContent = prev?.name ?? '';
    $('b', nextBtn).textContent = next?.name ?? '';

    avatarImg.src = '';
    const { canvas, hasPhoto } = await drawAvatar(person, 512);
    if (current !== person) return;
    avatarImg.src = hasPhoto ? person.photo : canvas.toDataURL();
  }

  function openProfile(person) {
    if (!person) return;
    renderProfile(person);
    profile.hidden = false;
    profile.scrollTop = 0;
    document.body.classList.add('modal-open');
    showTooltip(null);
    if (location.hash !== `#/${person.id}`) history.pushState(null, '', `#/${person.id}`);
  }

  function closeProfile() {
    if (profile.hidden) return;
    profile.hidden = true;
    current = null;
    document.body.classList.remove('modal-open');
    if (location.hash) history.pushState(null, '', location.pathname + location.search);
  }

  profile.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeProfile));
  prevBtn.addEventListener('click', () => {
    const idx = classmates.indexOf(current);
    if (classmates[idx - 1]) openProfile(classmates[idx - 1]);
  });
  nextBtn.addEventListener('click', () => {
    const idx = classmates.indexOf(current);
    if (classmates[idx + 1]) openProfile(classmates[idx + 1]);
  });
  window.addEventListener('keydown', (e) => {
    if (profile.hidden) return;
    if (e.key === 'Escape') closeProfile();
    if (e.key === 'ArrowLeft') prevBtn.click();
    if (e.key === 'ArrowRight') nextBtn.click();
  });

  // адрес вида #/id открывает страницу (и работает кнопка «назад»)
  function syncWithHash() {
    const id = location.hash.startsWith('#/') ? decodeURIComponent(location.hash.slice(2)) : '';
    const person = classmates.find((c) => c.id === id);
    if (person) {
      if (current !== person) {
        renderProfile(person);
        profile.hidden = false;
        document.body.classList.add('modal-open');
      }
    } else if (!profile.hidden) {
      profile.hidden = true;
      current = null;
      document.body.classList.remove('modal-open');
    }
  }
  window.addEventListener('popstate', syncWithHash);
  syncWithHash();

  // ---------- глубиномер / заголовок ----------
  const depthValue = $('#depth-value');
  let lastDepth = -1;

  return {
    showTooltip,
    openProfile,
    closeProfile,
    isProfileOpen: () => !profile.hidden,

    /** Вызывается каждый кадр */
    frame({ progress, cameraY, screenYForWorldY }) {
      const heroOpacity = Math.max(0, 1 - progress * 7);
      hero.style.opacity = heroOpacity.toFixed(3);
      hero.style.transform = `translateY(calc(-50% - ${(progress * 400).toFixed(1)}px))`;
      hero.style.visibility = heroOpacity <= 0 ? 'hidden' : 'visible';

      const depth = Math.max(0, Math.round(-cameraY * 4));
      if (depth !== lastDepth) {
        lastDepth = depth;
        depthValue.textContent = `${depth} м`;
      }

      // уровни появляются, когда заголовок уже уехал
      tiersRoot.style.opacity = Math.min(1, Math.max(0, (progress - 0.05) * 14)).toFixed(3);

      const h = window.innerHeight;
      tiers.forEach((tier, i) => {
        const y = screenYForWorldY(tier.y + tier.half * 1.35);
        const el = tierEls[i];
        const visible = y > -120 && y < h + 120;
        el.style.opacity = visible ? '1' : '0';
        if (visible) el.style.transform = `translateY(${y.toFixed(1)}px)`;
      });
    },
  };
}
