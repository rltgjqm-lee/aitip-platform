/**
 * AITIP Mart Portal - 6. 마트 매출 · 과면세 정산 조회 모듈 (ESM)
 * 마트 포털에서는 내부 수수료율 분배(위탁/플랫폼)와 내부 원장·기관 UID를 숨기고,
 * 총 매출 · 과면세 · 총 공제액 · 실입금 예정액 및 주문번호/수요처/배송일 검색을 제공한다.
 */

import { martApi } from '../api.js';
import { formatShortOrderNo } from '../utils/order-format.js';
import { openMartPrintModal } from './mart-receipt.js';
import { paginateArray, renderMartPaginationHtml, bindMartPaginationEvents } from '../utils/pagination.js';
import { escapeHtml, bindStopPropagation } from '../utils/html.js';

const PAY_METHOD_META = {
  CARD: { label: '카드 · 간편결제', pill: 'mc-pill-blue' },
  FACILITY_POSTPAY: { label: '기관 월말 후불', pill: 'mc-pill-amber' },
  MUNICIPAL_VOUCHER: { label: '지자체 바우처', pill: 'mc-pill-green' },
  CASH: { label: '현금', pill: 'mc-pill-gray' }
};

const CUSTOMER_TYPE_META = {
  INDIVIDUAL: { label: '일반고객', group: 'B2C', pill: 'mc-pill-blue' },
  SENIOR_CENTER: { label: '경로당', group: 'B2B', pill: 'mc-pill-green' },
  ELDERLY_CARE: { label: '독거돌봄', group: 'B2B', pill: 'mc-pill-amber' },
  INSTITUTION_B2B: { label: '공공기관', group: 'B2B', pill: 'mc-pill-gray' }
};

function getCustomerMeta(row) {
  if (row?.customer_type && CUSTOMER_TYPE_META[row.customer_type]) {
    return CUSTOMER_TYPE_META[row.customer_type];
  }
  const isB2b = Boolean(row?.facility_id);
  return {
    label: isB2b ? '기관·경로당' : '일반고객',
    group: isB2b ? 'B2B' : 'B2C',
    pill: isB2b ? 'mc-pill-green' : 'mc-pill-blue'
  };
}

function getPayMeta(row) {
  const code = row?.payment_method || 'FACILITY_POSTPAY';
  return PAY_METHOD_META[code] || { label: code, pill: 'mc-pill-gray' };
}

