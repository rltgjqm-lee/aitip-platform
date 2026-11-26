/**
 * AITIP Mart B2B 기관 전용 API Client (ESM)
 * AGENTS.md 제4항 준수: UI 내 인라인 fetch 금지, /api/mart/* 일원화
 */

const BASE = '/api/mart';

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const martB2bApi = {
  login(payload) {
    return req('/b2b/login', { method: 'POST', body: JSON.stringify(payload) });
  },
  registerFacility(payload) {
    return req('/facilities/register', { method: 'POST', body: JSON.stringify(payload) });
  },
  getPwaConfig() {
    return req('/pwa/config');
  },
  getCatalog() {
    return req('/catalog');
  },
  getGroupBuys() {
    return req('/group-buys');
  },
  joinGroupBuy(payload) {
    return req('/group-buys/join', { method: 'POST', body: JSON.stringify(payload) });
  },
  getOrders() {
    return req('/orders');
  },
  createOrder(payload) {
    return req('/orders', { method: 'POST', body: JSON.stringify(payload) });
  },
  adjustOrderItem(payload) {
    return req('/orders/adjust', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateOrderStatus(order_id, status) {
    return req('/orders/status', { method: 'POST', body: JSON.stringify({ order_id, status }) });
  }
};
