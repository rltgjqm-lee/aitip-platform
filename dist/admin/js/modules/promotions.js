/**
 * AITIP Platform Admin - 3주체 통합 프로모션 & 승인 큐 (ESM)
 * 1. 본사 프로모션 (PLATFORM 100%)
 * 2. 제휴사 · 영업조직 공동 행사 (ALLIANCE · cost_split 분담 + REQUESTED -> APPROVED 승인 큐)
 * 3. 가맹점 자체 행사 현황 (MERCHANT 100% · 읽기 전용 모니터링)
 */

import { adminApi } from '../admin-api.js';

let activePromoTab = 'PLATFORM'; // 'PLATFORM' | 'ALLIANCE' | 'MERCHANT'

function formatCostSplit(cs) {
  const s = cs || { platform: 100, alliance: 0, merchant: 0 };
  return `본사 ${s.platform || 0}% / 제휴 ${s.alliance || 0}% / 가맹 ${s.merchant || 0}%`;
}

export async function renderPromotionsView(container) {
  if (!container) return;
  const res = await adminApi.getPromotions();
  const banners = res.banners || [];
  const platformCoupons = (res.platform_coupons || []).filter(c => c.issuer_type !== 'ALLIANCE');
  const allianceCoupons = (res.platform_coupons || []).filter(c => c.issuer_type === 'ALLIANCE');
  const merchantCoupons = res.merchant_coupons || [];
  const promoRequests = res.promo_requests || [];
  const alliances = res.alliances || [];
  const pendingReqCnt = promoRequests.filter(r => r.status === 'REQUESTED').length;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- 3주체 분리 탭 바 -->
      <div class="panel-card" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="header-btn promo-tab-btn ${activePromoTab === 'PLATFORM' ? 'header-btn-primary' : ''}" data-tab="PLATFORM" style="font-size: 12px; font-weight: 700;">
            본사 프로모션 (PLATFORM · ${platformCoupons.length})
          </button>
          <button type="button" class="header-btn promo-tab-btn ${activePromoTab === 'ALLIANCE' ? 'header-btn-primary' : ''}" data-tab="ALLIANCE" style="font-size: 12px; font-weight: 700;">
            제휴사·영업조직 행사 & 승인 큐 (${allianceCoupons.length} · 대기 ${pendingReqCnt})
          </button>
          <button type="button" class="header-btn promo-tab-btn ${activePromoTab === 'MERCHANT' ? 'header-btn-primary' : ''}" data-tab="MERCHANT" style="font-size: 12px; font-weight: 700;">
            가맹점 자체 행사 현황 (MERCHANT · ${merchantCoupons.length})
          </button>
        </div>
        <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 700;">부담 주체 분리 정산 규격 적용</span>
      </div>

      ${activePromoTab === 'PLATFORM' ? renderPlatformTabHtml(banners, platformCoupons) : ''}
      ${activePromoTab === 'ALLIANCE' ? renderAllianceTabHtml(allianceCoupons, promoRequests, alliances) : ''}
      ${activePromoTab === 'MERCHANT' ? renderMerchantTabHtml(merchantCoupons) : ''}
    </div>
  `;

  container.querySelectorAll('.promo-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activePromoTab = btn.dataset.tab;
      renderPromotionsView(container);
    });
  });

  // 1. 본사 배너/쿠폰 이벤트
  container.querySelector('#form-banner-create')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await adminApi.savePromotion({
      kind: 'BANNER_CREATE',
      issuer_type: 'PLATFORM',
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
      issuer_type: 'PLATFORM',
      platform_share: 100,
      alliance_share: 0,
      merchant_share: 0,
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

  container.querySelectorAll('.btn-toggle-coupon').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminApi.savePromotion({ kind: 'COUPON_TOGGLE', id: btn.getAttribute('data-id') });
      await renderPromotionsView(container);
    });
  });

  // 2. 제휴사 공동 행사 & 승인 큐 이벤트
  container.querySelector('#form-alliance-coupon')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await adminApi.savePromotion({
      kind: 'COUPON_CREATE',
      issuer_type: 'ALLIANCE',
      alliance_name: container.querySelector('#al-name')?.value,
      name: container.querySelector('#al-title')?.value,
      discount_amount: Number(container.querySelector('#al-discount')?.value || 1500),
      min_order_amount: Number(container.querySelector('#al-min')?.value || 12000),
      platform_share: Number(container.querySelector('#al-p-share')?.value || 50),
      alliance_share: Number(container.querySelector('#al-a-share')?.value || 50),
      merchant_share: Number(container.querySelector('#al-m-share')?.value || 0),
      valid_until: '2026-12-31'
    });
    await renderPromotionsView(container);
  });

  container.querySelectorAll('.btn-decide-promo-req').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminApi.savePromotion({
        kind: 'PROMO_REQUEST_DECIDE',
        id: btn.dataset.id,
        decision: btn.dataset.decision
      });
      await renderPromotionsView(container);
    });
  });
}

function renderPlatformTabHtml(banners, platformCoupons) {
  return `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div class="panel-card" style="padding: 18px;">
        <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 12px;">소비자 PWA 배너 · 긴급 공지 등록 (본사 100%)</div>
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
        <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 12px;">본사 전사 플랫폼 쿠폰 발급 (본사 100% 부담)</div>
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
            <button type="submit" class="header-btn" style="background: #059669; color: #ffffff; padding: 7px 14px; font-weight: 700;">본사 쿠폰 발행</button>
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
      <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 10px;">본사 전사 쿠폰 원장 (${platformCoupons.length}건)</div>
      ${renderPlatformCouponsTableHtml(platformCoupons)}
    </div>
  `;
}

function renderAllianceTabHtml(allianceCoupons, promoRequests, alliances) {
  return `
    <div class="panel-card" style="padding: 16px;">
      <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 10px;">영업조직 · 제휴사 행사 승인 대기 큐 (${promoRequests.length}건)</div>
      <table class="admin-table" style="font-size: 12.5px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th>요청 조직</th>
            <th>행사명</th>
            <th style="text-align: right;">할인액</th>
            <th>비용 분담 비율</th>
            <th style="text-align: center;">상태</th>
            <th style="text-align: center;">승인 제어</th>
          </tr>
        </thead>
        <tbody>
          ${promoRequests.length === 0 ? '<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">승인 대기 중인 행사가 없습니다.</td></tr>' : promoRequests.map(r => `
            <tr>
              <td style="font-weight: 700;">${r.requester_name} <span style="font-size: 11px; color: var(--text-muted);">(${r.requester_role})</span></td>
              <td style="font-weight: 700;">${r.title}</td>
              <td style="text-align: right;">${Number(r.discount_amount || 0).toLocaleString()}원</td>
              <td>${formatCostSplit(r.cost_split)}</td>
              <td style="text-align: center;">
                <span class="badge-status ${r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'}">${r.status}</span>
              </td>
              <td style="text-align: center; white-space: nowrap;">
                ${r.status === 'REQUESTED' ? `
                  <button type="button" class="header-btn btn-decide-promo-req" data-id="${r.id}" data-decision="APPROVED" style="background: #059669; color: #ffffff; padding: 4px 10px; font-size: 11px; margin-right: 4px;">승인·게시</button>
                  <button type="button" class="header-btn btn-decide-promo-req" data-id="${r.id}" data-decision="REJECTED" style="padding: 4px 10px; font-size: 11px;">반려</button>
                ` : '-'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="panel-card" style="padding: 18px;">
      <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 12px;">제휴사 공동 프로모션 직접 등록 (분담률 지정)</div>
      <form id="form-alliance-coupon" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; align-items: end;">
        <div>
          <label style="font-size: 11px; font-weight: 700;">제휴사명</label>
          <input id="al-name" type="text" list="ally-datalist" placeholder="예: NH농협 제로페이" required style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 12px;" />
          <datalist id="ally-datalist">${alliances.map(a => `<option value="${a.name}">`).join('')}</datalist>
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700;">행사 쿠폰명</label>
          <input id="al-title" type="text" required placeholder="예: 제휴 1,500원 할인" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 12px;" />
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700;">할인액 (원)</label>
          <input id="al-discount" type="number" value="1500" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 12px;" />
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700;">최소 주문액</label>
          <input id="al-min" type="number" value="12000" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 12px;" />
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700;">본사 부담 (%)</label>
          <input id="al-p-share" type="number" value="50" min="0" max="100" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 12px;" />
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700;">제휴 부담 (%)</label>
          <input id="al-a-share" type="number" value="50" min="0" max="100" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 12px;" />
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700;">가맹 부담 (%)</label>
          <input id="al-m-share" type="number" value="0" min="0" max="100" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 12px;" />
        </div>
        <div>
          <button type="submit" class="header-btn" style="width: 100%; background: #0f172a; color: #ffffff; padding: 7px 12px; font-size: 12px; font-weight: 700;">공동 행사 등록</button>
        </div>
      </form>
    </div>

    <div class="panel-card" style="padding: 16px;">
      <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 10px;">활성 제휴사 공동 행사 목록 (${allianceCoupons.length}건)</div>
      ${renderPlatformCouponsTableHtml(allianceCoupons)}
    </div>
  `;
}

function renderMerchantTabHtml(merchantCoupons) {
  return `
    <div class="panel-card" style="padding: 16px;">
      <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 4px;">가맹점 자체 행사 모니터링 (${merchantCoupons.length}건 · 가맹점 100% 부담)</div>
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
        점주가 가맹점 포털에서 직접 발행한 매장 쿠폰입니다. 본사/제휴사 정산 풀에서 차감되지 않습니다.
      </div>
      <table class="admin-table" style="font-size: 12.5px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th>쿠폰 ID</th>
            <th>가맹점명</th>
            <th>쿠폰명</th>
            <th style="text-align: right;">할인액</th>
            <th style="text-align: right;">최소 주문액</th>
            <th>부담 주체</th>
            <th>만료일</th>
          </tr>
        </thead>
        <tbody>
          ${merchantCoupons.length === 0 ? '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">등록된 가맹점 자체 쿠폰이 없습니다.</td></tr>' : merchantCoupons.map(c => `
            <tr>
              <td><code>${c.coupon_id || c.id || '-'}</code></td>
              <td style="font-weight: 700;">${c.store_name || '가맹점'}</td>
              <td style="font-weight: 700;">${c.name}</td>
              <td style="text-align: right;">${Number(c.discount_amount || 0).toLocaleString()}원</td>
              <td style="text-align: right;">${Number(c.min_order_amount || 0).toLocaleString()}원</td>
              <td><span class="badge-status default">가맹점 100%</span></td>
              <td>${c.valid_until || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPlatformCouponsTableHtml(list) {
  return `
    <table class="admin-table" style="font-size: 12.5px;">
      <thead>
        <tr style="background: #f8fafc;">
          <th>ID</th>
          <th>주체 / 제휴사</th>
          <th>쿠폰명</th>
          <th style="text-align: right;">할인액</th>
          <th style="text-align: right;">최소 주문액</th>
          <th>비용 분담</th>
          <th style="text-align: center;">상태</th>
          <th style="text-align: center;">제어</th>
        </tr>
      </thead>
      <tbody>
        ${list.length === 0 ? '<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-muted);">등록된 쿠폰이 없습니다.</td></tr>' : list.map(c => `
          <tr>
            <td><code>${c.id}</code></td>
            <td><span class="badge-status ${c.issuer_type === 'ALLIANCE' ? 'warning' : 'success'}">${c.alliance_name || c.issuer_type}</span></td>
            <td style="font-weight: 700;">${c.name}</td>
            <td style="text-align: right;">${Number(c.discount_amount || 0).toLocaleString()}원</td>
            <td style="text-align: right;">${Number(c.min_order_amount || 0).toLocaleString()}원</td>
            <td>${formatCostSplit(c.cost_split)}</td>
            <td style="text-align: center;">
              <span class="badge-status ${c.status === 'ACTIVE' ? 'success' : 'default'}">${c.status === 'ACTIVE' ? '활성' : '중지'}</span>
            </td>
            <td style="text-align: center;">
              <button type="button" class="header-btn btn-toggle-coupon" data-id="${c.id}" style="padding: 4px 10px; font-size: 11.5px;">${c.status === 'ACTIVE' ? '중지' : '활성화'}</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
