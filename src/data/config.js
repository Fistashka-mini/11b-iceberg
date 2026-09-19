// IP владельца — кнопка «Архив» (логи изменений).
// Узнать публичный IP: https://api.ipify.org
// (192.168.* и адреса Radmin VPN с ipconfig сюда НЕ подходят — сайт видит только публичный IP)
export const OWNER_IPS = [
  '31.175.6.62',
];

// Модераторы: пишут статьи и двигают людей по глубине айсберга
export const MODERATOR_IPS = [
  '31.175.6.62', // первый модер (публичный IP)
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
