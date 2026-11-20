/**
 * AITIP Mart PWA API Client (ESM)
 */

const BASE = '/api/mart';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const martPwaApi = {
  getPwaConfig() { return req('/pwa/config'); },
  getCatalog() { return req('/catalog'); },
  getMarts() { return req('/marts'); },
  getGroupBuys() { return req('/group-buys'); },
  joinGroupBuy(payload) { return req('/group-buys/join', { method: 'POST', body: JSON.stringify(payload) }); },
  createOrder(payload) { return req('/orders', { method: 'POST', body: JSON.stringify(payload) }); }
};
