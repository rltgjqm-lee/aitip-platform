/**
 * ============================================================================
 * AITIP Merchant Portal - 매장 자체 할인 쿠폰 관리 모듈 (ESM)
 * 준수 규격: DOC-02, DOC-11 (TypeID cpn_ 발급 및 최소주문금액/할인액 제약)
 * ============================================================================
 */
import { merchantApi } from '../api.js';

/**
 * 매장 쿠폰 목록 렌더링 및 신규 발행 바인딩
 * @param {Object} state
 */
export function renderCoupons(state) {
  const tbody = document.getElementById('tbody-coupons');
  if (!tbody) return;

  tbody.innerHTML = '';
  const coupons = Array.isArray(state.coupons) ? state.coupons : [];
  if (coupons.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #8b95a1; padding: 20px;">발행된 쿠폰이 없습니다.</td></tr>`;
    return;
  }

  coupons.forEach(cpn => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${cpn.name}</strong></td>
      <td style="color: #2ac1bc; font-weight: 700;">${Number(cpn.discount_amount).toLocaleString()}원 즉시 할인</td>
      <td>${Number(cpn.min_order_amount).toLocaleString()}원 이상</td>
      <td style="color: #64748b;">${cpn.valid_until || '상시 발급'}</td>
      <td style="text-align: center;"><span class="tag tag-success">발행중</span></td>
      <td style="text-align: center;"><button class="btn btn-secondary btn-sm" data-pause-coupon="${cpn.id}">중지</button></td>
    `;
    tbody.appendChild(tr);

    tr.querySelector(`[data-pause-coupon="${cpn.id}"]`)?.addEventListener('click', () => {
      alert(`'${cpn.name}' 쿠폰 발급이 중지되었습니다.`);
      state.coupons = state.coupons.filter(c => c.id !== cpn.id);
      renderCoupons(state);
    });
  });

  // 신규 쿠폰 발행 버튼 리스너 바인딩 (중복 등록 방지)
  const btnCreateCoupon = document.getElementById('btn-open-create-coupon');
  if (btnCreateCoupon && !btnCreateCoupon.dataset.bound) {
    btnCreateCoupon.dataset.bound = 'true';
    btnCreateCoupon.addEventListener('click', async () => {
      const name = prompt('발행할 쿠폰명을 입력하세요 (예: 단골감사 2,000원 할인):');
      if (!name || !name.trim()) return;

      const discount = prompt('할인 금액(원)을 입력하세요:', '2000');
      if (!discount || isNaN(discount) || Number(discount) <= 0) {
        alert('올바른 할인 금액을 입력해 주세요.');
        return;
      }

      const minOrder = prompt('최소 주문금액(원)을 입력하세요:', '20000');
      const validUntil = prompt('유효 기간을 입력하세요 (예: 2026-12-31 또는 상시 발급):', '상시 발급');

      try {
        const res = await merchantApi.createCoupon({
          name: name.trim(),
          discount_amount: Number(discount),
          min_order_amount: Number(minOrder) || 0,
          valid_until: validUntil || '상시 발급'
        });
        state.coupons.push(res.coupon);
        renderCoupons(state);
        alert(`'${name.trim()}' 쿠폰이 성공적으로 발행되었습니다.`);
      } catch (err) {
        alert('쿠폰 발행 실패: ' + err.message);
      }
    });
  }
}
