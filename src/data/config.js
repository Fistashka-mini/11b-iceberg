// IP владельца (ты) — архив логов + права модера автоматически.
// Узнать публичный IP: https://api.ipify.org
// ipconfig / 192.168.* / Radmin VPN — НЕ подходят, сайт их не видит.
export const OWNER_IPS = [
  '31.175.6.62',
];

// Модераторы (друзья). Сюда только ПУБЛИЧНЫЙ IP.
// Скрин друга с ipconfig (192.168.0.104 / 26.213.*) — локальные, не сработают.
// Пусть откроет https://api.ipify.org и пришлёт число оттуда.
export const MODERATOR_IPS = [
  // 'x.x.x.x', // друг — ждём публичный IP
];

// Бесплатное key-value хранилище (общее для всех, у кого есть ссылка)
export const KV_APP_KEY = 'qw37tais';
export const KV_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';

// Лимит текста (хранилище режет значения ~1 КБ)
export const ABOUT_MAX = 450;
export const ARTICLE_MAX = 450;
export const ARTICLE_TITLE_MAX = 80;
export const FACT_MAX = 80;
export const FACTS_MAX = 5;
