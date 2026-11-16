/**
 * AITIP Platform Admin - 배너·공지 & 플랫폼 쿠폰 관리 (ESM)
 */

import { adminApi } from '../admin-api.js';

export async function renderPromotionsView(container) {
  if (!container) return;
  const res = await adminApi.getPromotions();
  const banners = res.banners || [];
  const coupons = res.coupons || [];

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="panel-card" style="padding: 18px;">
          <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 12px;">소비자 PWA 배너 · 긴급 공지 등록</div>
          <form id="form-banner-create" style="display: flex; flex-direction: column; gap: 10px;">
            <div>
              <label style="font-size: 11.5px; font-weight: 700;">배너/공지 문구</label>
              <input id="bnr-title" type="text" placeholder="예: 주말 배달비 1,500원 즉시 할인 이벤트" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;" required />
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div>
                <label style="font-size: 11.5px; font-weight: 700;">노출 위치</label>
                <select id="bnr-placement" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;">
                  <option value="HOME_TOP">홈 상단 배너</option>
                  <option value="NOTICE_BAR">상단 공지 띠</option>
                </select>
              </div>
              <div>
                <label style="font-size: 11.5px; font-weight: 700;">노출 기간</label>
                <input id="bnr-period" type="text" value="상시 노출" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end;">
              <button type="submit" class="header-btn" style="background: #0f172a; color: #ffffff; padding: 7px 14px; font-weight: 700;">배너 등록</button>
            </div>
          </form>
        </div>

        <div class="panel-card" style="padding: 18px;">
          <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 12px;">전사 플랫폼 쿠폰 발급</div>
          <form id="form-coupon-create" style="display: flex; flex-direction: column; gap: 10px;">
            <div>
              <label style="font-size: 11.5px; font-weight: 700;">쿠폰명</label>
              <input id="cpn-name" type="text" placeholder="예: 상생 플랫폼 2,000원 할인 쿠폰" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;" required />
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
              <div>
                <label style="font-size: 11.5px; font-weight: 700;">할인액 (원)</label>
                <input id="cpn-discount" type="number" value="2000" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
              </div>
              <div>
                <label style="font-size: 11.5px; font-weight: 700;">최소 주문액</label>
                <input id="cpn-min" type="number" value="15000" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
              </div>
              <div>
                <label style="font-size: 11.5px; font-weight: 700;">만료일</label>
                <input id="cpn-until" type="text" value="2026-12-31" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end;">
              <button type="submit" class="header-btn" style="background: #059669; color: #ffffff; padding: 7px 14px; font-weight: 700;">쿠폰 발행</button>
            </div>
          </form>
        </div>
      </div>

      <div class="panel-card" style="padding: 16px;">
        <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 10px;">활성 배너 · 공지 목록 (${banners.length}건)</div>
        <table class="admin-table" style="font-size: 12.5px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th>ID</th>
              <th>노출 위치</th>
              <th>제목</th>
              <th>기간</th>
              <th style="text-align: center;">상태</th>
              <th style="text-align: center;">제어</th>
            </tr>
          </thead>
          <tbody>
            ${banners.map(b => `
              <tr>
                <td><code>${b.id}</code></td>
                <td><span class="badge-status default">${b.placement}</span></td>
                <td style="font-weight: 700;">${b.title}</td>
                <td>${b.period}</td>
                <td style="text-align: center;">
                  <span class="badge-status ${b.active ? 'success' : 'default'}">${b.active ? '노출중' : '중지'}</span>
                </td>
                <td style="text-align: center;">
                  <button type="button" class="header-btn btn-toggle-banner" data-id="${b.id}" style="padding: 4px 10px; font-size: 11.5px;">${b.active ? '중지' : '노출'}</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="panel-card" style="padding: 16px;">
        <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 10px;">발급 쿠폰 원장 (${coupons.length}건)</div>
        <table class="admin-table" style="font-size: 12.5px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th>쿠폰 ID</th>
              <th>쿠폰명</th>
              <th style="text-align: right;">할인액</th>
              <th style="text-align: right;">최소 주문액</th>
              <th>만료일</th>
            </tr>
          </thead>
          <tbody>
            ${coupons.length === 0 ? '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">등록된 쿠폰이 없습니다.</td></tr>' : coupons.map(c => `
              <tr>
                <td><code>${c.coupon_id || c.id || '-'}</code></td>
                <td style="font-weight: 700;">${c.name}</td>
                <td style="text-align: right;">${Number(c.discount_amount || 0).toLocaleString()}원</td>
                <td style="text-align: right;">${Number(c.min_order_amount || 0).toLocaleString()}원</td>
                <td>${c.valid_until || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#form-banner-create')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await adminApi.savePromotion({
      kind: 'BANNER_CREATE',
      title: container.querySelector('#bnr-title')?.value,
      placement: container.querySelector('#bnr-placement')?.value,
      period: container.querySelector('#bnr-period')?.value
    });
    await renderPromotionsView(container);
  });

  container.querySelector('#form-coupon-create')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await adminApi.savePromotion({
      kind: 'COUPON_CREATE',
      name: container.querySelector('#cpn-name')?.value,
      discount_amount: Number(container.querySelector('#cpn-discount')?.value || 2000),
      min_order_amount: Number(container.querySelector('#cpn-min')?.value || 15000),
      valid_until: container.querySelector('#cpn-until')?.value
    });
    await renderPromotionsView(container);
  });

  container.querySelectorAll('.btn-toggle-banner').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminApi.savePromotion({ kind: 'BANNER_TOGGLE', id: btn.getAttribute('data-id') });
      await renderPromotionsView(container);
    });
  });
}
