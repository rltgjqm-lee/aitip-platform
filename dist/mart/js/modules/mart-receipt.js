/**
 * AITIP Mart Portal - 80mm 피킹·배달 전표 & A4 거래명세표 출력 모달 모듈 (ESM)
 */

import { esc } from '../utils/html.js';

const TEMP_KO = { AMBIENT: '상온', REFRIGERATED: '냉장', FROZEN: '냉동' };
const PAY_KO = {
  CARD: '카드 · 간편결제',
  FACILITY_POSTPAY: '기관 월말 후불',
  MUNICIPAL_VOUCHER: '지자체 바우처',
  CASH: '현금'
};

// 순수 ESM Code 39 1D SVG 바코드 생성기 (영문 대문자 · 숫자 · '-' 지원)
const CODE39_MAP = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw',
  'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn',
  'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww',
  'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn',
  'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw',
  'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn'
};

function renderCode39Svg(raw = '') {
  const clean = String(raw || '').toUpperCase().replace(/[^0-9A-Z\-. ]/g, '-');
  const encoded = `*${clean}*`;
  let x = 4;
  const rects = [];
  for (const ch of encoded) {
    const pat = CODE39_MAP[ch] || CODE39_MAP['-'];
    for (let i = 0; i < 9; i++) {
      const w = pat[i] === 'w' ? 2.4 : 1;
      if (i % 2 === 0) {
        rects.push(`<rect x="${x.toFixed(1)}" y="2" width="${w}" height="34" fill="#0f172a"/>`);
      }
      x += w;
    }
    x += 1.2;
  }
  const totalW = Math.ceil(x + 4);
  return `<svg viewBox="0 0 ${totalW} 38" style="width:100%;max-width:280px;height:38px;display:block;margin:0 auto;" xmlns="http://www.w3.org/2000/svg">${rects.join('')}</svg>`;
}

