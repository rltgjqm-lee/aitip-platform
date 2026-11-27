/**
 * AITIP Mart Portal - 6. PWA 6대 블록 디스플레이 제어 & 공동판매/공동구매 모듈 (ESM)
 * 모던 커머스 어드민 UI: 좌측 설정 카드 + 우측 고정 실시간 모바일/디바이스 미리보기
 */

import { martApi } from '../api.js';
import { escapeHtml, showToast } from '../utils/html.js';
import {
  DAY_ITEMS,
  LAYOUT_LABEL,
  TARGET_TAB_LABEL,
  formatScheduleSummary,
  getBlockScheduleStatus,
  buildPromoFieldBadges
} from '/core/shared/mart-promo-display.js';

let previewDevice = 'MOBILE'; // 'MOBILE' (375px) | 'TABLET' (768px) | 'PC' (1200px)
let previewTab = 'SHOP'; // 'SHOP' | 'FLYER'
let editingBlockId = '';
let promoBuilderOpen = false;
let editingCustomBlockId = '';
let gbDrawerOpen = false;
let shelfSearchQuery = '';
let draftFeaturedIds = []; // ordered array of product IDs
let draftShelfOverrides = {}; // { [pid]: { shelf_price } }
const SHELF_BLOCK_IDS = new Set(['PROMO_SHELF', 'CURATED_SHELF']);

