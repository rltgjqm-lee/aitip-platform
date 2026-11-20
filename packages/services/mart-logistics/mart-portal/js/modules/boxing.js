/**
 * AITIP Mart Portal - 4. 온도대별 박싱(합포장 분리) & 순회 배송 출고 모듈 (ESM)
 * 모던 커머스 어드민 UI: .mc-page-header + .mc-surface 온도대별 박스 카드
 */

import { martApi } from '../api.js';

let selectedDate = '';

function escapeHtml(v = '') {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TEMP_STYLE = {
  AMBIENT: 'background: #f8fafc; border-color: #e2e8f0; color: #334155;',
  REFRIGERATED: 'background: #f0f9ff; border-color: #bae6fd; color: #075985;',
  FROZEN: 'background: #eef2ff; border-color: #c7d2fe; color: #3730a3;'
};

export async function renderMartBoxingView(container) {
  if (!container) return;
  const data = await martApi.getBoxing(selectedDate);
  const manifest = data.manifest || [];

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="mc-page-header">
        <div class="mc-title-wrap">
          <h1>포장(상온·냉장·냉동) & 배송</h1>
          <span class="mc-count-pill">출고 대상 ${manifest.length}건</span>
        </div>
        <div class="mc-header-actions">
          <input type="date" id="box-date-filter" class="mc-select" value="${escapeHtml(selectedDate)}" />
          <button type="button" class="mc-btn-secondary" id="btn-box-clear-date">전체 날짜</button>
        </div>
      </div>

      ${manifest.length === 0 ? `
        <div class="mc-surface" style="padding: 48px 16px; text-align: center; color: #64748b;">
          포장 또는 출고 대기 중인 주문이 없습니다.
        </div>
      ` : manifest.map(m => `
        <div class="mc-surface" style="padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="mc-prod-code" style="color: #334155;">${escapeHtml(m.order_id)}</span>
              <strong style="font-size: 14.5px; color: #0f172a;">${escapeHtml(m.buyer_name)}</strong>
              <span class="mc-pill mc-pill-blue">총 ${m.box_count}박스 분리</span>
              <span class="mc-pill mc-pill-green">${escapeHtml(m.status)}</span>
            </div>
            <div style="display: flex; gap: 6px;">
              ${m.status !== 'PACKED' && m.status !== 'DISPATCHED' ? `<button type="button" class="mc-btn-secondary btn-box-status" data-order-id="${escapeHtml(m.order_id)}" data-status="PACKED" style="height: 32px; font-size: 12px;">박싱 완료</button>` : ''}
              ${m.status !== 'DISPATCHED' ? `<button type="button" class="mc-btn-primary btn-box-status" data-order-id="${escapeHtml(m.order_id)}" data-status="DISPATCHED" style="height: 32px; font-size: 12px;">배송 출발</button>` : ''}
              <button type="button" class="mc-btn-secondary btn-box-status" data-order-id="${escapeHtml(m.order_id)}" data-status="DELIVERED" style="height: 32px; font-size: 12px;">납품 완료</button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
            ${(m.boxes || []).map(b => `
              <div style="border: 1px solid; border-radius: 10px; padding: 14px; ${TEMP_STYLE[b.storage_temp] || TEMP_STYLE.AMBIENT}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <strong style="font-size: 13.5px;">${escapeHtml(b.box_label)}</strong>
                  <span class="mc-prod-code">${escapeHtml(b.box_id)}</span>
                </div>
                <ul style="margin: 0; padding-left: 16px; font-size: 12.5px; line-height: 1.65;">
                  ${(b.items || []).map(it => `<li>${escapeHtml(it.name)} — <b>${it.qty} ${escapeHtml(it.uom)}</b></li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelector('#box-date-filter')?.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    renderMartBoxingView(container);
  });
  container.querySelector('#btn-box-clear-date')?.addEventListener('click', () => {
    selectedDate = '';
    renderMartBoxingView(container);
  });
  container.querySelectorAll('.btn-box-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      await martApi.updateOrderStatus(btn.dataset.orderId, btn.dataset.status);
      await renderMartBoxingView(container);
    });
  });
}