function isExemptItem(it = {}) {
  if (it.tax_type === 'EXEMPT' || it.tax_type === 'TAX_FREE') return true;
  if (it.tax_type === 'TAXABLE') return false;
  return /(양파|당근|사과|배|감귤|거봉|돼지고기|한돈|한우|삼겹살|오리|계란|달걀|고등어|오징어|두부)/.test(String(it.name || ''));
}

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
    let exemptSum = 0;
    let taxableSum = 0;
    let promoDiscSum = Number(order.promo_discount_total || 0);
    const tempCounts = { AMBIENT: 0, REFRIGERATED: 0, FROZEN: 0 };

    items.forEach(it => {
      const q = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 1);
      const amt = q * Number(it.unit_price || 0);
      if (isExemptItem(it)) exemptSum += amt;
      else taxableSum += amt;
      const t = it.storage_temp || 'AMBIENT';
      if (tempCounts[t] !== undefined && q > 0) tempCounts[t] += 1;
    });

    const totalAmt = Number(order.total_amount || (exemptSum + taxableSum));
    const vatAmt = Math.round(taxableSum / 11);
    const taxableSupply = taxableSum - vatAmt;
    const modeLabel = order.delivery_mode === 'STORE_PICKUP' ? '매장픽업' : '당일배송';

    const slip80Html = `
      <div style="width: 310px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; padding: 14px; font-family: 'Malgun Gothic', monospace; font-size: 11.5px; color: #0f172a; line-height: 1.45;">
        <div style="text-align: center; border-bottom: 2px dashed #334155; padding-bottom: 8px; margin-bottom: 8px;">
          ${mart.receipt_top_notice ? `<div style="font-size: 10.5px; color: #334155; margin-bottom: 4px; font-weight: 600;">${esc(mart.receipt_top_notice)}</div>` : ''}
          <div style="font-weight: 800; font-size: 14.5px;">${esc(mart.mart_name || '서초농협 하나로마트 양재점')}</div>
          <div style="font-size: 10.5px; color: #475569;">사업자: ${esc(mart.biz_number || '214-82-04712')} · TEL: ${esc(mart.phone || '02-578-9000')}</div>
          <div style="font-size: 10.5px; color: #475569;">${esc(mart.address || '서울특별시 서초구 양재대로 123')}</div>
          ${mart.receipt_sub_notice ? `<div style="font-size: 10px; color: #475569; margin-top: 4px; padding-top: 4px; border-top: 1px dotted #cbd5e1;">${esc(mart.receipt_sub_notice)}</div>` : ''}
          <div style="margin-top: 5px; font-weight: 800; font-size: 12.5px; background: #f1f5f9; padding: 3px 6px; border-radius: 4px; display: inline-block;">
            [마트 피킹 · ${modeLabel} 전표]
          </div>
        </div>

        <div style="font-size: 11px;">
          <div><b>주문번호:</b> ${esc(order.order_id)}</div>
          <div><b>수주경로:</b> ${order.order_channel === 'ONLINE' ? '온라인 PWA' : `오프라인(${esc(order.offline_source || '수기')})`}</div>
          <div><b>수 요 처:</b> ${esc(order.buyer_name)}</div>
          <div><b>배송예정:</b> ${esc(order.delivery_date)} · <b>결제:</b> ${esc(PAY_KO[order.payment_method] || order.payment_method || '후불')}</div>
        </div>

        <hr style="border: none; border-top: 1px dashed #94a3b8; margin: 8px 0;" />

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="border-bottom: 1px solid #334155;">
              <th style="text-align: left; padding: 3px 0;">상품명 / 바코드</th>
              <th style="text-align: right; padding: 3px 0;">단가</th>
              <th style="text-align: right; padding: 3px 0;">수량</th>
              <th style="text-align: right; padding: 3px 0;">금액</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => {
              const q = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 1);
              const up = Number(it.unit_price || 0);
              const amt = q * up;
              const exemptMark = isExemptItem(it) ? '*' : '';
              return `
                <tr style="border-bottom: 1px dotted #e2e8f0;">
                  <td style="padding: 4px 0;">
                    <div>${exemptMark}${esc(it.name)} <small>[${TEMP_KO[it.storage_temp] || '상온'}]</small></div>
                    <div style="font-size: 10px; color: #64748b; font-family: monospace;">${esc(it.barcode || it.product_id || '-')}</div>
                  </td>
                  <td style="text-align: right; vertical-align: top; padding-top: 4px;">${up.toLocaleString()}</td>
                  <td style="text-align: right; vertical-align: top; padding-top: 4px;">${q}${esc(it.uom || '개')}</td>
                  <td style="text-align: right; vertical-align: top; padding-top: 4px; font-weight: 700;">${amt.toLocaleString()}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">* 표시 상품은 부가가치세 면세(농·축·수산) 품목입니다.</div>
        <hr style="border: none; border-top: 1px dashed #94a3b8; margin: 8px 0;" />

        <div style="font-size: 11.5px; display: flex; flex-direction: column; gap: 2px;">
          <div style="display: flex; justify-content: space-between;"><span>면세 물품가액</span><span>${exemptSum.toLocaleString()}원</span></div>
          <div style="display: flex; justify-content: space-between;"><span>과세 물품가액</span><span>${taxableSupply.toLocaleString()}원</span></div>
          <div style="display: flex; justify-content: space-between;"><span>부가세 (VAT 10%)</span><span>${vatAmt.toLocaleString()}원</span></div>
          ${promoDiscSum > 0 ? `<div style="display: flex; justify-content: space-between; color: #b91c1c;"><span>행사 할인</span><span>-${promoDiscSum.toLocaleString()}원</span></div>` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; border-top: 1px solid #334155; padding-top: 5px; margin-top: 4px;">
            <span>합계 금액</span>
            <span>${totalAmt.toLocaleString()}원</span>
          </div>
        </div>

        <hr style="border: none; border-top: 1px dashed #94a3b8; margin: 8px 0;" />
        <div style="font-size: 11px; background: #f8fafc; padding: 5px 6px; border-radius: 4px;">
          <b>포장 온도대:</b> 상온 ${tempCounts.AMBIENT}종 · 냉장 ${tempCounts.REFRIGERATED}종 · 냉동 ${tempCounts.FROZEN}종
        </div>
        ${order.memo ? `<div style="margin-top: 5px; font-size: 11px;"><b>비고:</b> ${esc(order.memo)}</div>` : ''}
        <div style="margin-top: 8px; font-size: 11px; display: flex; justify-content: space-between;">
          <span>인수자 확인:</span>
          <span>________________ (서명)</span>
        </div>

        <div style="margin-top: 10px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
          ${mart.receipt_bottom_notice ? `<div style="font-size: 10px; color: #334155; margin-bottom: 6px; line-height: 1.35;">${esc(mart.receipt_bottom_notice)}</div>` : ''}
          ${renderCode39Svg(order.order_id)}
          <div style="font-size: 10px; font-family: monospace; color: #475569; margin-top: 2px;">${esc(order.order_id)}</div>
        </div>
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
            <div>결제구분: ${esc(PAY_KO[order.payment_method] || order.payment_method || '기관후불')}</div>
          </div>
        </div>
        <table class="data-table" style="width: 100%; border: 1px solid #94a3b8; font-size: 12px;">
          <thead>
            <tr>
              <th>No</th>
              <th>바코드/SKU</th>
              <th>품목명</th>
              <th>과면세 · 보관</th>
              <th style="text-align: right;">수량</th>
              <th style="text-align: right;">단가</th>
              <th style="text-align: right;">금액</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => {
              const q = it.actual_qty !== undefined ? Number(it.actual_qty) : Number(it.qty || 1);
              const up = Number(it.unit_price || 0);
              const ex = isExemptItem(it);
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><code style="font-size:11px;">${esc(it.barcode || it.product_id || '-')}</code></td>
                  <td><strong>${esc(it.name)}</strong></td>
                  <td>${ex ? '면세' : '과세'} · ${TEMP_KO[it.storage_temp] || '상온'}</td>
                  <td style="text-align: right;">${q} ${esc(it.uom || '개')}</td>
                  <td style="text-align: right;">${up.toLocaleString()}원</td>
                  <td style="text-align: right; font-weight: 700;">${(q * up).toLocaleString()}원</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid #cbd5e1;">
          <div style="font-size: 12.5px;">
            면세: <b>${exemptSum.toLocaleString()}원</b> · 과세공급가: <b>${taxableSupply.toLocaleString()}원</b> · 부가세: <b>${vatAmt.toLocaleString()}원</b>
            <div style="font-size: 15px; font-weight: 800; margin-top: 4px;">총 합계 금액: ${totalAmt.toLocaleString()}원</div>
          </div>
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
      const pageRule = mode === 'SLIP_80MM' ? '@page { size: 80mm auto; margin: 3mm; }' : '@page { size: A4 portrait; margin: 12mm; }';
      const w = window.open('', '_blank', 'width=860,height=720');
      if (!w) return;
      w.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>전표 출력</title><style>${pageRule} body{font-family:sans-serif;padding:8px;margin:0;} table{border-collapse:collapse;width:100%;} th,td{border-bottom:1px solid #e2e8f0;padding:4px 2px;}</style></head><body>${htmlBody}</body></html>`);
      w.document.close();
      w.focus();
      w.print();
    });
  }

  document.body.appendChild(modal);
  renderBody();
}
