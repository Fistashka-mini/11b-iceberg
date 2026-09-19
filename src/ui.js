import { drawAvatar } from './avatar.js';
import { ABOUT_MAX } from './data/config.js';
import {
  getEditorName,
  setEditorName,
  savePersonChange,
  listChangelog,
  loadSnapshots,
  restoreFromLog,
  newPersonId,
} from './store.js';
import { compressAvatarFile, uploadAvatar, resolvePhotoSrc, clearPhotoCache } from './photo.js';

const $ = (sel, root = document) => root.querySelector(sel);

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const ACTION_LABEL = {
  create: 'Добавлен',
  update: 'Изменён',
  clear: 'Очищено описание',
  restore: 'Восстановлено',
  remove: 'Удалён',
};

export function createUI({ classInfo, tiers, classmates, onPersonSaved, onPersonAdded }) {
  const hero = $('#hero');
  for (const [field, value] of Object.entries(classInfo)) {
    const el = hero.querySelector(`[data-field="${field}"]`);
    if (el) el.textContent = value;
  }

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

  function fillTierSelect(select, selected = 0) {
    select.innerHTML = tiers
      .map(
        (t, i) =>
          `<option value="${i}" ${i === selected ? 'selected' : ''}>${escapeHtml(t.title)}</option>`,
      )
      .join('');
  }

  // ---------- tooltip ----------
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

  // ---------- profile ----------
  const profile = $('#profile');
  const avatarImg = $('.profile-avatar img', profile);
  const nameEl = $('.profile-name', profile);
  const nickEl = $('.profile-nick', profile);
  const tierEl = $('.profile-tier', profile);
  const aboutEl = $('.profile-about', profile);
  const factsEl = $('.profile-facts', profile);
  const galleryEl = $('.profile-gallery', profile);
  const viewEl = $('.profile-view', profile);
  const editForm = $('.profile-edit', profile);
  const prevBtn = $('.profile-prev', profile);
  const nextBtn = $('.profile-next', profile);
  const editStatus = $('.edit-status', editForm);
  let current = null;
  let editing = false;
  /** @type {{ raw: string, mime: string, dataUrl: string } | null} */
  let pendingPhoto = null;
  let removePhoto = false;

  fillTierSelect($('select[name="tier"]', editForm));

  function setStatus(el, msg, ok = false) {
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
    el.classList.toggle('ok', ok);
    el.classList.toggle('err', !ok && !!msg);
  }

  async function showPhotoPreview(form, src) {
    const img = $('.photo-preview', form);
    if (!img) return;
    if (!src) {
      img.hidden = true;
      img.removeAttribute('src');
      return;
    }
    const resolved = src.startsWith('kv://') ? await resolvePhotoSrc(src) : src;
    if (!resolved) {
      img.hidden = true;
      return;
    }
    img.src = resolved;
    img.hidden = false;
  }

  function wirePhotoInput(form, { onPicked } = {}) {
    const input = form.querySelector('input[name="photo"]');
    if (!input) return;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setStatus($('.edit-status', form), 'Сжимаю фото…');
        const packed = await compressAvatarFile(file);
        onPicked?.(packed);
        await showPhotoPreview(form, packed.dataUrl);
        setStatus($('.edit-status', form), 'Фото готово — нажми сохранить', true);
      } catch (err) {
        input.value = '';
        setStatus($('.edit-status', form), err.message || 'Ошибка фото');
      }
    });
  }

  async function renderProfile(person) {
    current = person;
    editing = false;
    viewEl.hidden = false;
    editForm.hidden = true;

    const tier = tiers[person.tier] ?? tiers[0];
    tierEl.textContent = `Уровень ${String((tier?.index ?? person.tier ?? 0) + 1).padStart(2, '0')} · ${tier?.title ?? ''}`;
    nameEl.textContent = person.name;
    nickEl.textContent = person.nickname ?? '';

    aboutEl.innerHTML = String(person.about ?? '')
      .split(/\n\s*\n/)
      .filter((p) => p.trim())
      .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
      .join('');
    if (!aboutEl.innerHTML) {
      aboutEl.innerHTML = '<p style="opacity:0.45">Пока пусто — нажми «Редактировать».</p>';
    }

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
    avatarImg.src = canvas.toDataURL();
    void hasPhoto;
  }

  function openEdit() {
    if (!current) return;
    editing = true;
    pendingPhoto = null;
    removePhoto = false;
    viewEl.hidden = true;
    editForm.hidden = false;
    editForm.name.value = current.name || '';
    editForm.nickname.value = current.nickname || '';
    editForm.tier.value = String(current.tier ?? 0);
    editForm.about.value = current.about || '';
    editForm.facts.value = (current.facts || []).join('\n');
    editForm.editor.value = getEditorName();
    editForm.photo.value = '';
    $('[data-count="about"]', editForm).textContent = String(editForm.about.value.length);
    setStatus(editStatus, '');
    showPhotoPreview(editForm, current.photo || '');
  }

  function openProfile(person) {
    if (!person) return;
    const live = classmates.find((c) => c.id === person.id) || person;
    renderProfile(live);
    profile.hidden = false;
    profile.scrollTop = 0;
    document.body.classList.add('modal-open');
    showTooltip(null);
    if (location.hash !== `#/${live.id}`) history.pushState(null, '', `#/${live.id}`);
  }

  function closeProfile() {
    if (profile.hidden) return;
    profile.hidden = true;
    current = null;
    editing = false;
    if ($('#archive').hidden && $('#add-modal').hidden) document.body.classList.remove('modal-open');
    if (location.hash) history.pushState(null, '', location.pathname + location.search);
  }

  $('.btn-edit', profile).addEventListener('click', openEdit);
  $('.btn-cancel', editForm).addEventListener('click', () => {
    if (current) renderProfile(current);
  });

  wirePhotoInput(editForm, {
    onPicked: (packed) => {
      pendingPhoto = packed;
      removePhoto = false;
    },
  });

  $('.btn-photo-clear', editForm)?.addEventListener('click', () => {
    pendingPhoto = null;
    removePhoto = true;
    editForm.photo.value = '';
    showPhotoPreview(editForm, '');
    setStatus(editStatus, 'Фото будет убрано после сохранения', true);
  });

  editForm.about.addEventListener('input', () => {
    $('[data-count="about"]', editForm).textContent = String(editForm.about.value.length);
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!current) return;
    const before = { ...current, facts: [...(current.facts || [])] };
    setEditorName(editForm.editor.value.trim());

    const after = {
      ...current,
      name: editForm.name.value.trim() || current.name,
      nickname: editForm.nickname.value.trim(),
      tier: Number(editForm.tier.value) || 0,
      about: editForm.about.value.slice(0, ABOUT_MAX),
      facts: editForm.facts.value
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    setStatus(editStatus, 'Сохраняю…');
    try {
      if (removePhoto) {
        after.photo = '';
        clearPhotoCache(current.id);
      } else if (pendingPhoto) {
        setStatus(editStatus, 'Загружаю фото…');
        after.photo = await uploadAvatar(current.id, pendingPhoto, (done, total) => {
          setStatus(editStatus, `Загружаю фото… ${done}/${total}`);
        });
      }

      await savePersonChange({
        before,
        after,
        action: 'update',
        summary: `Обновил(а) карточку «${after.name}»${pendingPhoto || removePhoto ? ' (фото)' : ''}`,
      });
      Object.assign(current, after);
      pendingPhoto = null;
      removePhoto = false;
      await onPersonSaved?.(current, before);
      setStatus(editStatus, 'Сохранено', true);
      await renderProfile(current);
    } catch (err) {
      setStatus(editStatus, err.message || 'Ошибка сохранения');
    }
  });

  $('.btn-clear', editForm).addEventListener('click', async () => {
    if (!current) return;
    if (!confirm('Очистить описание и факты? Это запишется в архив — можно восстановить.')) return;
    const before = { ...current, facts: [...(current.facts || [])] };
    setEditorName(editForm.editor.value.trim());
    const after = { ...current, about: '', facts: [] };
    setStatus(editStatus, 'Очищаю…');
    try {
      await savePersonChange({
        before,
        after,
        action: 'clear',
        summary: `Очистил(а) описание у «${after.name}»`,
      });
      Object.assign(current, after);
      await onPersonSaved?.(current, before);
      editForm.about.value = '';
      editForm.facts.value = '';
      setStatus(editStatus, 'Очищено и записано в архив', true);
    } catch (err) {
      setStatus(editStatus, err.message || 'Ошибка');
    }
  });

  profile.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeProfile));
  prevBtn.addEventListener('click', () => {
    const idx = classmates.indexOf(current);
    if (classmates[idx - 1]) openProfile(classmates[idx - 1]);
  });
  nextBtn.addEventListener('click', () => {
    const idx = classmates.indexOf(current);
    if (classmates[idx + 1]) openProfile(classmates[idx + 1]);
  });

  // ---------- add ----------
  const addBtn = $('#add-btn');
  const addModal = $('#add-modal');
  const addForm = $('#add-form');
  const addStatus = $('.edit-status', addForm);
  /** @type {{ raw: string, mime: string, dataUrl: string } | null} */
  let addPendingPhoto = null;
  fillTierSelect($('select[name="tier"]', addForm));

  wirePhotoInput(addForm, {
    onPicked: (packed) => {
      addPendingPhoto = packed;
    },
  });

  function openAdd() {
    closeProfile();
    closeArchive();
    addForm.reset();
    addPendingPhoto = null;
    addForm.editor.value = getEditorName();
    fillTierSelect($('select[name="tier"]', addForm), 0);
    showPhotoPreview(addForm, '');
    setStatus(addStatus, '');
    addModal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeAdd() {
    if (addModal.hidden) return;
    addModal.hidden = true;
    if (profile.hidden && $('#archive').hidden) document.body.classList.remove('modal-open');
  }

  addBtn.addEventListener('click', openAdd);
  addModal.querySelectorAll('[data-add-close]').forEach((el) => el.addEventListener('click', closeAdd));

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = addForm.name.value.trim();
    if (!name) return;
    setEditorName(addForm.editor.value.trim());

    const person = {
      id: newPersonId(name),
      name,
      nickname: addForm.nickname.value.trim(),
      tier: Number(addForm.tier.value) || 0,
      angle: Math.round((Math.random() * 120 - 60) * 10) / 10,
      offset: Math.round((Math.random() * 1.4 - 0.7) * 10) / 10,
      about: addForm.about.value.slice(0, ABOUT_MAX),
      facts: [],
      photo: '',
      gallery: [],
      custom: true,
      fullName: name,
    };

    setStatus(addStatus, 'Добавляю…');
    try {
      if (addPendingPhoto) {
        setStatus(addStatus, 'Загружаю фото…');
        person.photo = await uploadAvatar(person.id, addPendingPhoto, (done, total) => {
          setStatus(addStatus, `Загружаю фото… ${done}/${total}`);
        });
      }
      await savePersonChange({
        before: null,
        after: person,
        action: 'create',
        summary: `Добавил(а) «${person.name}» на уровень ${(person.tier || 0) + 1}`,
      });
      classmates.push(person);
      addPendingPhoto = null;
      await onPersonAdded?.(person);
      setStatus(addStatus, 'Готово', true);
      closeAdd();
      openProfile(person);
    } catch (err) {
      setStatus(addStatus, err.message || 'Ошибка');
    }
  });

  // ---------- archive (logs) ----------
  const archiveBtn = $('#archive-btn');
  const archive = $('#archive');
  const archiveList = $('#archive-list');

  async function openArchive() {
    closeProfile();
    closeAdd();
    archive.hidden = false;
    document.body.classList.add('modal-open');
    archiveList.innerHTML = '<p class="log-loading">Загружаю лог…</p>';
    try {
      const logs = await listChangelog();
      if (!logs.length) {
        archiveList.innerHTML = '<p class="log-empty">Пока нет изменений.</p>';
        return;
      }
      archiveList.innerHTML = logs
        .map(
          (e) => `
        <article class="log-item" data-log="${escapeHtml(e.id)}">
          <header>
            <span class="log-action">${escapeHtml(ACTION_LABEL[e.action] || e.action)}</span>
            <time>${escapeHtml(formatWhen(e.at))}</time>
          </header>
          <p class="log-summary">${escapeHtml(e.summary || e.personName || '')}</p>
          <p class="log-by">кто: ${escapeHtml(e.by || 'аноним')} · id: ${escapeHtml(e.personId || '')}</p>
          <div class="log-actions">
            <button type="button" data-preview="${escapeHtml(e.id)}">Смотреть снимок</button>
            <button type="button" data-restore="${escapeHtml(e.id)}" data-use="before">Восстановить «до»</button>
            <button type="button" data-restore="${escapeHtml(e.id)}" data-use="after">Восстановить «после»</button>
          </div>
          <pre class="log-snap" hidden></pre>
        </article>`,
        )
        .join('');
    } catch (err) {
      archiveList.innerHTML = `<p class="log-empty">${escapeHtml(err.message || 'Не удалось загрузить')}</p>`;
    }
  }

  function closeArchive() {
    if (archive.hidden) return;
    archive.hidden = true;
    if (profile.hidden && addModal.hidden) document.body.classList.remove('modal-open');
  }

  archive.querySelectorAll('[data-archive-close]').forEach((el) => el.addEventListener('click', closeArchive));
  archiveBtn.addEventListener('click', openArchive);

  archiveList.addEventListener('click', async (e) => {
    const previewBtn = e.target.closest('[data-preview]');
    if (previewBtn) {
      const id = previewBtn.getAttribute('data-preview');
      const item = previewBtn.closest('.log-item');
      const pre = $('.log-snap', item);
      if (!pre.hidden && pre.dataset.loaded) {
        pre.hidden = true;
        return;
      }
      pre.textContent = '…';
      pre.hidden = false;
      try {
        const { before, after } = await loadSnapshots(id);
        pre.dataset.loaded = '1';
        pre.textContent =
          '—— ДО ——\n' +
          JSON.stringify(before, null, 2) +
          '\n\n—— ПОСЛЕ ——\n' +
          JSON.stringify(after, null, 2);
      } catch (err) {
        pre.textContent = err.message || 'Ошибка';
      }
      return;
    }

    const restoreBtn = e.target.closest('[data-restore]');
    if (!restoreBtn) return;
    const id = restoreBtn.getAttribute('data-restore');
    const use = restoreBtn.getAttribute('data-use') || 'before';
    if (!confirm(`Восстановить снимок «${use === 'before' ? 'до' : 'после'}» из этой записи?`)) return;
    restoreBtn.disabled = true;
    try {
      const restored = await restoreFromLog(id, classmates, use);
      const idx = classmates.findIndex((c) => c.id === restored.id);
      const before = idx >= 0 ? { ...classmates[idx] } : null;
      if (idx >= 0) Object.assign(classmates[idx], restored);
      else classmates.push(restored);
      await onPersonSaved?.(restored, before);
      alert('Восстановлено.');
      openArchive();
    } catch (err) {
      alert(err.message || 'Не удалось восстановить');
    } finally {
      restoreBtn.disabled = false;
    }
  });

  // ---------- hash / keys ----------
  function syncWithHash() {
    const id = location.hash.startsWith('#/') ? decodeURIComponent(location.hash.slice(2)) : '';
    const person = classmates.find((c) => c.id === id);
    if (person) {
      if (current !== person || profile.hidden) {
        renderProfile(person);
        profile.hidden = false;
        document.body.classList.add('modal-open');
      }
    } else if (!profile.hidden && !editing) {
      profile.hidden = true;
      current = null;
      if (archive.hidden && addModal.hidden) document.body.classList.remove('modal-open');
    }
  }
  window.addEventListener('popstate', syncWithHash);
  syncWithHash();

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!archive.hidden) return closeArchive();
    if (!addModal.hidden) return closeAdd();
    if (!profile.hidden) closeProfile();
  });

  const depthValue = $('#depth-value');
  let lastDepth = -1;

  return {
    showTooltip,
    openProfile,
    closeProfile,
    enableArchive() {
      archiveBtn.hidden = false;
    },
    isProfileOpen: () => !profile.hidden,

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
