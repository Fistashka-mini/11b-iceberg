// IP владельца (ты) — архив логов + права модера автоматически.
// Узнать публичный IP: https://api.ipify.org
// ipconfig / 192.168.* / Radmin VPN — НЕ подходят, сайт их не видит.
export const OWNER_IPS = [
  '31.175.6.62',
];

// Модераторы (друзья) + можно дублировать свой IP сюда же
export const MODERATOR_IPS = [
  '31.175.6.62', // ты (владелец)
  '217.30.203.153', // друг
];

// Бесплатное key-value хранилище (общее для всех, у кого есть ссылка)
export const KV_APP_KEY = 'qw37tais';
export const KV_BASE = 'https://keyvalue.immanuel.co/api/KeyVal';

// Лимит текста. Кириллица занимает больше байт — иначе облако отклоняет запись (~1 КБ).
export const ABOUT_MAX = 160;
export const ARTICLE_MAX = 180;
export const ARTICLE_TITLE_MAX = 60;
export const FACT_MAX = 40;
export const FACTS_MAX = 3;
