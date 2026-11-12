/**
 * ============================================================================
 * AITIP Merchant Portal - 배달지역(행정동 칩) 및 금액구간별 배달팁 규칙 모듈 (ESM)
 * 준수 규격: DOC-02, DOC-08, DOC-11 (글자 줄바꿈 100% 방지, 구간별 배달팁)
 * ============================================================================
 */
import { merchantApi } from '../api.js';

/**
 * 배달 지역 및 배달팁 규칙 UI 렌더링
 * @param {Object} state
 */
export function renderDeliverySettings(state) {
  renderDeliveryRegions(state);
  renderTipRulesTable(state);
}

/**
 * 배달지역 행정동 칩 렌더링
 * @param {Object} state
 */
export function renderDeliveryRegions(state) {
  const container = document.getElementById('region-chips-container');
  if (!container) return;

  container.innerHTML = '';
  if (!Array.isArray(state.deliveryRegions)) {
    state.deliveryRegions = [];
  }

  state.deliveryRegions.forEach(dong => {
    const chip = document.createElement('div');
    chip.className = 'region-chip';
    chip.innerHTML = `
      <span>${dong}</span>
      <span class="chip-remove" data-remove-dong="${dong}">×</span>
    `;
    container.appendChild(chip);

    chip.querySelector(`[data-remove-dong="${dong}"]`).addEventListener('click', () => {
      state.deliveryRegions = state.deliveryRegions.filter(d => d !== dong);
      renderDeliveryRegions(state);
    });
  });
}

/**
 * 주문금액 구간별 배달팁 규칙 테이블 렌더링
 * @param {Object} state
 */
export function renderTipRulesTable(state) {
  const tbody = document.getElementById('tbody-tip-rules');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!Array.isArray(state.deliveryTipRules)) {
    state.deliveryTipRules = [];
  }

  state.deliveryTipRules.forEach((rule, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${idx + 1}구간</strong></td>
      <td>
        <div class="input-unit-group">
          <input type="number" class="tip-rule-min" style="width: 110px;" value="${rule.min}">
          <span class="unit-label">원 이상 ~</span>
          <input type="number" class="tip-rule-max" style="width: 110px;" value="${rule.max}">
          <span class="unit-label">원 미만</span>
        </div>
      </td>
      <td>
        <div class="input-unit-group">
          <input type="number" class="tip-rule-amount" style="width: 100px; font-weight: 700; color: #191f28;" value="${rule.tip}">
          <span class="unit-label">원</span>
        </div>
      </td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-sm" data-remove-rule="${idx}">삭제</button>
      </td>
    `;
    tbody.appendChild(tr);

    // 인풋 변경 시 상태 동기화
    const inputMin = tr.querySelector('.tip-rule-min');
    const inputMax = tr.querySelector('.tip-rule-max');
    const inputAmount = tr.querySelector('.tip-rule-amount');

    inputMin.addEventListener('change', () => { rule.min = Number(inputMin.value) || 0; });
    inputMax.addEventListener('change', () => { rule.max = Number(inputMax.value) || 0; });
    inputAmount.addEventListener('change', () => { rule.tip = Number(inputAmount.value) || 0; });

    tr.querySelector(`[data-remove-rule="${idx}"]`).addEventListener('click', () => {
      state.deliveryTipRules.splice(idx, 1);
      renderTipRulesTable(state);
    });
  });
}
