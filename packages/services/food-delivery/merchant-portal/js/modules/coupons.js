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

  renderJointPromoOptInSection(state, tbody);
}

async function renderJointPromoOptInSection(state, tbody) {
  const card = tbody.closest('.card') || tbody.closest('section');
  if (!card) return;
  let box = document.getElementById('joint-promo-optin-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'joint-promo-optin-box';
    box.style.cssText = 'margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;';
    card.appendChild(box);
  }
  const storeId = state.store?.store_id || 'STR-11-650-01-56162-0001';
  try {
    const res = await merchantApi.getJointPromotions(storeId);
    const list = res.promotions || [];
    box.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div>
          <strong style="font-size: 14px; color: #0f172a;">본사 · 제휴사 공동 프로모션 참여 동의 (Opt-in)</strong>
          <div style="font-size: 12px; color: #64748b;">본사/제휴사 부담 행사는 점주 동의 시에만 매장에 노출되며, 가맹점 정산금에서 차감되지 않습니다.</div>
        </div>
      </div>
      <table class="data-table" style="width: 100%; font-size: 12.5px;">
        <thead>
          <tr>
            <th>주체</th>
            <th>행사 쿠폰명</th>
            <th>할인액</th>
            <th>비용 분담</th>
            <th style="text-align: center;">참여 상태</th>
            <th style="text-align: center;">동의 전환</th>
          </tr>
        </thead>
        <tbody>
          ${list.length === 0 ? '<tr><td colspan="6" style="text-align: center; color: #8b95a1; padding: 14px;">진행 중인 본사·제휴 공동 행사가 없습니다.</td></tr>' : list.map(p => `
            <tr>
              <td><span class="tag">${p.alliance_name || p.issuer_type}</span></td>
              <td><strong>${p.name}</strong></td>
              <td style="color: #2ac1bc; font-weight: 700;">${Number(p.discount_amount || 0).toLocaleString()}원</td>
              <td>본사 ${p.cost_split?.platform ?? 100}% / 제휴 ${p.cost_split?.alliance ?? 0}% / 가맹 ${p.cost_split?.merchant ?? 0}%</td>
              <td style="text-align: center;"><span class="tag ${p.opted_in ? 'tag-success' : ''}">${p.opted_in ? '참여중' : '미참여'}</span></td>
              <td style="text-align: center;">
                <button type="button" class="btn btn-secondary btn-sm btn-toggle-joint-optin" data-couponid="${p.id}">${p.opted_in ? '참여 해제' : '참여 동의'}</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    box.querySelectorAll('.btn-toggle-joint-optin').forEach(btn => {
      btn.addEventListener('click', async () => {
        await merchantApi.toggleJointPromoOptIn(storeId, btn.dataset.couponid);
        await renderJointPromoOptInSection(state, tbody);
      });
    });
  } catch (_) {
    box.innerHTML = '';
  }
}
