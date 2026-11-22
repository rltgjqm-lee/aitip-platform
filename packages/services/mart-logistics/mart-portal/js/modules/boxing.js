/**
 * AITIP Mart Portal - 4. 온도대별 박싱(합포장 분리) & 순회 배송 출고 모듈 (ESM)
 * 모던 커머스 어드민 UI: .mc-page-header + .mc-surface 온도대별 박스 카드
 */

import { martApi } from '../api.js';
import { formatShortOrderNo } from '../utils/order-format.js';
import { openMartPrintModal } from './mart-receipt.js';
import { escapeHtml } from '../utils/html.js';

let selectedDate = '';
let detailOrderId = '';

const TEMP_STYLE = {
  AMBIENT: 'background: #f8fafc; border-color: #e2e8f0; color: #334155;',
  REFRIGERATED: 'background: #f0f9ff; border-color: #bae6fd; color: #075985;',
  FROZEN: 'background: #eef2ff; border-color: #c7d2fe; color: #3730a3;'
};

export async function renderMartBoxingView(container) {
  if (!container) return;
  const [data, ordRes, profRes] = await Promise.all([
    martApi.getBoxing(selectedDate),
    martApi.getOrders(),
    martApi.getProfile()
  ]);
  const manifest = data.manifest || [];
  const orders = ordRes.orders || [];
  const mart = profRes.mart || {};
  const detailManifest = detailOrderId ? manifest.find(m => m.order_id === detailOrderId) : null;
  const detailOrder = detailOrderId ? orders.find(o => o.order_id === detailOrderId) : null;

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
              <span class="mc-prod-code" style="color: #334155;" title="${escapeHtml(m.order_id)}">${escapeHtml(formatShortOrderNo(m.order_id))}</span>
              <strong style="font-size: 14.5px; color: #0f172a;">${escapeHtml(m.buyer_name)}</strong>
              <span class="mc-pill mc-pill-blue">총 ${m.box_count}박스 분리</span>
              <span class="mc-pill mc-pill-green">${escapeHtml(m.status)}</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button type="button" class="mc-row-edit-btn btn-box-detail" data-order-id="${escapeHtml(m.order_id)}">상세보기</button>
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

      ${detailManifest ? `
        <div class="mc-drawer-backdrop" id="mc-box-backdrop">
          <div class="mc-drawer" style="width: 540px;">
            <div class="mc-drawer-header">
              <div>
                <h2>포장 · 배송 상세</h2>
                <div class="mc-prod-code" style="margin-top: 2px;">${escapeHtml(detailManifest.order_id)}</div>
              </div>
              <button type="button" class="mc-drawer-close" id="btn-close-box-drawer">×</button>
            </div>
            <div class="mc-drawer-body">
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>수요처 · 출고 정보</span>
                  <span class="mc-pill mc-pill-green">${escapeHtml(detailManifest.status)}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12.5px;">
                  <div><span style="color: #64748b;">수요처:</span> <strong>${escapeHtml(detailManifest.buyer_name)}</strong></div>
                  <div><span style="color: #64748b;">분리 박스:</span> <strong>총 ${detailManifest.box_count}박스</strong></div>
                  <div><span style="color: #64748b;">배송일:</span> ${escapeHtml(detailOrder?.delivery_date || '-')}</div>
                  <div><span style="color: #64748b;">결제금액:</span> <strong style="color: #007749;">${Number(detailOrder?.total_amount || 0).toLocaleString()}원</strong></div>
                  <div style="grid-column: 1 / -1;"><span style="color: #64748b;">요청사항:</span> ${escapeHtml(detailOrder?.memo || '없음')}</div>
                </div>
              </div>
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">온도대별 박스 내역</div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  ${(detailManifest.boxes || []).map(b => `
                    <div style="border: 1px solid; border-radius: 8px; padding: 12px; ${TEMP_STYLE[b.storage_temp] || TEMP_STYLE.AMBIENT}">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                        <strong>${escapeHtml(b.box_label)}</strong>
                        <span class="mc-prod-code">${escapeHtml(b.box_id)}</span>
                      </div>
                      <ul style="margin: 0; padding-left: 16px; font-size: 12.5px; line-height: 1.6;">
                        ${(b.items || []).map(it => `<li>${escapeHtml(it.name)} — <b>${it.qty} ${escapeHtml(it.uom)}</b></li>`).join('')}
                      </ul>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
            <div class="mc-drawer-footer" style="justify-content: space-between;">
              ${detailOrder ? `<button type="button" class="mc-btn-secondary" id="btn-print-box-detail">전표 · 명세표 출력</button>` : '<span></span>'}
              <button type="button" class="mc-btn-secondary" id="btn-cancel-box-drawer">닫기</button>
            </div>
          </div>
        </div>
      ` : ''}
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
      if (detailOrderId === btn.dataset.orderId && btn.dataset.status === 'DELIVERED') detailOrderId = '';
      await renderMartBoxingView(container);
    });
  });
  container.querySelectorAll('.btn-box-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      detailOrderId = btn.dataset.orderId || '';
      renderMartBoxingView(container);
    });
  });
  const closeBoxDrawer = () => {
    detailOrderId = '';
    renderMartBoxingView(container);
  };
  container.querySelector('#btn-close-box-drawer')?.addEventListener('click', closeBoxDrawer);
  container.querySelector('#btn-cancel-box-drawer')?.addEventListener('click', closeBoxDrawer);
  container.querySelector('#mc-box-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-box-backdrop') closeBoxDrawer();
  });
  container.querySelector('#btn-print-box-detail')?.addEventListener('click', () => {
    if (detailOrder) openMartPrintModal(detailOrder, mart);
  });
}
