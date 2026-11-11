/**
 * ============================================================================
 * AITIP Merchant Portal API Service Layer (ESM)
 * 준수 규격: DOC-07 제3항 (API 계층 분리), 전역 오염 0%
 * ============================================================================
 */

const BASE_URL = '/api/food';

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
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}: API 호출 실패`);
    }
    return await res.json();
  } catch (err) {
    console.error(`[MerchantAPI Error] ${endpoint}:`, err);
    throw err;
  }
}

export const merchantApi = {
  // 1. 매장 기본정보 조회 및 수정
  getStoreInfo() {
    return request('/store');
  },
  updateStoreInfo(data) {
    return request('/store', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 1-0. 배달 가능 지역 및 주문금액별 배달팁 규칙 영속화
  getDeliveryRules() {
    return request('/store/delivery-rules');
  },
  updateDeliveryRules(rules) {
    return request('/store/delivery-rules', {
      method: 'PUT',
      body: JSON.stringify(rules),
    });
  },

  // 1-1. 주간 7일 운영시간 & 브레이크타임 (D1 store_hours 규격)
  getStoreHours() {
    return request('/store/hours');
  },
  updateStoreHours(hours) {
    return request('/store/hours', {
      method: 'PUT',
      body: JSON.stringify({ hours }),
    });
  },

  // 1-2. 국경일 자동휴무 및 명절 원클릭 설정
  getHolidaySettings() {
    return request('/store/holidays');
  },
  updateHolidaySettings(settings) {
    return request('/store/holidays', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  // 1-3. 개인사정 임시휴무 등록 및 삭제
  addCustomClosure(data) {
    return request('/store/holidays/custom', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  deleteCustomClosure(id) {
    return request(`/store/holidays/custom/${id}`, {
      method: 'DELETE',
    });
  },

  // 2. 3단 메뉴 카탈로그 조회 및 등록
  getMenuCatalog() {
    return request('/menu');
  },
  createMenuItem(menuData) {
    return request('/menu', {
      method: 'POST',
      body: JSON.stringify(menuData),
    });
  },
  createCategory(categoryData) {
    return request('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  },
  createOptionGroup(groupData) {
    return request('/option-groups', {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
  },

  // 3. 메뉴 가격 실시간 수정 (인라인 엑셀식)
  updatePrice(productId, price, discountedPrice = null) {
    return request(`/menu/${productId}/price`, {
      method: 'PATCH',
      body: JSON.stringify({ price, discounted_price: discountedPrice }),
    });
  },

  // 4. 품절/노출 상태 변경
  updateStatus(productId, status) {
    return request(`/menu/${productId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // 5. 실시간 KDS 주문 목록 조회
  getLiveOrders() {
    return request('/orders/live');
  },

  // 6. 실시간 주문 접수 (조리시간 선택, 주방인쇄)
  acceptOrder(orderId, prepTimeMinutes = 25) {
    return request(`/orders/${orderId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ prep_time_minutes: prepTimeMinutes }),
    });
  },

  // 6-1. 라이더 배차 상태 업데이트
  updateRiderStatus(orderId, riderStatus) {
    return request(`/orders/${orderId}/rider-status`, {
      method: 'PATCH',
      body: JSON.stringify({ rider_dispatch_status: riderStatus }),
    });
  },

  // 6-2. 하이브리드 배달 방식 (자체 배달 vs 대행 호출) 업데이트
  updateDeliveryMethod(orderId, { delivery_method, status }) {
    return request(`/orders/${orderId}/delivery-method`, {
      method: 'PATCH',
      body: JSON.stringify({ delivery_method, status }),
    });
  },

  // 6-2b. 매장 식사 (DINE_IN) 테이블 고객 착석 및 식사완료
  updateDineInStatus(orderId, { status }) {
    return request(`/orders/${orderId}/dine-in-status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // 6-2c. 매장 관리 메뉴 순서 및 매장 운영 타입 변경
  updateStoreNavOrder(nav_order) {
    return request('/store/nav-order', {
      method: 'PUT',
      body: JSON.stringify({ nav_order }),
    });
  },
  updateStoreType(store_operation_type) {
    return request('/store/operation-type', {
      method: 'PUT',
      body: JSON.stringify({ store_operation_type }),
    });
  },
  // 6-2d. 5대 업종 공통 가맹점 메타 블록 (주차/위치/시설/공지) 저장
  updateStoreBlocks(blocks) {
    return request('/store/blocks', {
      method: 'PUT',
      body: JSON.stringify(blocks),
    });
  },

  // 6-3. 고객 리뷰 조회 및 사장님 답글
  getReviews() {
    return request('/reviews');
  },
  replyReview(reviewId, reply) {
    return request(`/reviews/${reviewId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply }),
    });
  },
  requestReviewBlind(reviewId, reason) {
    return request(`/reviews/${reviewId}/blind`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // 7. 가게 할인 쿠폰 목록 조회 및 신규 발행
  getCoupons() {
    return request('/coupons');
  },
  createCoupon(couponData) {
    return request('/coupons', {
      method: 'POST',
      body: JSON.stringify(couponData),
    });
  },

  // 8. 정산 및 부가세 세무 증빙 대사 원장 조회 (D1 규격)
  getSettlementOverview(year = 2026, month = 11) {
    return request(`/settlement?year=${year}&month=${month}`);
  },
  getTaxCsvUrl(year = 2026, month = 11) {
    return `${BASE_URL}/settlement/tax-csv?year=${year}&month=${month}`;
  },

  // 9. 매장 식사(홀) 테이블 현황 및 실시간 예약
  getDineInTables() {
    return request('/dinein/tables');
  },
  getDineInReservations() {
    return request('/dinein/reservations');
  },
  confirmDineInReservation(reservationId) {
    return request(`/dinein/reservations/${reservationId}/confirm`, {
      method: 'POST',
    });
  },
  seatDineInReservation(reservationId, tableNo = null) {
    return request(`/dinein/reservations/${reservationId}/seat`, {
      method: 'POST',
      body: JSON.stringify({ table_no: tableNo }),
    });
  },
  completeDineInReservation(reservationId, tableNo = null) {
    return request(`/dinein/reservations/${reservationId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ table_no: tableNo }),
    });
  },
  cancelDineInReservation(reservationId, reason = '점주 사정 취소') {
    return request(`/dinein/reservations/${reservationId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};
