/**
 * AITIP Mart Portal - 5. 3자 위탁 정산 & 과면세·보조금 대사 모듈 (ESM)
 * 모던 커머스 어드민 UI: .mc-page-header + 6종 KPI 카드 + .mc-surface 원장 테이블
 */

import { martApi } from '../api.js';

function escapeHtml(v = '') {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderMartSettlementView(container) {
  if (!container) return;
  const data = await martApi.getSettlements();
  const t = data.totals || {};
  const rates = data.rates || {};
  const rows = data.rows || [];

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="mc-page-header">
        <div class="mc-title-wrap">
          <h1>결제 · 위탁 정산 대사</h1>
          <span class="mc-count-pill">${escapeHtml(data.mart?.mart_name || '하나로마트')}</span>
        </div>
        <div style="font-size: 12.5px; color: #64748b;">
          위탁대행 ${rates.agency_fee_pct}% · 플랫폼 ${rates.platform_fee_pct}% · 면세/과세 자동 분리
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;">
        <div class="mc-surface" style="padding: 16px;">
          <div style="font-size: 12px; font-weight: 700; color: #64748b;">총 확정 매출</div>
          <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px; font-variant-numeric: tabular-nums;">${Number(t.gross_sales || 0).toLocaleString()}원</div>
        </div>
        <div class="mc-surface" style="padding: 16px; background: #f0fdf4; border-color: #bbf7d0;">
          <div style="font-size: 12px; font-weight: 700; color: #166534;">면세 (1차 농축수산)</div>
          <div style="font-size: 20px; font-weight: 800; color: #166534; margin-top: 4px; font-variant-numeric: tabular-nums;">${Number(t.exempt_sales || 0).toLocaleString()}원</div>
        </div>
        <div class="mc-surface" style="padding: 16px; background: #f0f9ff; border-color: #bae6fd;">
          <div style="font-size: 12px; font-weight: 700; color: #075985;">과세 (가공·공산품)</div>
          <div style="font-size: 20px; font-weight: 800; color: #075985; margin-top: 4px; font-variant-numeric: tabular-nums;">${Number(t.taxable_sales || 0).toLocaleString()}원</div>
        </div>
        <div class="mc-surface" style="padding: 16px; background: #fffbeb; border-color: #fde68a;">
          <div style="font-size: 12px; font-weight: 700; color: #92400e;">위탁대행 수수료 (${rates.agency_fee_pct}%)</div>
          <div style="font-size: 20px; font-weight: 800; color: #92400e; margin-top: 4px; font-variant-numeric: tabular-nums;">${Number(t.agency_fee_total || 0).toLocaleString()}원</div>
        </div>
        <div class="mc-surface" style="padding: 16px;">
          <div style="font-size: 12px; font-weight: 700; color: #64748b;">플랫폼 수수료 (${rates.platform_fee_pct}%)</div>
          <div style="font-size: 20px; font-weight: 800; color: #334155; margin-top: 4px; font-variant-numeric: tabular-nums;">${Number(t.platform_fee_total || 0).toLocaleString()}원</div>
        </div>
        <div class="mc-surface" style="padding: 16px; border: 1.5px solid #007749;">
          <div style="font-size: 12px; font-weight: 700; color: #007749;">마트 정산 예정액</div>
          <div style="font-size: 20px; font-weight: 800; color: #007749; margin-top: 4px; font-variant-numeric: tabular-nums;">${Number(t.mart_settlement_total || 0).toLocaleString()}원</div>
        </div>
      </div>

      <div class="mc-surface" style="padding: 16px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <strong style="font-size: 13.5px; color: #0f172a;">세금계산서 발행 · 알림톡/문자 과금 대사 요약</strong>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            알림톡·문자 ${Number(t.alimtalk_sms_count || 0).toLocaleString()}건 (${Number(t.alimtalk_sms_fee || 0).toLocaleString()}원) + 위탁·플랫폼 수수료 합산
          </div>
        </div>
        <div style="display: flex; gap: 18px; align-items: center; font-variant-numeric: tabular-nums; font-size: 13px;">
          <span>공급가액 <b>${Number(t.tax_invoice_supply || 0).toLocaleString()}원</b></span>
          <span>부가세(10%) <b>${Number(t.tax_invoice_vat || 0).toLocaleString()}원</b></span>
          <span style="color: #007749; font-weight: 800;">세금계산서 발행 합계 ${Number(t.tax_invoice_total || 0).toLocaleString()}원</span>
        </div>
      </div>

      <div class="mc-surface">
        <div style="padding: 14px 18px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 14px; color: #0f172a;">주문별 3자 정산 원장 (${rows.length}건)</strong>
          <span class="mc-pill mc-pill-gray">DOC-11 정정 ${t.adjustment_count || 0}건 반영</span>
        </div>
        <div class="mc-table-wrap">
          <table class="mc-table">
            <thead>
              <tr>
                <th>정산 원장 UID</th>
                <th>주문 UID</th>
                <th>수요처 / 기관</th>
                <th>배송일</th>
                <th style="text-align: right;">면세액</th>
                <th style="text-align: right;">과세액</th>
                <th style="text-align: right;">위탁대행료</th>
                <th style="text-align: right;">플랫폼료</th>
                <th style="text-align: right;">마트 정산액</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? `
                <tr><td colspan="9" style="text-align: center; padding: 40px 16px; color: #64748b;">정산 내역이 없습니다.</td></tr>
              ` : rows.map(r => `
                <tr>
                  <td><span class="mc-prod-code">${escapeHtml(r.ledger_id)}</span></td>
                  <td><span class="mc-prod-code">${escapeHtml(r.order_id)}</span></td>
                  <td>
                    <strong style="color: #0f172a;">${escapeHtml(r.buyer_name)}</strong>
                    <div class="mc-prod-code">${escapeHtml(r.facility_id)}</div>
                  </td>
                  <td style="white-space: nowrap;">${escapeHtml(r.delivery_date)}</td>
                  <td class="mc-num">${Number(r.exempt_amount).toLocaleString()}원</td>
                  <td class="mc-num">${Number(r.taxable_amount).toLocaleString()}원</td>
                  <td class="mc-num">${Number(r.agency_fee).toLocaleString()}원</td>
                  <td class="mc-num">${Number(r.platform_fee).toLocaleString()}원</td>
                  <td class="mc-num" style="font-weight: 800; color: #007749;">${Number(r.mart_settlement).toLocaleString()}원</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