export async function renderMartPwaControlView(container, opts = {}) {
  if (!container) return;
  const [pwaData, martsRes, gbRes, catRes] = await Promise.all([
    martApi.getPwaConfig(),
    martApi.getMarts(),
    martApi.getGroupBuys(),
    martApi.getCatalog()
  ]);

  const cfg = pwaData.config || {};
  const blocks = (cfg.blocks || []).slice().sort((a, b) => Number(a.order) - Number(b.order));
  const marts = martsRes.marts || [];
  const groupBuys = gbRes.group_buys || [];
  const allProducts = (catRes.products || []).filter(p => p.online_publish_status !== 'SUSPENDED');
  const promotions = catRes.promotions || [];
  const promoMap = new Map(promotions.map(pr => [pr.id, pr]));
  const editingBlock = editingBlockId ? blocks.find(b => b.id === editingBlockId) : null;
  const editingCustomBlock = editingCustomBlockId ? blocks.find(b => b.id === editingCustomBlockId) : null;
  const today = new Date().toISOString().slice(0, 10);
  const sq = shelfSearchQuery.trim().toLowerCase();
  const filteredProducts = allProducts.filter(p => !sq || `${p.name} ${p.barcode} ${p.spec}`.toLowerCase().includes(sq));
  const isSidePreview = previewDevice === 'MOBILE';

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="mc-page-header">
        <div class="mc-title-wrap">
          <h1>PWA · 태블릿 · PC 진열</h1>
          <span class="mc-count-pill">${cfg.store_status || 'OPEN'}</span>
        </div>
        <div class="mc-header-actions">
          <a href="/mart/pwa/" target="_blank" class="mc-btn-secondary" style="display: inline-flex; align-items: center; text-decoration: none;">새 창으로 열기</a>
          <button type="button" class="mc-btn-primary" id="btn-save-pwa-ctrl">저장 및 즉시 반영</button>
        </div>
      </div>

      <div id="pwa-layout-grid" style="display: grid; grid-template-columns: ${isSidePreview ? 'minmax(0, 1fr) 415px' : '1fr'}; gap: 18px; align-items: start;">
        <!-- 좌측: 제어 카드 스택 -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="mc-surface" style="padding: 18px;">
            <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 14px;">1. 영업 · 마감 · 결제망 분리 정책</div>
            <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;">
              <div>
                <label class="erp-field-label">매장 영업 상태</label>
                <select id="pwa-store-status" class="erp-input">
                  <option value="OPEN" ${cfg.store_status === 'OPEN' ? 'selected' : ''}>OPEN (정상 접수)</option>
                  <option value="PREP_BREAK" ${cfg.store_status === 'PREP_BREAK' ? 'selected' : ''}>PREP_BREAK (예약만)</option>
                  <option value="CLOSED" ${cfg.store_status === 'CLOSED' ? 'selected' : ''}>CLOSED (영업 종료)</option>
                </select>
              </div>
              <div>
                <label class="erp-field-label">당일 배송 마감</label>
                <input type="time" id="pwa-cutoff-time" value="${escapeHtml(cfg.cutoff_time || '14:00')}" class="erp-input" />
              </div>
              <div>
                <label class="erp-field-label">POS_ONLY 노출</label>
                <select id="pwa-pos-policy" class="erp-input">
                  <option value="BADGE_ONLY" ${cfg.pos_only_policy === 'BADGE_ONLY' ? 'selected' : ''}>현장가 배지 (담기 차단)</option>
                  <option value="HIDE" ${cfg.pos_only_policy === 'HIDE' ? 'selected' : ''}>온라인 몰 숨김</option>
                </select>
              </div>
            </div>
            <div style="margin-top: 12px;">
              <label class="erp-field-label">상단 긴급/안내 공지 문구</label>
              <input type="text" id="pwa-notice-text" value="${escapeHtml(cfg.notice_text || '')}" class="erp-input" placeholder="예: 오늘 오후 2시 이전 주문 시 당일 직배송됩니다." />
            </div>
          </div>

          <div class="mc-surface">
            <div style="padding: 16px 18px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div>
                <span style="font-size: 14px; font-weight: 800; color: #0f172a;">2. 홈 · 전단 디스플레이 블록 조립</span>
                <span style="font-size: 12px; color: #64748b; margin-left: 8px;">순서 숫자가 작을수록 상단에 노출 · 행사 매대는 기간·요일 조건으로 자동 노출</span>
              </div>
              <button type="button" class="mc-btn-primary" id="btn-open-promo-builder" style="height: 30px; padding: 0 12px; font-size: 12px;">+ 행사 매대 조립 추가</button>
            </div>
            <div class="mc-table-wrap">
              <table class="mc-table">
                <thead>
                  <tr>
                    <th style="width: 68px;">순서</th>
                    <th style="width: 52px; text-align: center;">노출</th>
                    <th>블록 · 스케줄 · 현장 조건</th>
                    <th>노출 섹션 제목</th>
                    <th style="text-align: right;">관리 · 진열</th>
                  </tr>
                </thead>
                <tbody>
                  ${blocks.map(b => {
                    const fIds = Array.isArray(b.featured_product_ids) ? b.featured_product_ids : [];
                    const isCustom = b.block_type === 'CUSTOM_PROMO_SHELF';
                    const isShelf = SHELF_BLOCK_IDS.has(b.id) || isCustom;
                    const linkedPromo = b.linked_promo_id ? promoMap.get(b.linked_promo_id) : null;
                    const sched = isCustom ? getBlockScheduleStatus(b, linkedPromo) : null;
                    const fieldBadges = isCustom ? buildPromoFieldBadges(linkedPromo) : [];
                    const autoPromoCount = linkedPromo ? allProducts.filter(p => p.applied_promo_id === linkedPromo.id).length : 0;
                    const effectiveProdCount = fIds.length > 0 ? fIds.length : autoPromoCount;
                    return `
                    <tr class="pwa-block-row" data-block-id="${escapeHtml(b.id)}">
                      <td><input type="number" class="blk-order erp-input" value="${b.order}" min="1" max="50" style="width: 58px; height: 32px; text-align: center;" /></td>
                      <td style="text-align: center;"><input type="checkbox" class="blk-enabled" ${b.enabled ? 'checked' : ''} /></td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                          <span class="mc-pill ${isCustom ? 'mc-pill-green' : 'mc-pill-gray'}">${isCustom ? (LAYOUT_LABEL[b.layout] || '행사 매대') : escapeHtml(b.id)}</span>
                          ${isCustom && sched ? `<span class="mc-pill ${sched.active ? 'mc-pill-green' : sched.code === 'SCHEDULED' ? 'mc-pill-blue' : 'mc-pill-amber'}">${escapeHtml(sched.label)}</span>` : ''}
                          ${isCustom ? `<span class="mc-pill mc-pill-gray">${escapeHtml(TARGET_TAB_LABEL[b.target_tab] || '장보기 홈')}</span>` : ''}
                          ${isCustom && effectiveProdCount === 0 ? `<span class="mc-pill mc-pill-amber">상품 0개 · 미노출</span>` : ''}
                        </div>
                        ${isCustom ? `
                          <div style="font-size: 11px; color: #475569; margin-top: 4px;">
                            스케줄: <b>${escapeHtml(formatScheduleSummary(b))}</b>${linkedPromo ? ` · 행사: ${escapeHtml(linkedPromo.name)}` : ''}
                          </div>
                          ${fieldBadges.length > 0 ? `
                            <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 3px;">
                              ${fieldBadges.map(fb => `<span class="mc-pill mc-pill-${fb.tone === 'red' ? 'red' : fb.tone === 'amber' ? 'amber' : fb.tone === 'green' ? 'green' : 'gray'}" style="font-size: 10.5px;">${escapeHtml(fb.text)}</span>`).join('')}
                            </div>
                          ` : ''}
                        ` : ''}
                      </td>
                      <td><input type="text" class="blk-title erp-input" value="${escapeHtml(b.title)}" style="height: 32px;" /></td>
                      <td style="text-align: right; white-space: nowrap;">
                        ${isCustom ? `<button type="button" class="mc-row-edit-btn btn-edit-custom-block" data-block-id="${escapeHtml(b.id)}" style="margin-right: 4px;">스케줄·설정</button>` : ''}
                        ${isShelf ? `
                          <button type="button" class="mc-row-edit-btn btn-pick-shelf-prods" data-block-id="${escapeHtml(b.id)}">
                            ${fIds.length > 0 ? `지정 ${fIds.length}개` : (linkedPromo ? `행사상품 자동 (${autoPromoCount}개)` : '진열 상품 선택')}
                          </button>
                        ` : '<span style="font-size: 11.5px; color: #94a3b8;">자동</span>'}
                        ${isCustom ? `<button type="button" class="mc-row-edit-btn btn-del-custom-block" data-block-id="${escapeHtml(b.id)}" style="margin-left: 4px; color: #b91c1c; border-color: #fecaca;">삭제</button>` : ''}
                      </td>
                    </tr>
                  `;}).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="mc-surface" style="padding: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap;">
              <div style="font-size: 14px; font-weight: 800; color: #0f172a;">
                3. 참여 마트 연합 (${marts.length}개점) & 공동구매 (${groupBuys.length}건)
              </div>
              <button type="button" class="mc-btn-primary" id="btn-open-gb-drawer" style="height: 30px; padding: 0 12px; font-size: 12px;">+ 공동구매 등록</button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 12.5px;">
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="font-weight: 700; color: #475569;">참여 마트</div>
                ${marts.map(m => `
                  <div style="padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f8fafc;">
                    <span class="mc-pill ${m.mart_type === 'NH_HANARO' ? 'mc-pill-green' : 'mc-pill-blue'}">${m.mart_type === 'NH_HANARO' ? '하나로마트' : '일반마트'}</span>
                    <strong style="margin-left: 6px; color: #0f172a;">${escapeHtml(m.mart_name)}</strong>
                    <div style="color: #64748b; font-size: 11.5px; margin-top: 4px;"><code>${escapeHtml(m.mart_id)}</code> · ${escapeHtml(m.region)}</div>
                  </div>
                `).join('')}
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="font-weight: 700; color: #475569;">진행 중 · 승인대기 공동구매 캠페인</div>
                ${groupBuys.map(g => {
                  const pct = Math.min(100, Math.round((g.current_qty / g.target_qty) * 100));
                  const apv = g.approval_status || 'APPROVED';
                  const apvBadge = apv === 'PENDING_ADMIN'
                    ? '<span class="mc-pill mc-pill-gray">슈퍼관리자 승인대기</span>'
                    : apv === 'REJECTED'
                      ? '<span class="mc-pill mc-pill-red">반려</span>'
                      : '<span class="mc-pill mc-pill-green">승인 · 노출중</span>';
                  return `
                    <div style="padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f8fafc;">
                      <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px;">
                        <span class="mc-pill mc-pill-amber">${g.campaign_type === 'B2B_INSTITUTIONAL' ? '기관 공구' : '주민 공구'}</span>
                        ${apvBadge}
                      </div>
                      <strong style="color: #0f172a;">${escapeHtml(g.title)}</strong>
                      <div style="color: #007749; font-weight: 700; font-size: 12px; margin-top: 4px;">${Number(g.unit_price).toLocaleString()}원 · 달성 ${g.current_qty}/${g.target_qty} (${pct}%)</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- 우측(모바일) / 하단(태블릿·PC): 실시간 미리보기 -->
        <div id="pwa-preview-card" class="mc-surface" style="background: #0f172a; border-color: #1e293b; padding: 14px; ${isSidePreview ? 'position: sticky; top: 76px;' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 10px; flex-wrap: wrap;">
            <div style="display: flex; gap: 4px;">
              <button type="button" class="btn-device-preview" data-device="MOBILE" style="padding: 5px 9px; border-radius: 6px; border: none; cursor: pointer; font-size: 11.5px; font-weight: 700; background: ${previewDevice === 'MOBILE' ? '#007749' : '#334155'}; color: #fff;">모바일</button>
              <button type="button" class="btn-device-preview" data-device="TABLET" style="padding: 5px 9px; border-radius: 6px; border: none; cursor: pointer; font-size: 11.5px; font-weight: 700; background: ${previewDevice === 'TABLET' ? '#007749' : '#334155'}; color: #fff;">태블릿</button>
              <button type="button" class="btn-device-preview" data-device="PC" style="padding: 5px 9px; border-radius: 6px; border: none; cursor: pointer; font-size: 11.5px; font-weight: 700; background: ${previewDevice === 'PC' ? '#007749' : '#334155'}; color: #fff;">PC 웹</button>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <button type="button" class="btn-preview-tab" data-tab="SHOP" style="padding: 5px 8px; border-radius: 6px; border: none; cursor: pointer; font-size: 11px; font-weight: 700; background: ${previewTab === 'SHOP' ? '#0284c7' : '#334155'}; color: #fff;">홈</button>
              <button type="button" class="btn-preview-tab" data-tab="FLYER" style="padding: 5px 8px; border-radius: 6px; border: none; cursor: pointer; font-size: 11px; font-weight: 700; background: ${previewTab === 'FLYER' ? '#0284c7' : '#334155'}; color: #fff;">전단</button>
              <button type="button" id="btn-refresh-pwa-preview" style="background: #334155; color: #e2e8f0; border: none; border-radius: 6px; padding: 5px 9px; cursor: pointer; font-size: 11px; font-weight: 600;">새로고침</button>
            </div>
          </div>
          <div style="overflow-x: auto; display: flex; justify-content: center; background: #1e293b; border-radius: 10px; padding: 10px;">
            <iframe id="iframe-pwa-preview" src="/mart/pwa/?tab=${previewTab}" style="width: ${previewDevice === 'MOBILE' ? '375px' : previewDevice === 'TABLET' ? '768px' : '1200px'}; max-width: 100%; height: 640px; border: none; border-radius: 10px; background: #ffffff;"></iframe>
          </div>
        </div>
      </div>

      ${editingBlock ? `
        <div class="mc-drawer-backdrop" id="mc-shelf-backdrop">
          <div class="mc-drawer" style="width: 600px;">
            <div class="mc-drawer-header">
              <div>
                <h2>${escapeHtml(editingBlock.title)} — 진열 순서 · 매대 전용가 설정</h2>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">진열 순서(▲/▼)와 매대 전용가(0=기본 판매가 유지)를 상품별로 섞어 설정할 수 있습니다.</div>
              </div>
              <button type="button" class="mc-drawer-close" id="btn-close-shelf-drawer">×</button>
            </div>
            <div class="mc-drawer-body">
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>1. 현재 진열된 상품 순서 · 매대 전용가 (${draftFeaturedIds.length}개)</span>
                </div>
                ${draftFeaturedIds.length === 0 ? `
                  <div style="font-size: 12px; color: #64748b; padding: 12px; background: #f8fafc; border-radius: 8px;">선택된 상품이 없습니다. 아래에서 상품을 선택하면 순서와 매대 전용가를 지정할 수 있습니다.</div>
                ` : `
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${draftFeaturedIds.map((pid, idx) => {
                      const p = allProducts.find(x => x.id === pid);
                      if (!p) return '';
                      const ovPrice = Number(draftShelfOverrides[pid]?.shelf_price || 0);
                      return `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border: 1px solid #007749; background: #f0fdf4; border-radius: 8px;">
                          <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                            <span class="mc-pill mc-pill-green">${idx + 1}</span>
                            <div style="min-width: 0;">
                              <div style="font-size: 12.5px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</div>
                              <div style="font-size: 11px; color: #64748b;">기본 ${Number(p.sale_price ?? p.regular_price ?? 0).toLocaleString()}원${p.applied_promo_name ? ` · ${escapeHtml(p.applied_promo_name)}` : ''}</div>
                            </div>
                          </div>
                          <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                            <input type="number" min="0" step="10" class="erp-input inp-shelf-price" data-pid="${escapeHtml(pid)}" value="${ovPrice}" placeholder="매대가(0=기본)" style="width: 92px; height: 28px; font-size: 11.5px; text-align: right;" title="0이면 기본 판매가/행사룰 유지" />
                            <button type="button" class="mc-btn-secondary btn-shelf-move" data-idx="${idx}" data-dir="-1" ${idx === 0 ? 'disabled' : ''} style="height: 28px; padding: 0 7px; font-size: 11px;">▲</button>
                            <button type="button" class="mc-btn-secondary btn-shelf-move" data-idx="${idx}" data-dir="1" ${idx === draftFeaturedIds.length - 1 ? 'disabled' : ''} style="height: 28px; padding: 0 7px; font-size: 11px;">▼</button>
                            <button type="button" class="mc-btn-secondary btn-shelf-remove" data-pid="${escapeHtml(pid)}" style="height: 28px; padding: 0 7px; font-size: 11px; color: #b91c1c;">삭제</button>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `}
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title"><span>2. 상품 검색 및 진열 추가</span></div>
                <input id="shelf-prod-q" type="text" class="mc-search" value="${escapeHtml(shelfSearchQuery)}" placeholder="상품명 · 바코드 · 규격 검색" style="width: 100%; margin-bottom: 12px;" />
                <div style="max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                  ${filteredProducts.map(p => {
                    const checked = draftFeaturedIds.includes(p.id);
                    return `
                      <label style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border: 1px solid ${checked ? '#007749' : '#e5e7eb'}; background: ${checked ? '#f0fdf4' : '#ffffff'}; border-radius: 8px; cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                          <input type="checkbox" class="chk-shelf-prod" value="${escapeHtml(p.id)}" ${checked ? 'checked' : ''} />
                          <div>
                            <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${escapeHtml(p.name)}</div>
                            <div style="font-size: 11.5px; color: #64748b;">${escapeHtml(p.spec || '-')} · ${escapeHtml(p.barcode)}</div>
                          </div>
                        </div>
                        <strong style="font-size: 13px; white-space: nowrap;">${Number(p.sale_price ?? p.regular_price ?? 0).toLocaleString()}원</strong>
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
            <div class="mc-drawer-footer">
              <button type="button" class="mc-btn-secondary" id="btn-cancel-shelf-drawer">취소</button>
              <button type="button" class="mc-btn-primary" id="btn-save-shelf-drawer">진열 순서 · 매대가 저장</button>
            </div>
          </div>
        </div>
      ` : ''}

      ${promoBuilderOpen ? (() => {
        const cb = editingCustomBlock || {};
        const selPromo = cb.linked_promo_id ? promoMap.get(cb.linked_promo_id) : null;
        const previewBadges = buildPromoFieldBadges(selPromo);
        const selDays = Array.isArray(cb.days_of_week) ? cb.days_of_week : [];
        return `
        <div class="mc-drawer-backdrop" id="mc-promo-builder-backdrop">
          <form class="mc-drawer" id="form-promo-builder" style="width: 560px;">
            <div class="mc-drawer-header">
              <div>
                <h2>${editingCustomBlock ? '행사 매대 스케줄 · 조립 수정' : '새 행사 매대 조립 추가'}</h2>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">기간 · 요일 조건에 맞춰 1+1 · 골라담기 · 한정특가 매대를 자동 노출합니다.</div>
              </div>
              <button type="button" class="mc-drawer-close" id="btn-close-promo-builder">×</button>
            </div>
            <div class="mc-drawer-body">
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">1. 연결 행사 룰 · 매대 제목</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">연결할 행사 룰 (선택 시 기간·요일·상품·현장배지 자동 연동)</label>
                    <select id="pb-promo-id" class="erp-input">
                      <option value="">행사 연결 안함 (수동 상품 지정 매대)</option>
                      ${promotions.map(pr => `<option value="${escapeHtml(pr.id)}" ${cb.linked_promo_id === pr.id ? 'selected' : ''}>${escapeHtml(pr.name)} (${escapeHtml(pr.start_date || '-')} ~ ${escapeHtml(pr.end_date || '-')})</option>`).join('')}
                    </select>
                    <div id="pb-promo-badges" style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px;">
                      ${previewBadges.map(fb => `<span class="mc-pill mc-pill-${fb.tone === 'red' ? 'red' : fb.tone === 'amber' ? 'amber' : fb.tone === 'green' ? 'green' : 'gray'}" style="font-size: 11px;">${escapeHtml(fb.text)}</span>`).join('')}
                    </div>
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">매대 제목 *</label>
                    <input id="pb-title" type="text" required class="erp-input" value="${escapeHtml(cb.title || '')}" placeholder="예: 주말 1+1 · 골라담기 특가 매대" />
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">한 줄 안내 문구 (선택)</label>
                    <input id="pb-subtitle" type="text" class="erp-input" value="${escapeHtml(cb.subtitle || '')}" placeholder="예: 금·토·일 선착순 한정 수량 · 1인 2개 한정" />
                  </div>
                </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">2. 자동 노출 스케줄 (기간 · 요일)</div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;">
                  <button type="button" class="mc-btn-secondary btn-pb-sched-preset" data-preset="TODAY" style="height: 27px; padding: 0 9px; font-size: 11.5px;">오늘 하루</button>
                  <button type="button" class="mc-btn-secondary btn-pb-sched-preset" data-preset="WEEKEND" style="height: 27px; padding: 0 9px; font-size: 11.5px;">이번 주말 (금·토·일)</button>
                  <button type="button" class="mc-btn-secondary btn-pb-sched-preset" data-preset="WEEK7" style="height: 27px; padding: 0 9px; font-size: 11.5px;">7일 전단</button>
                  <button type="button" class="mc-btn-secondary btn-pb-sched-preset" data-preset="ALWAYS" style="height: 27px; padding: 0 9px; font-size: 11.5px;">상시 노출</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div>
                    <label class="erp-field-label">노출 시작일 (미입력=상시)</label>
                    <input id="pb-start-date" type="date" class="erp-input" value="${escapeHtml(cb.start_date || '')}" />
                  </div>
                  <div>
                    <label class="erp-field-label">노출 종료일 (미입력=상시)</label>
                    <input id="pb-end-date" type="date" class="erp-input" value="${escapeHtml(cb.end_date || '')}" />
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">노출 요일 (미선택 시 매일 노출)</label>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                      ${DAY_ITEMS.map(d => `
                        <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc;">
                          <input type="checkbox" class="pb-day-chk" value="${d.code}" ${selDays.includes(d.code) ? 'checked' : ''} /> ${d.label}
                        </label>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">3. 진열 레이아웃 · 노출 탭</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div>
                    <label class="erp-field-label">진열 레이아웃</label>
                    <select id="pb-layout" class="erp-input">
                      <option value="GRID" ${(cb.layout || 'GRID') === 'GRID' ? 'selected' : ''}>카드 그리드 (2열 정돈)</option>
                      <option value="HORIZONTAL" ${cb.layout === 'HORIZONTAL' ? 'selected' : ''}>가로 슬라이드 (1+1·골라담기)</option>
                      <option value="HERO" ${cb.layout === 'HERO' ? 'selected' : ''}>대형 배너형 (메인 기획전)</option>
                      <option value="COUNTDOWN" ${cb.layout === 'COUNTDOWN' ? 'selected' : ''}>마감·한정수량 특가</option>
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">노출 탭 위치</label>
                    <select id="pb-target-tab" class="erp-input">
                      <option value="SHOP" ${(cb.target_tab || 'SHOP') === 'SHOP' ? 'selected' : ''}>장보기 홈</option>
                      <option value="FLYER" ${cb.target_tab === 'FLYER' ? 'selected' : ''}>전단 탭</option>
                      <option value="BOTH" ${cb.target_tab === 'BOTH' ? 'selected' : ''}>홈 + 전단 모두</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div class="mc-drawer-footer">
              <button type="button" class="mc-btn-secondary" id="btn-cancel-promo-builder">취소</button>
              <button type="button" class="mc-btn-secondary" id="btn-pb-save-and-pick" style="border-color: #007749; color: #007749;">저장 후 바로 상품 선택</button>
              <button type="submit" class="mc-btn-primary">${editingCustomBlock ? '매대 설정 저장' : '행사 매대 추가'}</button>
            </div>
          </form>
        </div>
        `;
      })() : ''}

      ${gbDrawerOpen ? `
        <div class="mc-drawer-backdrop" id="mc-gb-backdrop">
          <form class="mc-drawer" id="form-gb-add" style="width: 480px;">
            <div class="mc-drawer-header">
              <div>
                <h2>공동구매 캠페인 등록 (슈퍼관리자 승인 요청)</h2>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">등록 후 플랫폼 슈퍼관리자(/admin/)가 승인하면 고객용 PWA에 노출됩니다.</div>
              </div>
              <button type="button" class="mc-drawer-close" id="btn-close-gb-drawer">×</button>
            </div>
            <div class="mc-drawer-body">
              <div class="mc-drawer-section" style="display: flex; flex-direction: column; gap: 10px;">
                <div>
                  <label class="erp-field-label">캠페인명 *</label>
                  <input id="gb-title" type="text" required class="erp-input" placeholder="예: [우리동네 공구] 해남 절임배추 20kg" />
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div>
                    <label class="erp-field-label">공구 유형</label>
                    <select id="gb-type" class="erp-input">
                      <option value="B2C_RESIDENT">주민 공동구매</option>
                      <option value="B2B_INSTITUTIONAL">기관 · 경로당 공구</option>
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">마감일</label>
                    <input id="gb-deadline" type="date" class="erp-input" value="2026-11-30" />
                  </div>
                  <div>
                    <label class="erp-field-label">공구 특가 (원) *</label>
                    <input id="gb-unit-price" type="number" required min="100" class="erp-input" placeholder="29800" />
                  </div>
                  <div>
                    <label class="erp-field-label">정상가 (원)</label>
                    <input id="gb-reg-price" type="number" min="0" class="erp-input" placeholder="39800" />
                  </div>
                  <div>
                    <label class="erp-field-label">목표 수량 *</label>
                    <input id="gb-target-qty" type="number" required min="1" class="erp-input" value="50" />
                  </div>
                </div>
              </div>
            </div>
            <div class="mc-drawer-footer">
              <button type="button" class="mc-btn-secondary" id="btn-cancel-gb-drawer">취소</button>
              <button type="submit" class="mc-btn-primary">승인 요청 등록</button>
            </div>
          </form>
        </div>
      ` : ''}
    </div>
  `;

  container.querySelectorAll('.btn-device-preview').forEach(btn => {
    btn.addEventListener('click', () => {
      previewDevice = btn.dataset.device;
      const side = previewDevice === 'MOBILE';
      const grid = container.querySelector('#pwa-layout-grid');
      const card = container.querySelector('#pwa-preview-card');
      const iframe = container.querySelector('#iframe-pwa-preview');
      if (grid) grid.style.gridTemplateColumns = side ? 'minmax(0, 1fr) 415px' : '1fr';
      if (card) {
        card.style.position = side ? 'sticky' : 'static';
        card.style.top = side ? '76px' : '';
      }
      if (iframe) {
        iframe.style.width = previewDevice === 'MOBILE' ? '375px' : previewDevice === 'TABLET' ? '768px' : '1200px';
      }
      container.querySelectorAll('.btn-device-preview').forEach(b => {
        b.style.background = b.dataset.device === previewDevice ? '#007749' : '#334155';
      });
    });
  });

  container.querySelectorAll('.btn-preview-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      previewTab = btn.dataset.tab || 'SHOP';
      const iframe = container.querySelector('#iframe-pwa-preview');
      if (iframe) iframe.src = `/mart/pwa/?tab=${previewTab}&t=${Date.now()}`;
      container.querySelectorAll('.btn-preview-tab').forEach(b => {
        b.style.background = b.dataset.tab === previewTab ? '#0284c7' : '#334155';
      });
    });
  });

  container.querySelector('#btn-refresh-pwa-preview')?.addEventListener('click', () => {
    const iframe = container.querySelector('#iframe-pwa-preview');
    if (iframe) iframe.src = `/mart/pwa/?tab=${previewTab}&t=${Date.now()}`;
  });

  container.querySelectorAll('.btn-pick-shelf-prods').forEach(btn => {
    btn.addEventListener('click', () => {
      editingBlockId = btn.dataset.blockId;
      const targetBlk = blocks.find(b => b.id === editingBlockId);
      draftFeaturedIds = Array.isArray(targetBlk?.featured_product_ids) ? [...targetBlk.featured_product_ids] : [];
      draftShelfOverrides = { ...(targetBlk?.shelf_overrides || {}) };
      shelfSearchQuery = '';
      renderMartPwaControlView(container);
    });
  });
  container.querySelectorAll('.chk-shelf-prod').forEach(chk => {
    chk.addEventListener('change', () => {
      if (chk.checked && !draftFeaturedIds.includes(chk.value)) draftFeaturedIds.push(chk.value);
      else if (!chk.checked) draftFeaturedIds = draftFeaturedIds.filter(id => id !== chk.value);
      renderMartPwaControlView(container);
    });
  });
  container.querySelectorAll('.btn-shelf-move').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      const dir = Number(btn.dataset.dir);
      const target = idx + dir;
      if (target < 0 || target >= draftFeaturedIds.length) return;
      const [moved] = draftFeaturedIds.splice(idx, 1);
      draftFeaturedIds.splice(target, 0, moved);
      renderMartPwaControlView(container);
    });
  });
  container.querySelectorAll('.btn-shelf-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      draftFeaturedIds = draftFeaturedIds.filter(id => id !== btn.dataset.pid);
      renderMartPwaControlView(container);
    });
  });
  container.querySelectorAll('.inp-shelf-price').forEach(inp => {
    inp.addEventListener('input', () => {
      const pid = inp.dataset.pid;
      const val = Math.max(0, Number(inp.value || 0));
      draftShelfOverrides[pid] = { ...(draftShelfOverrides[pid] || {}), shelf_price: val };
    });
  });
  container.querySelector('#shelf-prod-q')?.addEventListener('input', (e) => {
    shelfSearchQuery = e.target.value;
    renderMartPwaControlView(container, { focusId: 'shelf-prod-q', cursorPos: e.target.selectionStart });
  });
  if (opts.focusId) {
    const focusEl = container.querySelector(`#${opts.focusId}`);
    if (focusEl) {
      focusEl.focus();
      if (typeof opts.cursorPos === 'number' && typeof focusEl.setSelectionRange === 'function') {
        focusEl.setSelectionRange(opts.cursorPos, opts.cursorPos);
      }
    }
  }
  const closeShelfDrawer = () => {
    editingBlockId = '';
    draftFeaturedIds = [];
    draftShelfOverrides = {};
    renderMartPwaControlView(container);
  };
  container.querySelector('#btn-close-shelf-drawer')?.addEventListener('click', closeShelfDrawer);
  container.querySelector('#btn-cancel-shelf-drawer')?.addEventListener('click', closeShelfDrawer);
  container.querySelector('#mc-shelf-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-shelf-backdrop') closeShelfDrawer();
  });
  container.querySelector('#btn-save-shelf-drawer')?.addEventListener('click', async () => {
    const selected = [...draftFeaturedIds];
    const cleanOverrides = {};
    selected.forEach(pid => {
      const sp = Number(draftShelfOverrides[pid]?.shelf_price || 0);
      if (sp > 0) cleanOverrides[pid] = { shelf_price: sp };
    });
    const updatedBlocks = blocks.map(b => b.id === editingBlockId ? { ...b, featured_product_ids: selected, shelf_overrides: cleanOverrides } : b);
    await martApi.updatePwaControl({ blocks: updatedBlocks });
    editingBlockId = '';
    draftFeaturedIds = [];
    draftShelfOverrides = {};
    await renderMartPwaControlView(container);
  });

  container.querySelector('#btn-save-pwa-ctrl')?.addEventListener('click', async () => {
    const prevMap = new Map(blocks.map(b => [b.id, b]));
    const blocksPayload = Array.from(container.querySelectorAll('.pwa-block-row')).map(row => {
      const id = row.dataset.blockId;
      const prev = prevMap.get(id) || {};
      return {
        ...prev,
        id,
        order: Number(row.querySelector('.blk-order')?.value || 1),
        enabled: Boolean(row.querySelector('.blk-enabled')?.checked),
        title: row.querySelector('.blk-title')?.value?.trim() || id
      };
    });
    await martApi.updatePwaControl({
      store_status: container.querySelector('#pwa-store-status')?.value,
      cutoff_time: container.querySelector('#pwa-cutoff-time')?.value,
      pos_only_policy: container.querySelector('#pwa-pos-policy')?.value,
      notice_text: container.querySelector('#pwa-notice-text')?.value,
      blocks: blocksPayload
    });
    const iframe = container.querySelector('#iframe-pwa-preview');
    if (iframe) iframe.src = `/mart/pwa/?tab=${previewTab}&t=${Date.now()}`;
  });

  container.querySelector('#btn-open-promo-builder')?.addEventListener('click', () => {
    editingCustomBlockId = '';
    promoBuilderOpen = true;
    renderMartPwaControlView(container);
  });
  container.querySelectorAll('.btn-edit-custom-block').forEach(btn => {
    btn.addEventListener('click', () => {
      editingCustomBlockId = btn.dataset.blockId || '';
      promoBuilderOpen = true;
      renderMartPwaControlView(container);
    });
  });
  container.querySelectorAll('.btn-del-custom-block').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.blockId;
      const nextBlocks = blocks.filter(b => b.id !== targetId);
      await martApi.updatePwaControl({ blocks: nextBlocks });
      showToast('행사 매대가 삭제되었습니다.', 'success');
      await renderMartPwaControlView(container);
    });
  });
  const closePromoBuilder = () => {
    promoBuilderOpen = false;
    editingCustomBlockId = '';
    renderMartPwaControlView(container);
  };
  container.querySelector('#btn-close-promo-builder')?.addEventListener('click', closePromoBuilder);
  container.querySelector('#btn-cancel-promo-builder')?.addEventListener('click', closePromoBuilder);
  container.querySelector('#mc-promo-builder-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-promo-builder-backdrop') closePromoBuilder();
  });
  container.querySelector('#pb-promo-id')?.addEventListener('change', (e) => {
    const pr = promoMap.get(e.target.value);
    const badgeHost = container.querySelector('#pb-promo-badges');
    if (badgeHost) {
      const fbs = buildPromoFieldBadges(pr);
      badgeHost.innerHTML = fbs.map(fb => `<span class="mc-pill mc-pill-${fb.tone === 'red' ? 'red' : fb.tone === 'amber' ? 'amber' : fb.tone === 'green' ? 'green' : 'gray'}" style="font-size: 11px;">${escapeHtml(fb.text)}</span>`).join('');
    }
    if (!pr) return;
    const titleEl = container.querySelector('#pb-title');
    if (titleEl && !titleEl.value.trim()) titleEl.value = pr.name || '';
    const sdEl = container.querySelector('#pb-start-date');
    const edEl = container.querySelector('#pb-end-date');
    if (sdEl && (pr.start_date || pr.start_at)) sdEl.value = String(pr.start_date || pr.start_at).slice(0, 10);
    if (edEl && (pr.end_date || pr.end_at)) edEl.value = String(pr.end_date || pr.end_at).slice(0, 10);
    const prDays = Array.isArray(pr.days_of_week) ? pr.days_of_week : [];
    container.querySelectorAll('.pb-day-chk').forEach(c => { c.checked = prDays.includes(c.value); });
  });
  let openPickerAfterSave = false;
  container.querySelector('#btn-pb-save-and-pick')?.addEventListener('click', () => {
    openPickerAfterSave = true;
    container.querySelector('#form-promo-builder')?.requestSubmit();
  });
  container.querySelectorAll('.btn-pb-sched-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.preset;
      const now = new Date();
      const addDays = (n) => new Date(now.getTime() + n * 86400000).toISOString().slice(0, 10);
      const sdEl = container.querySelector('#pb-start-date');
      const edEl = container.querySelector('#pb-end-date');
      const setDays = (arr = []) => {
        container.querySelectorAll('.pb-day-chk').forEach(c => { c.checked = arr.includes(c.value); });
      };
      if (code === 'TODAY') {
        if (sdEl) sdEl.value = today;
        if (edEl) edEl.value = today;
        setDays([]);
      } else if (code === 'WEEKEND') {
        const daysToSun = (7 - now.getDay()) % 7;
        if (sdEl) sdEl.value = today;
        if (edEl) edEl.value = addDays(daysToSun || 3);
        setDays(['FRI', 'SAT', 'SUN']);
      } else if (code === 'WEEK7') {
        if (sdEl) sdEl.value = today;
        if (edEl) edEl.value = addDays(6);
        setDays([]);
      } else if (code === 'ALWAYS') {
        if (sdEl) sdEl.value = '';
        if (edEl) edEl.value = '';
        setDays([]);
      }
    });
  });
  container.querySelector('#form-promo-builder')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const startDate = container.querySelector('#pb-start-date')?.value || '';
    const endDate = container.querySelector('#pb-end-date')?.value || '';
    if (startDate && endDate && startDate > endDate) {
      openPickerAfterSave = false;
      showToast('노출 시작일이 종료일보다 늦습니다. 기간을 확인해 주세요.', 'warn');
      return;
    }
    const days = Array.from(container.querySelectorAll('.pb-day-chk:checked')).map(c => c.value);
    const savedId = editingCustomBlockId || `PROMO_BLK_${Date.now()}`;
    const targetTab = container.querySelector('#pb-target-tab')?.value || 'SHOP';
    const payloadBlock = {
      id: savedId,
      block_type: 'CUSTOM_PROMO_SHELF',
      enabled: editingCustomBlock ? Boolean(editingCustomBlock.enabled) : true,
      order: editingCustomBlock ? Number(editingCustomBlock.order || 2) : 2,
      title: container.querySelector('#pb-title')?.value?.trim() || '기획 행사 매대',
      subtitle: container.querySelector('#pb-subtitle')?.value?.trim() || '',
      linked_promo_id: container.querySelector('#pb-promo-id')?.value || '',
      start_date: startDate,
      end_date: endDate,
      start_time: '',
      end_time: '',
      days_of_week: days,
      layout: container.querySelector('#pb-layout')?.value || 'GRID',
      target_tab: targetTab,
      featured_product_ids: editingCustomBlock?.featured_product_ids || [],
      shelf_overrides: editingCustomBlock?.shelf_overrides || {}
    };
    const nextBlocks = editingCustomBlockId
      ? blocks.map(b => b.id === editingCustomBlockId ? payloadBlock : b)
      : [...blocks, payloadBlock];
    await martApi.updatePwaControl({ blocks: nextBlocks });
    promoBuilderOpen = false;
    editingCustomBlockId = '';
    if (targetTab === 'FLYER') previewTab = 'FLYER';
    const shouldPick = openPickerAfterSave;
    openPickerAfterSave = false;
    if (shouldPick) {
      editingBlockId = savedId;
      draftFeaturedIds = [...payloadBlock.featured_product_ids];
      draftShelfOverrides = { ...payloadBlock.shelf_overrides };
      shelfSearchQuery = '';
      showToast('매대가 저장되었습니다. 진열할 상품을 선택해 주세요.', 'success');
    } else {
      showToast('행사 매대 조립 설정이 저장되었습니다.', 'success');
    }
    await renderMartPwaControlView(container);
  });

  container.querySelector('#btn-open-gb-drawer')?.addEventListener('click', () => {
    gbDrawerOpen = true;
    renderMartPwaControlView(container);
  });
  const closeGbDrawer = () => {
    gbDrawerOpen = false;
    renderMartPwaControlView(container);
  };
  container.querySelector('#btn-close-gb-drawer')?.addEventListener('click', closeGbDrawer);
  container.querySelector('#btn-cancel-gb-drawer')?.addEventListener('click', closeGbDrawer);
  container.querySelector('#mc-gb-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-gb-backdrop') closeGbDrawer();
  });
  container.querySelector('#form-gb-add')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await martApi.createGroupBuy({
      title: container.querySelector('#gb-title')?.value?.trim(),
      campaign_type: container.querySelector('#gb-type')?.value,
      deadline_at: container.querySelector('#gb-deadline')?.value,
      unit_price: Number(container.querySelector('#gb-unit-price')?.value || 0),
      regular_price: Number(container.querySelector('#gb-reg-price')?.value || 0),
      target_qty: Number(container.querySelector('#gb-target-qty')?.value || 50)
    });
    gbDrawerOpen = false;
    await renderMartPwaControlView(container);
  });
}
