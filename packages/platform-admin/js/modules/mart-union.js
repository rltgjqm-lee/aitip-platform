/**
 * AITIP Super Admin - 마트 연합 · 공동판매/공동구매 · 3자 정산 & PWA 강제 관제 모듈 (ESM)
 */

import { adminApi } from '../admin-api.js';

function esc(v = '') {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderMartUnionView(container) {
  if (!container) return;
  const snap = await adminApi.getMartUnionSnapshot();
  const marts = snap.marts || [];
  const groupBuys = snap.group_buys || [];
  const stl = snap.settlement || {};
  const totals = stl.totals || {};
  const rows = stl.rows || [];
  const pwaCfg = snap.pwa?.config || {};

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="card" style="padding: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h3 style="margin: 0; font-size: 16px;">전국 단위농협 하나로마트 · 일반마트 연합 관제 (DOC-19)</h3>
          <p style="margin: 4px 0 0; font-size: 12.5px; color: #64748b;">참여 마트 입점 현황, 공동구매 달성 관제, 3자 정산/과면세 대사 및 HQ PWA 강제 제어</p>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <select id="hq-mart-pwa-status" style="padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px;">
            <option value="OPEN" ${pwaCfg.store_status === 'OPEN' ? 'selected' : ''}>PWA 정상 영업 (OPEN)</option>
            <option value="PREP_BREAK" ${pwaCfg.store_status === 'PREP_BREAK' ? 'selected' : ''}>당일 주문 일시중지 (PREP_BREAK)</option>
            <option value="CLOSED" ${pwaCfg.store_status === 'CLOSED' ? 'selected' : ''}>전사 긴급 차단 (CLOSED)</option>
          </select>
          <button type="button" class="btn btn-primary" id="btn-hq-mart-pwa-apply">HQ 제어 반영</button>
          <a href="/mart/" target="_blank" class="btn btn-default">마트 포털 열기</a>
          <a href="/mart/pwa/" target="_blank" class="btn btn-default">마트 PWA 열기</a>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px;">
        <div class="card" style="padding: 14px;">
          <div style="font-size: 11.5px; color: #64748b;">참여 마트 수</div>
          <div style="font-size: 18px; font-weight: 800; margin-top: 4px;">${marts.length}개점</div>
        </div>
        <div class="card" style="padding: 14px;">
          <div style="font-size: 11.5px; color: #64748b;">마트 총 확정 매출</div>
          <div style="font-size: 18px; font-weight: 800; margin-top: 4px;">${Number(totals.gross_sales || 0).toLocaleString()}원</div>
        </div>
        <div class="card" style="padding: 14px;">
          <div style="font-size: 11.5px; color: #065f46;">면세 (농축수산)</div>
          <div style="font-size: 18px; font-weight: 800; color: #065f46; margin-top: 4px;">${Number(totals.exempt_sales || 0).toLocaleString()}원</div>
        </div>
        <div class="card" style="padding: 14px;">
          <div style="font-size: 11.5px; color: #92400e;">위탁대행 수수료</div>
          <div style="font-size: 18px; font-weight: 800; color: #92400e; margin-top: 4px;">${Number(totals.agency_fee_total || 0).toLocaleString()}원</div>
        </div>
        <div class="card" style="padding: 14px;">
          <div style="font-size: 11.5px; color: #1e40af;">플랫폼 수수료</div>
          <div style="font-size: 18px; font-weight: 800; color: #1e40af; margin-top: 4px;">${Number(totals.platform_fee_total || 0).toLocaleString()}원</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="card" style="padding: 16px;">
          <h4 style="margin: 0 0 10px;">참여 마트 현황 (단위농협 하나로마트 · 일반마트)</h4>
          <table class="data-table" style="width: 100%; font-size: 12px;">
            <thead>
              <tr><th>마트 UID</th><th>유형</th><th>마트명</th><th>지역</th><th>대행료</th></tr>
            </thead>
            <tbody>
              ${marts.map(m => `
                <tr>
                  <td><code>${esc(m.mart_id)}</code></td>
                  <td><span class="tag">${m.mart_type === 'NH_HANARO' ? '하나로마트' : '일반마트'}</span></td>
                  <td><strong>${esc(m.mart_name)}</strong></td>
                  <td>${esc(m.region)}</td>
                  <td>${m.agency_fee_pct}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="card" style="padding: 16px;">
          <h4 style="margin: 0 0 10px;">전국 공동구매 캠페인 관제 (마트 등록 -> 본부 승인)</h4>
          <table class="data-table" style="width: 100%; font-size: 12px;">
            <thead>
              <tr><th>캠페인</th><th>유형</th><th>달성현황</th><th>승인 · 상태</th><th style="text-align: right;">처리</th></tr>
            </thead>
            <tbody>
              ${groupBuys.map(g => {
                const apv = g.approval_status || 'APPROVED';
                return `
                  <tr>
                    <td><strong>${esc(g.title)}</strong><div><code>${esc(g.campaign_id)}</code></div></td>
                    <td>${g.campaign_type === 'B2B_INSTITUTIONAL' ? '기관 공구' : '주민 공구'}</td>
                    <td>${g.current_qty} / ${g.target_qty}</td>
                    <td><span class="tag">${esc(apv === 'PENDING_ADMIN' ? '승인 대기' : apv === 'REJECTED' ? '반려' : g.status)}</span></td>
                    <td style="text-align: right; white-space: nowrap;">
                      ${apv === 'PENDING_ADMIN' ? `
                        <button type="button" class="btn btn-primary btn-gb-approve" data-cid="${esc(g.campaign_id)}" style="padding: 3px 8px; font-size: 11px;">승인</button>
                        <button type="button" class="btn btn-default btn-gb-reject" data-cid="${esc(g.campaign_id)}" style="padding: 3px 8px; font-size: 11px; color: #b91c1c;">반려</button>
                      ` : '-'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="padding: 16px;">
        <h4 style="margin: 0 0 8px;">전국 공동판매(본부 소싱) 상품 배포 -> 마트 취급 승인 요청</h4>
        <p style="margin: 0 0 10px; font-size: 12px; color: #64748b;">슈퍼관리자가 산지직송/본부 공동판매 상품을 등록하면 마트 포털(1. 상품등록 > 본부 배포 승인대기)로 전달되어 마트 관리자가 취급 승인 후 판매합니다.</p>
        <form id="form-hq-cosell-product" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto; gap: 8px; align-items: end;">
          <div>
            <label style="font-size: 11px; font-weight: 700; display: block; margin-bottom: 3px;">상품명 *</label>
            <input id="cs-name" type="text" required placeholder="예: [본부특산] 완도 활전복 1kg (특대)" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; display: block; margin-bottom: 3px;">규격</label>
            <input id="cs-spec" type="text" placeholder="1kg/박스" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; display: block; margin-bottom: 3px;">공급원가(원)</label>
            <input id="cs-cost" type="number" min="0" value="24000" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; display: block; margin-bottom: 3px;">권장판매가(원) *</label>
            <input id="cs-sale" type="number" min="100" required value="32900" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; display: block; margin-bottom: 3px;">보관온도</label>
            <select id="cs-temp" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px;">
              <option value="REFRIGERATED">냉장</option>
              <option value="AMBIENT">상온</option>
              <option value="FROZEN">냉동</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="height: 32px; white-space: nowrap;">마트에 배포 제안</button>
        </form>
      </div>

      <div class="card" style="padding: 16px;">
        <h4 style="margin: 0 0 10px;">마트 주문별 3자 정산 & 과면세 대사 원장 (${rows.length}건)</h4>
        <table class="data-table" style="width: 100%; font-size: 12px;">
          <thead>
            <tr>
              <th>정산 원장 UID</th>
              <th>수요처 / 기관</th>
              <th style="text-align: right;">면세액</th>
              <th style="text-align: right;">과세액</th>
              <th style="text-align: right;">위탁대행료</th>
              <th style="text-align: right;">플랫폼료</th>
              <th style="text-align: right;">마트 정산액</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><code>${esc(r.ledger_id)}</code></td>
                <td><strong>${esc(r.buyer_name)}</strong><div><code>${esc(r.facility_id)}</code></div></td>
                <td style="text-align: right;">${Number(r.exempt_amount).toLocaleString()}원</td>
                <td style="text-align: right;">${Number(r.taxable_amount).toLocaleString()}원</td>
                <td style="text-align: right;">${Number(r.agency_fee).toLocaleString()}원</td>
                <td style="text-align: right;">${Number(r.platform_fee).toLocaleString()}원</td>
                <td style="text-align: right; font-weight: 800;">${Number(r.mart_settlement).toLocaleString()}원</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#btn-hq-mart-pwa-apply')?.addEventListener('click', async () => {
    const nextStatus = container.querySelector('#hq-mart-pwa-status')?.value;
    await adminApi.updateMartPwaControl({ store_status: nextStatus });
    await renderMartUnionView(container);
  });
  container.querySelectorAll('.btn-gb-approve').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminApi.decideMartGroupBuy({ campaign_id: btn.dataset.cid, decision: 'APPROVED' });
      await renderMartUnionView(container);
    });
  });
  container.querySelectorAll('.btn-gb-reject').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminApi.decideMartGroupBuy({ campaign_id: btn.dataset.cid, decision: 'REJECTED' });
      await renderMartUnionView(container);
    });
  });
  container.querySelector('#form-hq-cosell-product')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sale = Number(container.querySelector('#cs-sale')?.value || 0);
    await adminApi.createMartCoSellProduct({
      name: container.querySelector('#cs-name')?.value?.trim(),
      spec: container.querySelector('#cs-spec')?.value?.trim() || '1박스',
      cost_price: Number(container.querySelector('#cs-cost')?.value || 0),
      regular_price: sale,
      sale_price: sale,
      storage_temp: container.querySelector('#cs-temp')?.value || 'REFRIGERATED'
    });
    alert('마트 관리자에게 전국 공동판매 상품 승인 요청이 전달되었습니다.');
    await renderMartUnionView(container);
  });
}
