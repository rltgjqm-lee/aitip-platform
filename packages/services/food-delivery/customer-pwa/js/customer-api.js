/**
 * ============================================================================
 * AITIP Customer PWA API Service Layer (ESM)
 * 준수 규격: AGENTS.md 제4항 (API 모듈화 및 계층 분리 철칙)
 * UI/컴포넌트 내 fetch 인라인 호출 100% 금지, Base URL 및 에러 핸들링 일원화
 * ============================================================================
 */

const BASE_URL = '/api/food';

/**
 * 공통 HTTP 요청 처리기
 * @param {string} endpoint 
 * @param {RequestInit} options 
 * @returns {Promise<any>}
 */
async function request(endpoint, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, config);
    if (!res.ok || res.headers.get('content-type')?.includes('text/html')) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}: API 호출 실패 (${endpoint})`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`[CustomerAPI Warning] ${endpoint}:`, err.message);
    throw err;
  }
}

export const customerApi = {
  /**
   * 1. 매장 기본 정보 조회 (상호, 영업시간, 배달팁 규칙 등)
   * @returns {Promise<Object>}
   */
  getStoreInfo() {
    return request('/store');
  },

  /**
   * 2. 3단 메뉴 카탈로그 조회 (카테고리, 상품, 옵션 그룹)
   * @returns {Promise<{categories: Array, products: Array, option_groups: Array}>}
   */
  getMenuCatalog() {
    return request('/menu');
  },

  /**
   * 3. 고객 리뷰 목록 조회
   * @returns {Promise<Array>}
   */
  getReviews() {
    return request('/reviews').catch(() => []);
  },

  /**
   * 4. 대문 초기 비동기 일괄 로드 (매장, 메뉴, 리뷰 병렬 조회)
   * @returns {Promise<{store: Object, menu: Object, reviews: Array}>}
   */
  async loadStoreBootstrap() {
    const [store, menu, reviews] = await Promise.all([
      this.getStoreInfo(),
      this.getMenuCatalog(),
      this.getReviews()
    ]);
    return { store, menu, reviews };
  },

  /**
   * 5. 실시간 주문 발주 (배달/포장/매장식사, 0504 안심번호, 옵션 스냅샷)
   * @param {Object} orderPayload 
   * @returns {Promise<{success: boolean, order: Object}>}
   */
  createOrder(orderPayload) {
    return request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload)
    });
  },

  /**
   * 6. 실시간 주문 조리/배달 진행 상태 추적
   * @param {string} orderId 
   * @returns {Promise<{success: boolean, track: Object}>}
   */
  trackOrder(orderId) {
    return request(`/orders/${encodeURIComponent(orderId)}/track`);
  },

  /**
   * 7. Zero-PII 공개 피드 (플랫폼 배너·공지·점검모드·고객 UID 포인트 잔액)
   * @param {string} customerUid
   */
  getPublicFeed(customerUid) {
    const qs = customerUid ? `?customer_uid=${encodeURIComponent(customerUid)}` : '';
    return request(`/public-feed${qs}`).catch(() => ({
      success: false,
      point_balance: 0,
      banners: [],
      maintenance_mode: false
    }));
  }
};
