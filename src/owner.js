import { OWNER_IPS } from './data/config.js';

/** Проверка IP владельца. На статическом хостинге это «мягкая» защита — для одноклассников достаточно. */
export async function checkOwnerAccess() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (!res.ok) return { isOwner: false, ip: null };
    const { ip } = await res.json();
    return { isOwner: OWNER_IPS.includes(ip), ip };
  } catch {
    return { isOwner: false, ip: null };
  }
}
