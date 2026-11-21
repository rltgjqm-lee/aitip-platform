/**
 * AITIP Mart Portal API Client (ESM)
 * AGENTS.md 제4항 준수: UI 내 인라인 fetch 금지, /api/mart/* 일원화
 */

const BASE_URL = '/api/mart';

async function request(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const martApi = {
  getProfile() {
    return request('/profile');
  },
  updateProfile(payload) {
    return request('/profile', { method: 'PATCH', body: JSON.stringify(payload) });
  },
  getStaff() {
    return request('/staff');
  },
  saveStaff(payload) {
    return request('/staff', { method: payload.staff_id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
  },
  deleteStaff(staff_id) {
    return request('/staff', { method: 'DELETE', body: JSON.stringify({ staff_id }) });
  },
  getCatalog() {
    return request('/catalog');
  },
  addProduct(payload) {
    return request('/products', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateProduct(payload) {
    return request('/products', { method: 'PATCH', body: JSON.stringify(payload) });
  },
  bulkUpdateGrid(updates) {
    return request('/products/bulk-grid', { method: 'PATCH', body: JSON.stringify({ updates }) });
  },
  previewFlyerImport(raw_text) {
    return request('/import/preview', { method: 'POST', body: JSON.stringify({ raw_text }) });
  },
  bulkImport(mode, raw_text) {
    return request('/import', { method: 'POST', body: JSON.stringify({ mode, raw_text }) });
  },
  createPromotion(payload) {
    return request('/promotions', { method: 'POST', body: JSON.stringify(payload) });
  },
  updatePromotion(payload) {
    return request('/promotions', { method: 'PATCH', body: JSON.stringify(payload) });
  },
  deletePromotion(id) {
    return request('/promotions', { method: 'DELETE', body: JSON.stringify({ id }) });
  },
  getPromoTypes() {
    return request('/promo-types');
  },
  savePromoType(payload) {
    return request('/promo-types', { method: payload.is_update ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
  },
  deletePromoType(code) {
    return request('/promo-types', { method: 'DELETE', body: JSON.stringify({ code }) });
  },
  getOrders() {
    return request('/orders');
  },
  createOrder(payload) {
    return request('/orders', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateOrderStatus(order_id, status) {
    return request('/orders/status', { method: 'POST', body: JSON.stringify({ order_id, status }) });
  },
  getPicking(delivery_date = '') {
    const qs = delivery_date ? `?delivery_date=${encodeURIComponent(delivery_date)}` : '';
    return request(`/picking${qs}`);
  },
  adjustOrderItem(payload) {
    return request('/orders/adjust', { method: 'POST', body: JSON.stringify(payload) });
  },
  getBoxing(delivery_date = '') {
    const qs = delivery_date ? `?delivery_date=${encodeURIComponent(delivery_date)}` : '';
    return request(`/boxing${qs}`);
  },
  getSettlements() {
    return request('/settlements');
  },
  getPwaConfig() {
    return request('/pwa/config');
  },
  updatePwaControl(payload) {
    return request('/pwa/control', { method: 'PATCH', body: JSON.stringify(payload) });
  },
  getMarts() {
    return request('/marts');
  },
  getGroupBuys() {
    return request('/group-buys');
  },
  createGroupBuy(payload) {
    return request('/group-buys', { method: 'POST', body: JSON.stringify(payload) });
  },
  decideProductApproval(payload) {
    return request('/products/approve', { method: 'POST', body: JSON.stringify(payload) });
  },
  joinGroupBuy(payload) {
    return request('/group-buys/join', { method: 'POST', body: JSON.stringify(payload) });
  },
  uploadMedia(payload) {
    return request('/media/upload', { method: 'POST', body: JSON.stringify(payload) });
  }
};