export async function renderMartSettlementView(container) {
  if (!container) return;
  const [data, ordRes, profRes] = await Promise.all([
    martApi.getSettlements(),
    martApi.getOrders(),
    martApi.getProfile()
  ]);
  const t = data.totals || {};
  const allRows = data.rows || [];
  const orders = ordRes.orders || [];
  const mart = profRes.mart || data.mart || {};
  const totalDeduction = Number(t.total_deduction ?? (Number(t.pg_fee_total || 0) + Number(t.saas_fee_total || 0)));

  let segmentTab = 'ALL'; // 'ALL' | 'B2C' | 'B2B'
  let filterPayMethod = 'ALL';
  let keyword = '';
  let filterDate = '';
  let currentPage = 1;
  let pageSize = 10;
  let detailOrderId = '';

  function render() {
    const b2cCount = allRows.filter(r => getCustomerMeta(r).group === 'B2C').length;
    const b2bCount = allRows.filter(r => getCustomerMeta(r).group === 'B2B').length;
    const q = keyword.trim().toLowerCase();
    const rows = allRows.filter(r => {
      if (segmentTab !== 'ALL' && getCustomerMeta(r).group !== segmentTab) return false;
      if (filterPayMethod !== 'ALL' && (r.payment_method || 'FACILITY_POSTPAY') !== filterPayMethod) return false;
      if (filterDate && String(r.delivery_date || '') !== filterDate) return false;
      if (!q) return true;
      const shortNo = formatShortOrderNo(r.order_id).toLowerCase();
      return [
        shortNo,
        String(r.order_id || '').toLowerCase(),
        String(r.buyer_name || '').toLowerCase(),
        String(r.ledger_id || '').toLowerCase(),
        String(r.facility_id || '').toLowerCase(),
        getPayMeta(r).label.toLowerCase(),
        getCustomerMeta(r).label.toLowerCase()
      ].some(v => v.includes(q));
    });

    const isFiltered = segmentTab !== 'ALL' || filterPayMethod !== 'ALL' || Boolean(keyword || filterDate);
    const filteredExempt = rows.reduce((sum, r) => sum + Number(r.exempt_amount || 0), 0);
    const filteredTaxable = rows.reduce((sum, r) => sum + Number(r.taxable_amount || 0), 0);
    const filteredSales = filteredExempt + filteredTaxable;
    const filteredDeduction = rows.reduce((sum, r) => sum + Number(r.total_fee ?? (Number(r.pg_fee || 0) + Number(r.saas_fee || 0))), 0);
    const filteredMartSettle = rows.reduce((sum, r) => sum + Number(r.mart_settlement || 0), 0);

    const kpiGross = isFiltered ? filteredSales : Number(t.gross_sales || 0);
    const kpiExempt = isFiltered ? filteredExempt : Number(t.exempt_sales || 0);
    const kpiTaxable = isFiltered ? filteredTaxable : Number(t.taxable_sales || 0);
    const kpiDeduction = isFiltered ? filteredDeduction : totalDeduction;
    const kpiMartSettle = isFiltered ? filteredMartSettle : Number(t.mart_settlement_total || 0);

    const pageInfo = paginateArray(rows, currentPage, pageSize);
    currentPage = pageInfo.page;
    const detailRow = detailOrderId ? allRows.find(r => r.order_id === detailOrderId) : null;
    const detailOrder = detailOrderId ? orders.find(o => o.order_id === detailOrderId) : null;
    const detailCustMeta = detailRow ? getCustomerMeta(detailRow) : null;
    const detailPayMeta = detailRow ? getPayMeta(detailRow) : null;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="mc-page-header">
          <div class="mc-title-wrap">
            <h1>결제 · 정산 내역</h1>
            <span class="mc-count-pill">${escapeHtml(data.mart?.mart_name || '하나로마트')}</span>
          </div>
          <div style="font-size: 12.5px; color: #64748b;">
            일반고객(B2C) · 기관(B2B) 결제수단 · 면세/과세 자동 분리 기준
          </div>
        </div>

        <div class="mc-tabs" style="margin-bottom: 0;">
          <button type="button" class="mc-tab ${segmentTab === 'ALL' ? 'active' : ''}" data-stl-tab="ALL">전체 내역 (${allRows.length})</button>
          <button type="button" class="mc-tab ${segmentTab === 'B2C' ? 'active' : ''}" data-stl-tab="B2C">일반고객 결제 (${b2cCount})</button>
          <button type="button" class="mc-tab ${segmentTab === 'B2B' ? 'active' : ''}" data-stl-tab="B2B">기관·경로당 정산 (${b2bCount})</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px;">
          <div class="mc-surface" style="padding: 16px;">
            <div style="font-size: 12px; font-weight: 700; color: #64748b;">총 확정 매출</div>
            <div style="font-size: 19px; font-weight: 800; color: #0f172a; margin-top: 4px; font-variant-numeric: tabular-nums;">${kpiGross.toLocaleString()}원</div>
          </div>
          <div class="mc-surface" style="padding: 16px; background: #f0fdf4; border-color: #bbf7d0;">
            <div style="font-size: 12px; font-weight: 700; color: #166534;">면세 (1차 농축수산)</div>
            <div style="font-size: 19px; font-weight: 800; color: #166534; margin-top: 4px; font-variant-numeric: tabular-nums;">${kpiExempt.toLocaleString()}원</div>
          </div>
          <div class="mc-surface" style="padding: 16px; background: #f0f9ff; border-color: #bae6fd;">
            <div style="font-size: 12px; font-weight: 700; color: #075985;">과세 (가공·공산품)</div>
            <div style="font-size: 19px; font-weight: 800; color: #075985; margin-top: 4px; font-variant-numeric: tabular-nums;">${kpiTaxable.toLocaleString()}원</div>
          </div>
          <div class="mc-surface" style="padding: 16px; background: #fffbeb; border-color: #fde68a;">
            <div style="font-size: 12px; font-weight: 700; color: #92400e;">정산 공제 합계</div>
            <div style="font-size: 19px; font-weight: 800; color: #92400e; margin-top: 4px; font-variant-numeric: tabular-nums;">-${kpiDeduction.toLocaleString()}원</div>
          </div>
          <div class="mc-surface" style="padding: 16px; border: 1.5px solid #007749;">
            <div style="font-size: 12px; font-weight: 700; color: #007749;">마트 입금 예정액</div>
            <div style="font-size: 19px; font-weight: 800; color: #007749; margin-top: 4px; font-variant-numeric: tabular-nums;">${kpiMartSettle.toLocaleString()}원</div>
          </div>
        </div>

        <div class="mc-surface">
          <div style="padding: 14px 18px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="font-size: 14px; color: #0f172a;">주문별 결제 · 정산 내역 (${rows.length}건)</strong>
              <span class="mc-pill mc-pill-gray">정정 ${t.adjustment_count || 0}건 반영</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <select id="stl-pay-method" class="erp-input" style="width: 155px;">
                <option value="ALL" ${filterPayMethod === 'ALL' ? 'selected' : ''}>전체 결제수단</option>
                <option value="CARD" ${filterPayMethod === 'CARD' ? 'selected' : ''}>카드 · 간편결제</option>
                <option value="FACILITY_POSTPAY" ${filterPayMethod === 'FACILITY_POSTPAY' ? 'selected' : ''}>기관 월말 후불</option>
                <option value="MUNICIPAL_VOUCHER" ${filterPayMethod === 'MUNICIPAL_VOUCHER' ? 'selected' : ''}>지자체 바우처</option>
                <option value="CASH" ${filterPayMethod === 'CASH' ? 'selected' : ''}>현금</option>
              </select>
              <input id="stl-search" class="erp-input" type="search" style="width: 240px;"
                placeholder="주문번호(261118-0001), 수요처, 결제수단" value="${escapeHtml(keyword)}" />
              <input id="stl-date" class="erp-input" type="date" style="width: 150px;" value="${escapeHtml(filterDate)}" />
              ${(keyword || filterDate || filterPayMethod !== 'ALL') ? `<button type="button" id="stl-reset" class="mc-btn-secondary">초기화</button>` : ''}
            </div>
          </div>
          ${isFiltered ? `
            <div style="padding: 8px 18px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #475569; display: flex; gap: 16px;">
              <span>조회 결과: <b>${rows.length}건</b></span>
              <span>조회 매출 합계: <b>${filteredSales.toLocaleString()}원</b></span>
              <span>조회 정산액 합계: <b style="color: #007749;">${filteredMartSettle.toLocaleString()}원</b></span>
            </div>
          ` : ''}
          <div class="mc-table-wrap">
            <table class="mc-table">
              <thead>
                <tr>
                  <th>주문번호</th>
                  <th>구분</th>
                  <th>수요처 / 기관</th>
                  <th>결제 방법</th>
                  <th>배송일</th>
                  <th style="text-align: right;">면세액</th>
                  <th style="text-align: right;">과세액</th>
                  <th style="text-align: right;">주문 합계</th>
                  <th style="text-align: right;">마트 정산액</th>
                  <th style="text-align: right;">상세</th>
                </tr>
              </thead>
              <tbody>
                ${pageInfo.paged.length === 0 ? `
                  <tr><td colspan="10" style="text-align: center; padding: 40px 16px; color: #64748b;">조건에 맞는 결제 · 정산 내역이 없습니다.</td></tr>
                ` : pageInfo.paged.map(r => {
                  const orderSales = Number(r.exempt_amount || 0) + Number(r.taxable_amount || 0);
                  const custMeta = getCustomerMeta(r);
                  const payMeta = getPayMeta(r);
                  return `
                    <tr class="mc-stl-row" data-order-id="${escapeHtml(r.order_id)}" style="cursor: pointer;">
                      <td><span class="mc-prod-code" title="${escapeHtml(r.order_id)}">${escapeHtml(formatShortOrderNo(r.order_id))}</span></td>
                      <td><span class="mc-pill ${custMeta.pill}">${escapeHtml(custMeta.label)}</span></td>
                      <td><strong style="color: #0f172a;">${escapeHtml(r.buyer_name)}</strong></td>
                      <td><span class="mc-pill ${payMeta.pill}">${escapeHtml(payMeta.label)}</span></td>
                      <td style="white-space: nowrap;">${escapeHtml(r.delivery_date)}</td>
                      <td class="mc-num">${Number(r.exempt_amount || 0).toLocaleString()}원</td>
                      <td class="mc-num">${Number(r.taxable_amount || 0).toLocaleString()}원</td>
                      <td class="mc-num">${orderSales.toLocaleString()}원</td>
                      <td class="mc-num" style="font-weight: 800; color: #007749;">${Number(r.mart_settlement || 0).toLocaleString()}원</td>
                      <td class="mc-stop-prop" style="text-align: right; white-space: nowrap;">
                        <button type="button" class="mc-row-edit-btn btn-stl-detail" data-order-id="${escapeHtml(r.order_id)}">상세보기</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ${renderMartPaginationHtml(pageInfo, 'stl')}
        </div>

        ${detailRow ? `
          <div class="mc-drawer-backdrop" id="mc-stl-backdrop">
            <div class="mc-drawer" style="width: 540px;">
              <div class="mc-drawer-header">
                <div>
                  <h2>결제 · 정산 상세</h2>
                  <div class="mc-prod-code" style="margin-top: 2px;">${escapeHtml(detailRow.order_id)}</div>
                </div>
                <button type="button" class="mc-drawer-close" id="btn-close-stl-drawer">×</button>
              </div>
              <div class="mc-drawer-body">
                <div class="mc-drawer-section">
                  <div class="mc-drawer-section-title">결제 · 정산 요약</div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12.5px;">
                    <div><span style="color: #64748b;">수요처:</span> <strong>${escapeHtml(detailRow.buyer_name)}</strong></div>
                    <div><span style="color: #64748b;">고객 구분:</span> <span class="mc-pill ${detailCustMeta.pill}">${escapeHtml(detailCustMeta.label)}</span></div>
                    <div><span style="color: #64748b;">결제 방법:</span> <span class="mc-pill ${detailPayMeta.pill}">${escapeHtml(detailPayMeta.label)}</span></div>
                    <div><span style="color: #64748b;">정산 방식:</span> <strong>${detailRow.settlement_route === 'PG' ? 'PG 정산' : '직접 정산'}</strong></div>
                    <div><span style="color: #64748b;">배송일:</span> ${escapeHtml(detailRow.delivery_date || '-')}</div>
                    <div><span style="color: #64748b;">정산 공제:</span> <strong style="color: #92400e;">-${Number(detailRow.total_fee ?? 0).toLocaleString()}원</strong></div>
                    <div><span style="color: #64748b;">면세액:</span> <strong>${Number(detailRow.exempt_amount || 0).toLocaleString()}원</strong></div>
                    <div><span style="color: #64748b;">과세액:</span> <strong>${Number(detailRow.taxable_amount || 0).toLocaleString()}원</strong></div>
                    <div><span style="color: #64748b;">주문 합계:</span> <strong>${(Number(detailRow.exempt_amount || 0) + Number(detailRow.taxable_amount || 0)).toLocaleString()}원</strong></div>
                    <div><span style="color: #64748b;">마트 정산액:</span> <strong style="color: #007749;">${Number(detailRow.mart_settlement || 0).toLocaleString()}원</strong></div>
                  </div>
                </div>
                <div class="mc-drawer-section">
                  <div class="mc-drawer-section-title">주문 품목 내역 (${(detailOrder?.items || []).length}건)</div>
                  ${detailOrder && (detailOrder.items || []).length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                      ${(detailOrder.items || []).map(it => {
                        const qty = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 0);
                        return `
                          <div style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f8fafc; font-size: 12.5px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                              <strong>${escapeHtml(it.name)}</strong>
                              <div style="font-size: 11.5px; color: #64748b;">${Number(it.unit_price || 0).toLocaleString()}원 × ${qty}${escapeHtml(it.uom || '개')}${it.adjust_reason ? ` · ${escapeHtml(it.adjust_reason)}` : ''}</div>
                            </div>
                            <strong>${(Number(it.unit_price || 0) * qty).toLocaleString()}원</strong>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  ` : `<div style="font-size: 12.5px; color: #64748b;">연결된 상세 품목 정보가 없습니다.</div>`}
                </div>
              </div>
              <div class="mc-drawer-footer" style="justify-content: space-between;">
                ${detailOrder ? `<button type="button" class="mc-btn-secondary" id="btn-print-stl-detail">전표 · 명세표 출력</button>` : '<span></span>'}
                <button type="button" class="mc-btn-secondary" id="btn-cancel-stl-drawer">닫기</button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    container.querySelectorAll('[data-stl-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        segmentTab = btn.dataset.stlTab || 'ALL';
        currentPage = 1;
        render();
      });
    });
    container.querySelector('#stl-pay-method')?.addEventListener('change', (e) => {
      filterPayMethod = e.target.value || 'ALL';
      currentPage = 1;
      render();
    });
    const searchEl = container.querySelector('#stl-search');
    searchEl?.addEventListener('input', (e) => {
      keyword = e.target.value;
      currentPage = 1;
      const pos = e.target.selectionStart;
      render();
      const next = container.querySelector('#stl-search');
      if (next) {
        next.focus();
        if (typeof pos === 'number') next.setSelectionRange(pos, pos);
      }
    });
    container.querySelector('#stl-date')?.addEventListener('change', (e) => {
      filterDate = e.target.value;
      currentPage = 1;
      render();
    });
    container.querySelector('#stl-reset')?.addEventListener('click', () => {
      filterPayMethod = 'ALL';
      keyword = '';
      filterDate = '';
      currentPage = 1;
      render();
    });
    bindMartPaginationEvents(container, {
      prefix: 'stl',
      totalPages: pageInfo.totalPages,
      onPageChange: (nextP) => { currentPage = nextP; render(); },
      onSizeChange: (nextSz) => { pageSize = nextSz; currentPage = 1; render(); }
    });
    bindStopPropagation(container);
    container.querySelectorAll('.mc-stl-row, .btn-stl-detail').forEach(el => {
      el.addEventListener('click', () => {
        detailOrderId = el.dataset.orderId || '';
        render();
      });
    });
    const closeStlDrawer = () => {
      detailOrderId = '';
      render();
    };
    container.querySelector('#btn-close-stl-drawer')?.addEventListener('click', closeStlDrawer);
    container.querySelector('#btn-cancel-stl-drawer')?.addEventListener('click', closeStlDrawer);
    container.querySelector('#mc-stl-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'mc-stl-backdrop') closeStlDrawer();
    });
    container.querySelector('#btn-print-stl-detail')?.addEventListener('click', () => {
      if (detailOrder) openMartPrintModal(detailOrder, mart);
    });
  }

  render();
}
