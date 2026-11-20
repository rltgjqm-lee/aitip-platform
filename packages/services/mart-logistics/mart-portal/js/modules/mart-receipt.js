/**
 * AITIP Mart Portal - 80mm 피킹·배달 전표 & A4 거래명세표 출력 모달 모듈 (ESM)
 */

function esc(v = '') {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TEMP_KO = { AMBIENT: '상온', REFRIGERATED: '냉장', FROZEN: '냉동' };

export function openMartPrintModal(order, mart = {}, initialMode = 'SLIP_80MM') {
  if (!order) return;
  let mode = initialMode;

  const existing = document.getElementById('mart-print-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'mart-print-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:999;display:flex;justify-content:center;align-items:center;padding:20px;';

  function renderBody() {
    const items = order.items || [];
    const totalAmt = Number(order.total_amount || 0);

    const slip80Html = `
      <div style="width: 320px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; padding: 16px; font-family: monospace; font-size: 12px; color: #0f172a;">
        <div style="text-align: center; font-weight: 800; font-size: 15px; border-bottom: 2px dashed #334155; padding-bottom: 8px; margin-bottom: 10px;">
          [마트 피킹 · 배달 전표]
        </div>
        <div><b>주문번호:</b> ${esc(order.order_id)}</div>
        <div><b>채널/수주:</b> ${order.order_channel === 'ONLINE' ? '온라인 PWA' : `오프라인(${esc(order.offline_source || '수기')})`}</div>
        <div><b>수요처:</b> ${esc(order.buyer_name)}</div>
        <div><b>배송예정:</b> ${esc(order.delivery_date)}</div>
        <hr class="slip-divider" />
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="border-bottom: 1px solid #94a3b8;">
              <th style="text-align: left; padding: 4px 0;">품목(보관)</th>
              <th style="text-align: right; padding: 4px 0;">수량</th>
              <th style="text-align: right; padding: 4px 0;">금액</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => {
              const q = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 1);
              const amt = q * Number(it.unit_price || 0);
              return `
                <tr>
                  <td style="padding: 4px 0;">${esc(it.name)} <small>[${TEMP_KO[it.storage_temp] || '상온'}]</small></td>
                  <td style="text-align: right;">${q}${esc(it.uom || '개')}</td>
                  <td style="text-align: right;">${amt.toLocaleString()}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <hr class="slip-divider" />
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800;">
          <span>합계 금액</span>
          <span>${totalAmt.toLocaleString()}원</span>
        </div>
        ${order.memo ? `<div style="margin-top: 8px; font-size: 11px;">비고: ${esc(order.memo)}</div>` : ''}
      </div>
    `;

    const a4Html = `
      <div style="width: 100%; max-width: 720px; margin: 0 auto; background: #fff; border: 2px solid #1e293b; padding: 24px; font-size: 12.5px; color: #0f172a;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;">거 래 명 세 표 (공급자 보관/제출 겸용)</h2>
          <span style="font-size: 11.5px;">발행일: ${esc(order.delivery_date)} · <code>${esc(order.order_id)}</code></span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
          <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px;">
            <div style="font-weight: 800; margin-bottom: 4px;">공급자 (위탁 운영 마트)</div>
            <div>상호: ${esc(mart.mart_name || '서초농협 하나로마트 양재점')}</div>
            <div>사업자번호: ${esc(mart.biz_number || '214-82-04712')} · 전화: ${esc(mart.phone || '02-578-9000')}</div>
            <div>주소: ${esc(mart.address || '서울특별시 서초구 양재대로 123')}</div>
          </div>
          <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px;">
            <div style="font-weight: 800; margin-bottom: 4px;">공급받는자 (수요처 / 기관)</div>
            <div>수요처명: <strong>${esc(order.buyer_name)}</strong></div>
            <div>기관 UID: <code>${esc(order.facility_id || '-')}</code></div>
            <div>결제구분: ${esc(order.payment_method || '기관후불')}</div>
          </div>
        </div>
        <table class="data-table" style="width: 100%; border: 1px solid #94a3b8; font-size: 12px;">
          <thead>
            <tr>
              <th>No</th>
              <th>품목명</th>
              <th>보관구분</th>
              <th style="text-align: right;">수량</th>
              <th style="text-align: right;">단가</th>
              <th style="text-align: right;">공급가액</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => {
              const q = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 1);
              const up = Number(it.unit_price || 0);
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${esc(it.name)}</strong></td>
                  <td>${TEMP_KO[it.storage_temp] || '상온'}</td>
                  <td style="text-align: right;">${q} ${esc(it.uom || '개')}</td>
                  <td style="text-align: right;">${up.toLocaleString()}원</td>
                  <td style="text-align: right; font-weight: 700;">${(q * up).toLocaleString()}원</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid #cbd5e1;">
          <div style="font-size: 15px; font-weight: 800;">총 합계 금액: ${totalAmt.toLocaleString()}원</div>
          <div style="font-size: 12.5px;">인수자 확인: ____________________ (서명 / 인)</div>
        </div>
      </div>
    `;

    modal.innerHTML = `
      <div style="background: #f8fafc; border-radius: 10px; width: 100%; max-width: 820px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;">
        <div style="padding: 12px 16px; background: #ffffff; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn ${mode === 'SLIP_80MM' ? 'btn-primary' : 'btn-default'} btn-print-tab" data-mode="SLIP_80MM">80mm 피킹·배달 전표</button>
            <button type="button" class="btn ${mode === 'A4_STATEMENT' ? 'btn-primary' : 'btn-default'} btn-print-tab" data-mode="A4_STATEMENT">A4 거래명세표</button>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #334155; cursor: pointer;">
              <input type="checkbox" id="chk-print-2copies" checked /> 2매 출력(매장·고객용)
            </label>
            <button type="button" class="btn btn-primary" id="btn-exec-mart-print">인쇄하기</button>
            <button type="button" class="btn btn-default" id="btn-close-mart-print">닫기</button>
          </div>
        </div>
        <div id="mart-print-area" style="padding: 20px; overflow-y: auto;">
          ${mode === 'SLIP_80MM' ? slip80Html : a4Html}
        </div>
      </div>
    `;

    modal.querySelectorAll('.btn-print-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        renderBody();
      });
    });
    modal.querySelector('#btn-close-mart-print')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#btn-exec-mart-print')?.addEventListener('click', () => {
      const area = modal.querySelector('#mart-print-area')?.innerHTML || '';
      const twoCopies = Boolean(modal.querySelector('#chk-print-2copies')?.checked);
      const htmlBody = twoCopies
        ? `<div><div style="font-size:11px;color:#64748b;margin-bottom:4px;">[1매] 매장 보관용</div>${area}</div><div style="page-break-before:always;margin-top:24px;"><div style="font-size:11px;color:#64748b;margin-bottom:4px;">[2매] 고객·배송 전달용</div>${area}</div>`
        : area;
      const w = window.open('', '_blank', 'width=860,height=720');
      if (!w) return;
      w.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>전표 출력</title><style>body{font-family:sans-serif;padding:16px;} table{border-collapse:collapse;width:100%;} th,td{border-bottom:1px solid #e2e8f0;padding:6px;}</style></head><body>${htmlBody}</body></html>`);
      w.document.close();
      w.focus();
      w.print();
    });
  }

  document.body.appendChild(modal);
  renderBody();
}
