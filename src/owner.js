import { OWNER_IPS, MODERATOR_IPS } from './data/config.js';

/** Публичный IP + роли. Локальные адреса из ipconfig сайт не видит. */
export async function checkRoles() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (!res.ok) return { ip: null, isOwner: false, isMod: false };
    const { ip } = await res.json();
    return {
      ip,
      isOwner: OWNER_IPS.includes(ip),
      isMod: MODERATOR_IPS.includes(ip) || OWNER_IPS.includes(ip),
    };
  } catch {
    return { ip: null, isOwner: false, isMod: false };
  }
}

/** @deprecated use checkRoles */
export async function checkOwnerAccess() {
  const r = await checkRoles();
  return { isOwner: r.isOwner, ip: r.ip };
}
