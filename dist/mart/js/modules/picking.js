/**
 * AITIP Mart Portal - 3. 주문 단위 피킹 & DOC-11 결품/수량 부분정정 모듈 (ESM)
 * 모던 커머스 어드민 UI: 오더별 피킹 카드(.mc-surface) + DOC-11 정정 원장
 */

import { martApi } from '../api.js';
import { formatShortOrderNo } from '../utils/order-format.js';
import { openMartPrintModal } from './mart-receipt.js';
import { escapeHtml } from '../utils/html.js';

let selectedDate = '';
let showAggregate = false;
let detailOrderId = '';

function renderTempPill(temp) {
  if (temp === 'REFRIGERATED') return '<span class="mc-pill mc-pill-blue">냉장</span>';
  if (temp === 'FROZEN') return '<span class="mc-pill mc-pill-amber">냉동</span>';
  return '<span class="mc-pill mc-pill-gray">상온</span>';
}

export async function renderMartPickingView(container) {
  if (!container) return;
  const [data, profRes] = await Promise.all([
    martApi.getPicking(selectedDate),
    martApi.getProfile()
  ]);
  const orders = data.orders || [];
  const mart = profRes.mart || {};
  const summaryItems = data.items || [];
  const adjustments = data.adjustments || [];
  const detailOrder = detailOrderId ? orders.find(o => o.order_id === detailOrderId) : null;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="mc-page-header">
        <div class="mc-title-wrap">
          <h1>피킹 · 결품 정정</h1>
          <span class="mc-count-pill">대기 ${orders.length}건</span>
        </div>
        <div class="mc-header-actions">
          <input type="date" id="pick-date-filter" class="mc-select" value="${escapeHtml(selectedDate)}" />
          <button type="button" class="mc-btn-secondary" id="btn-pick-clear-date">전체 날짜</button>
          <button type="button" class="mc-btn-secondary" id="btn-toggle-pick-agg">${showAggregate ? '품목 합계 닫기' : `금일 품목 합계 (${summaryItems.length}종)`}</button>
        </div>
      </div>

      ${showAggregate ? `
        <div class="mc-surface">
          <div style="padding: 14px 18px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; font-weight: 800; color: #0f172a;">
            금일 전체 주문 품목별 합계 요약 (전처리 · 발주 참고용)
          </div>
          <div class="mc-table-wrap">
            <table class="mc-table">
              <thead>
                <tr>
                  <th>품목명</th>
                  <th>보관온도</th>
                  <th style="text-align: right;">주문 합계</th>
                  <th style="text-align: right;">실측 확정 합계</th>
                  <th>전처리 · 검수 기준</th>
                </tr>
              </thead>
              <tbody>
                ${summaryItems.map(it => `
                  <tr>
                    <td><strong>${escapeHtml(it.name)}</strong></td>
                    <td>${renderTempPill(it.storage_temp)}</td>
                    <td class="mc-num">${it.total_ordered_qty} ${escapeHtml(it.uom)}</td>
                    <td class="mc-num"><strong>${it.total_actual_qty} ${escapeHtml(it.uom)}</strong></td>
                    <td style="color: #475569;">${escapeHtml(it.prep_method || it.inspection_note || '-')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${orders.length === 0 ? `
        <div class="mc-surface" style="padding: 48px 16px; text-align: center; color: #64748b;">
          피킹 대기 중인 주문이 없습니다.
        </div>
      ` : orders.map(ord => `
        <div class="mc-surface">
          <div style="padding: 14px 18px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="mc-prod-code" style="color: #334155;" title="${escapeHtml(ord.order_id)}">${escapeHtml(formatShortOrderNo(ord.order_id))}</span>
              <strong style="font-size: 14.5px; color: #0f172a;">${escapeHtml(ord.buyer_name)}</strong>
              <span class="mc-pill mc-pill-gray">배송일 ${escapeHtml(ord.delivery_date)}</span>
              <span class="mc-pill ${ord.status === 'PICKING' ? 'mc-pill-blue' : 'mc-pill-amber'}">${escapeHtml(ord.status)}</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-weight: 800; font-size: 14px; font-variant-numeric: tabular-nums;">확정 합계 ${Number(ord.total_amount || 0).toLocaleString()}원</span>
              <button type="button" class="mc-row-edit-btn btn-pick-detail" data-order-id="${escapeHtml(ord.order_id)}">상세보기</button>
              <button type="button" class="mc-btn-primary btn-complete-picking" data-order-id="${escapeHtml(ord.order_id)}" style="height: 32px; padding: 0 12px; font-size: 12.5px;">피킹 완료 -> 포장 이동</button>
            </div>
          </div>
          <div class="mc-table-wrap">
            <table class="mc-table">
              <thead>
                <tr>
                  <th>품목명</th>
                  <th>보관</th>
                  <th style="text-align: right;">주문 수량</th>
                  <th style="text-align: right;">확정 수량</th>
                  <th>정정 사유 (DOC-11)</th>
                  <th style="text-align: right;">단가</th>
                  <th style="text-align: right;">실행</th>
                </tr>
              </thead>
              <tbody>
                ${(ord.items || []).map((it, idx) => {
                  const pid = it.product_id || it.name;
                  const actual = it.actual_qty !== undefined ? it.actual_qty : it.qty;
                  const rowKey = `${ord.order_id}__${idx}`;
                  return `
                    <tr>
                      <td><strong>${escapeHtml(it.name || it.sku_name)}</strong></td>
                      <td>${renderTempPill(it.storage_temp)}</td>
                      <td class="mc-num">${it.qty} ${escapeHtml(it.uom || it.unit || '개')}</td>
                      <td class="mc-num">
                        <input type="number" step="1" min="0" class="erp-input adj-qty-input" data-row-key="${escapeHtml(rowKey)}" value="${actual}" style="width: 72px; height: 30px; text-align: right; display: inline-block;" />
                      </td>
                      <td>
                        <select class="mc-select adj-reason-select" data-row-key="${escapeHtml(rowKey)}" style="height: 30px; font-size: 12px;">
                          <option value="결품 부분취소" ${it.adjust_reason === '결품 부분취소' ? 'selected' : ''}>결품 부분취소</option>
                          <option value="수량 변경 (재고 부족 등)" ${it.adjust_reason === '수량 변경 (재고 부족 등)' ? 'selected' : ''}>수량 변경 (재고 부족 등)</option>
                          <option value="선도 불량 제외" ${it.adjust_reason === '선도 불량 제외' ? 'selected' : ''}>선도 불량 제외</option>
                          <option value="대체 상품 출고" ${it.adjust_reason === '대체 상품 출고' ? 'selected' : ''}>대체 상품 출고</option>
                        </select>
                      </td>
                      <td class="mc-num">${Number(it.unit_price || 0).toLocaleString()}원</td>
                      <td style="text-align: right;">
                        <button type="button" class="mc-row-edit-btn btn-apply-adjust" data-order-id="${escapeHtml(ord.order_id)}" data-product-id="${escapeHtml(pid)}" data-row-key="${escapeHtml(rowKey)}">부분정정</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}

      <div class="mc-surface">
        <div style="padding: 14px 18px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 800; color: #0f172a;">
          DOC-11 결품 · 수량 정정 원장 (${adjustments.length}건)
        </div>
        <div class="mc-table-wrap">
          <table class="mc-table">
            <thead>
              <tr>
                <th>주문번호</th>
                <th>수요처</th>
                <th>품목명</th>
                <th style="text-align: right;">변경 전 -> 후</th>
                <th style="text-align: right;">차액</th>
                <th>사유</th>
              </tr>
            </thead>
            <tbody>
              ${adjustments.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; color: #64748b; padding: 28px;">정정 이력이 없습니다.</td></tr>
              ` : adjustments.map(a => `
                <tr>
                  <td><span class="mc-prod-code" title="${escapeHtml(a.order_id)}">${escapeHtml(formatShortOrderNo(a.order_id))}</span></td>
                  <td>${escapeHtml(a.buyer_name)}</td>
                  <td><strong>${escapeHtml(a.product_name)}</strong></td>
                  <td class="mc-num">${a.prev_qty} -> <b>${a.actual_qty}</b></td>
                  <td class="mc-num" style="color: ${a.diff_amount < 0 ? '#b91c1c' : '#007749'}; font-weight: 700;">${a.diff_amount > 0 ? '+' : ''}${Number(a.diff_amount).toLocaleString()}원</td>
                  <td><span class="mc-pill mc-pill-gray">${escapeHtml(a.reason)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${detailOrder ? `
        <div class="mc-drawer-backdrop" id="mc-pick-backdrop">
          <div class="mc-drawer" style="width: 540px;">
            <div class="mc-drawer-header">
              <div>
                <h2>피킹 주문 상세</h2>
                <div class="mc-prod-code" style="margin-top: 2px;">${escapeHtml(detailOrder.order_id)}</div>
              </div>
              <button type="button" class="mc-drawer-close" id="btn-close-pick-drawer">×</button>
            </div>
            <div class="mc-drawer-body">
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>수요처 · 배송 정보</span>
                  <span class="mc-pill ${detailOrder.status === 'PICKING' ? 'mc-pill-blue' : 'mc-pill-amber'}">${escapeHtml(detailOrder.status)}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12.5px;">
                  <div><span style="color: #64748b;">수요처:</span> <strong>${escapeHtml(detailOrder.buyer_name)}</strong></div>
                  <div><span style="color: #64748b;">배송일:</span> ${escapeHtml(detailOrder.delivery_date || '-')}</div>
                  <div><span style="color: #64748b;">채널:</span> ${escapeHtml(detailOrder.order_channel || '-')}</div>
                  <div><span style="color: #64748b;">결제금액:</span> <strong style="color: #007749;">${Number(detailOrder.total_amount || 0).toLocaleString()}원</strong></div>
                  <div style="grid-column: 1 / -1;"><span style="color: #64748b;">요청사항:</span> ${escapeHtml(detailOrder.memo || '없음')}</div>
                </div>
              </div>
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">주문 품목 · 실측 내역 (${(detailOrder.items || []).length}건)</div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${(detailOrder.items || []).map(it => {
                    const actual = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 0);
                    return `
                      <div style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f8fafc; font-size: 12.5px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                          <strong>${escapeHtml(it.name || it.sku_name)}</strong>
                          ${renderTempPill(it.storage_temp)}
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 4px; color: #475569;">
                          <span>주문 ${it.qty}${escapeHtml(it.uom || '개')} / 실측 <b>${actual}${escapeHtml(it.uom || '개')}</b>${it.adjust_reason ? ` (${escapeHtml(it.adjust_reason)})` : ''}</span>
                          <strong>${(Number(it.unit_price || 0) * actual).toLocaleString()}원</strong>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
            <div class="mc-drawer-footer" style="justify-content: space-between;">
              <button type="button" class="mc-btn-secondary" id="btn-print-pick-detail">전표 · 명세표 출력</button>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="mc-btn-secondary" id="btn-cancel-pick-drawer">닫기</button>
                <button type="button" class="mc-btn-primary btn-complete-picking" data-order-id="${escapeHtml(detailOrder.order_id)}">피킹 완료 -> 포장 이동</button>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  container.querySelector('#pick-date-filter')?.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    renderMartPickingView(container);
  });
  container.querySelector('#btn-pick-clear-date')?.addEventListener('click', () => {
    selectedDate = '';
    renderMartPickingView(container);
  });
  container.querySelector('#btn-toggle-pick-agg')?.addEventListener('click', () => {
    showAggregate = !showAggregate;
    renderMartPickingView(container);
  });

  container.querySelectorAll('.btn-apply-adjust').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { orderId, productId, rowKey } = btn.dataset;
      const qtyInput = container.querySelector(`.adj-qty-input[data-row-key="${rowKey}"]`);
      const reasonSel = container.querySelector(`.adj-reason-select[data-row-key="${rowKey}"]`);
      await martApi.adjustOrderItem({
        order_id: orderId,
        product_id: productId,
        actual_qty: Number(qtyInput?.value ?? 0),
        reason: reasonSel?.value || '결품 부분취소'
      });
      await renderMartPickingView(container);
    });
  });

  container.querySelectorAll('.btn-complete-picking').forEach(btn => {
    btn.addEventListener('click', async () => {
      await martApi.updateOrderStatus(btn.dataset.orderId, 'PACKED');
      if (detailOrderId === btn.dataset.orderId) detailOrderId = '';
      await renderMartPickingView(container);
    });
  });

  container.querySelectorAll('.btn-pick-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      detailOrderId = btn.dataset.orderId || '';
      renderMartPickingView(container);
    });
  });
  const closePickDrawer = () => {
    detailOrderId = '';
    renderMartPickingView(container);
  };
  container.querySelector('#btn-close-pick-drawer')?.addEventListener('click', closePickDrawer);
  container.querySelector('#btn-cancel-pick-drawer')?.addEventListener('click', closePickDrawer);
  container.querySelector('#mc-pick-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-pick-backdrop') closePickDrawer();
  });
  container.querySelector('#btn-print-pick-detail')?.addEventListener('click', () => {
    if (detailOrder) openMartPrintModal(detailOrder, mart);
  });
}
