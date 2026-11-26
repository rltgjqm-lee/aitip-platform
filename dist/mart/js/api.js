/**
 * AITIP Mart Portal API Client (ESM)
 * AGENTS.md 제4항 준수: UI 내 인라인 fetch 금지, /api/mart/* 일원화
 */

const BASE_URL = '/api/mart';

let _onUnauthorized = null;
let _activeMartId = '';

export function setUnauthorizedHandler(fn) {
  _onUnauthorized = typeof fn === 'function' ? fn : null;
}

export function setActiveMartId(martId = '') {
  _activeMartId = String(martId || '').trim();
}

async function request(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (_activeMartId && !headers['X-Mart-Id']) {
    headers['X-Mart-Id'] = _activeMartId;
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    credentials: 'same-origin',
    ...options,
    headers
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/me' && _onUnauthorized) {
      _onUnauthorized(data.error || '세션이 만료되었습니다. 다시 로그인해 주세요.');
    }
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const martApi = {
  getAuthMe() {
    return request('/auth/me');
  },
  login(email, password) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },
  extendSession() {
    return request('/auth/extend', { method: 'POST' });
  },
  logout() {
    return request('/auth/logout', { method: 'POST' });
  },
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
  },
  searchHaccp({ q = '', barcode = '', limit = 50, category_hint = '' } = {}) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (barcode) params.set('barcode', barcode);
    if (limit) params.set('limit', String(limit));
    if (category_hint) params.set('category_hint', category_hint);
    return request(`/haccp/search?${params.toString()}`);
  },
  lookupBarcodesBatch(barcodes = []) {
    return request('/catalog/barcodes/lookup', { method: 'POST', body: JSON.stringify({ barcodes }) });
  },
  importHaccpImage(payload) {
    return request('/haccp/import-image', { method: 'POST', body: JSON.stringify(payload) });
  },
  searchSharedMedia(q = '', limit = 40) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (limit) params.set('limit', String(limit));
    return request(`/media/shared?${params.toString()}`);
  },
  async fetchExternalImageBlob(imageUrl) {
    const res = await fetch(`${BASE_URL}/haccp/proxy-image?url=${encodeURIComponent(imageUrl)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `외부 이미지 다운로드 실패 (HTTP ${res.status})`);
    }
    return res.blob();
  },
  getFacilities() {
    return request('/facilities');
  },
  decideFacility(payload) {
    return request('/facilities/decide', { method: 'POST', body: JSON.stringify(payload) });
  },
  applyDailyPriceBatch(payload) {
    return request('/prices/batch', { method: 'POST', body: JSON.stringify(payload) });
  },
  getPriceUploadHistory() {
    return request('/prices/history');
  },
  rollbackPriceUpload(batch_id) {
    return request('/prices/rollback', { method: 'POST', body: JSON.stringify({ batch_id }) });
  }
};
