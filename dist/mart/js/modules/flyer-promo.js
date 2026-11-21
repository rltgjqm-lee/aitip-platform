/**
 * AITIP Mart Portal - 3. 할인 · 행사 룰 & 전단 일괄 파싱 모듈 (ESM)
 * 상단 컴팩트 탭 분리(가로 100% 금지) + 실전 농협 오퍼유형 + 온/오프/카드별 + 1클릭 복제
 */

import { martApi } from '../api.js';
import { downloadExcelCsv, readCsvOrTextFile } from '../utils/excel-csv.js';
import { fileToWebpDataUrl } from '../utils/media-webp.js';
import { getL1List, inferCategoryFromProduct } from '../utils/mart-categories.js';

let viewTab = 'RULES'; // 'RULES' | 'PROMO_PRODUCTS' | 'FLYER_IMPORT'
let selectedPromoId = '';
let promoProdQuery = '';
let promoProdL1Filter = 'ALL';
let flyerPreviewUrl = '';
let flyerImageFile = null;
let flyerDraftText = '';
let flyerPreviewData = null;
let scopeFilter = 'ALL'; // 'ALL' | 'ALL_CHANNELS' | 'ONLINE_ONLY' | 'POS_ONLY'
let drawerOpen = false;
let typeMgrOpen = false;
let editingPromoId = '';
let cloneDraft = null;

const CALC_MODE_LABEL = {
  UNIT_DISCOUNT: '단품 할인 (요일·카드 조합)',
  BOGO_BUNDLE: 'N+1 덤 증정 (1+1 / 2+1)',
  MIX_MATCH: 'N개 골라담기 묶음가',
  THRESHOLD: '기준금액 · 수량 이상 할인'
};

function esc(v = '') {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SAMPLE_FLYER = `행사기간 : 2026년 11월 17일(화) ~ 2026년 11월 30일(월)
거봉 (2kg/박스) 17,900원 ※ 1인 2박스 한정
한돈 삼겹살 (100g당) 1,980원 ※ NH농협카드 현장결제 시
[1+1] CJ 해찬들 태양초 골드고추장 (1kg) 12,900원
[골라담기] 농심 스낵 4종 (새우깡 90g / 양파링 84g / 꿀꽈배기 90g / 자갈치 90g) 4개 구매 시 4,980원
[2개 이상 구매 시 30% 할인] 오뚜기 진라면 매운맛 (120g*5입) 각 3,480원`;

const PROMO_TYPE_LABEL = {
  PRICE_DISCOUNT: '기간 특가',
  DAY_OF_WEEK: '요일별 특가',
  AMOUNT_THRESHOLD: '금액기준 할인',
  QTY_THRESHOLD: '수량기준 할인',
  QTY_DISCOUNT: '다다익선 %할인',
  BOGO_1_PLUS_1: '덤(1+1)',
  BOGO_2_PLUS_1: '덤(2+1)',
  MIX_AND_MATCH: '골라담기',
  CROSS_BUY: '함께구매'
};

const CHANNEL_LABEL = {
  ALL_CHANNELS: '온·오프 공통',
  ONLINE_ONLY: '온라인 전용',
  POS_ONLY: '오프라인 POS 전용'
};

const DAY_LIST = [
  { code: 'MON', label: '월' },
  { code: 'TUE', label: '화' },
  { code: 'WED', label: '수' },
  { code: 'THU', label: '목' },
  { code: 'FRI', label: '금' },
  { code: 'SAT', label: '토' },
  { code: 'SUN', label: '일' }
];

const CARD_LIST = [
  { code: 'NH', label: 'NH농협' },
  { code: 'SHINHAN', label: '신한' },
  { code: 'SAMSUNG', label: '삼성' },
  { code: 'LOTTE', label: '롯데' },
  { code: 'WOORI', label: '우리' },
  { code: 'BC', label: 'BC' },
  { code: 'KAKAOPAY', label: '카카오페이' },
  { code: 'NAVERPAY', label: '네이버페이' },
  { code: 'TOSSPAY', label: '토스페이' }
];

function getChannelScope(pr) {
  if (pr.channel_scope) return pr.channel_scope;
  return pr.payment_scope === 'POS_ONLY' ? 'POS_ONLY' : 'ALL_CHANNELS';
}

const BUNDLE_PROMO_TYPES = new Set(['BOGO_1_PLUS_1', 'BOGO_2_PLUS_1', 'MIX_AND_MATCH', 'CROSS_BUY']);

function computePromoLinkUpdate(promo, regularPrice) {
  const reg = Math.max(0, Number(regularPrice || 0));
  if (!promo) {
    return {
      sale_price: reg,
      discount_pct: 0,
      promo_start: '',
      promo_end: '',
      applied_promo_id: '',
      applied_promo_name: '',
      applied_promo_type: '',
      promo_required_qty: 1,
      promo_bundle_price: 0,
      promo_days_of_week: [],
      promo_max_discount_amount: 0,
      promo_limit_per_person: 0,
      promo_card_targets: []
    };
  }
  let sale = reg;
  if (!BUNDLE_PROMO_TYPES.has(promo.promo_type)) {
    let rawDisc = 0;
    if (promo.discount_type === 'FIXED_AMOUNT' && Number(promo.discount_amount || 0) > 0) {
      rawDisc = Number(promo.discount_amount || 0);
    } else if (Number(promo.discount_pct || 0) > 0 && reg > 0) {
      rawDisc = Math.round(reg * (Number(promo.discount_pct) / 100));
    }
    const maxCap = Number(promo.max_discount_amount || 0);
    const capped = maxCap > 0 ? Math.min(rawDisc, maxCap) : rawDisc;
    sale = Math.max(0, reg - capped);
  }
  const discPct = reg > 0 && sale < reg ? Math.round((1 - sale / reg) * 100) : 0;
  const chScope = getChannelScope(promo);
  return {
    sale_price: sale,
    discount_pct: discPct,
    promo_start: promo.start_date || '',
    promo_end: promo.end_date || '',
    payment_scope: chScope === 'POS_ONLY' ? 'POS_ONLY' : 'ONLINE_APPLICABLE',
    channel_scope: chScope,
    applied_promo_id: promo.id || '',
    applied_promo_name: promo.name || '',
    applied_promo_type: promo.promo_type || '',
    promo_required_qty: Number(promo.required_qty || 1),
    promo_bundle_price: Number(promo.bundle_price || 0),
    promo_days_of_week: Array.isArray(promo.days_of_week) ? promo.days_of_week : [],
    promo_max_discount_amount: Number(promo.max_discount_amount || 0),
    promo_limit_per_person: Number(promo.limit_per_person || 0),
    promo_card_targets: Array.isArray(promo.card_targets) ? promo.card_targets : []
  };
}

export async function renderMartFlyerView(container, opts = {}) {
  if (!container) return;
  const [data, pwaRes] = await Promise.all([martApi.getCatalog(), martApi.getPwaConfig()]);
  const flyerBanners = Array.isArray(pwaRes?.config?.flyer_banners) ? pwaRes.config.flyer_banners : [];
  const l1List = getL1List();
  const promotions = data.promotions || [];
  const promoTypes = Array.isArray(data.promo_types) && data.promo_types.length > 0
    ? data.promo_types
    : Object.entries(PROMO_TYPE_LABEL).map(([code, label]) => ({ code, label, calc_mode: 'UNIT_DISCOUNT', is_active: true }));
  const typeLabelMap = { ...PROMO_TYPE_LABEL };
  promoTypes.forEach(t => { if (t.code && t.label) typeLabelMap[t.code] = t.label; });
  const activePromoTypes = promoTypes.filter(t => t.is_active !== false);
  const allProducts = (data.products || []).filter(p => p.category_type !== 'PREP_PROCESSED');
  if (!selectedPromoId && promotions.length > 0) selectedPromoId = promotions[0].id;
  const activePromo = promotions.find(pr => pr.id === selectedPromoId) || promotions[0] || null;
  const linkedProducts = activePromo ? allProducts.filter(p => p.applied_promo_id === activePromo.id) : [];
  const pq = promoProdQuery.trim().toLowerCase();
  const candidateProducts = activePromo
    ? allProducts.filter(p => {
        if (p.applied_promo_id === activePromo.id) return false;
        if (promoProdL1Filter !== 'ALL' && inferCategoryFromProduct(p).l1 !== promoProdL1Filter) return false;
        if (pq && !`${p.name} ${p.barcode} ${p.spec}`.toLowerCase().includes(pq)) return false;
        return true;
      })
    : [];
  const filtered = promotions.filter(pr => {
    if (scopeFilter !== 'ALL' && getChannelScope(pr) !== scopeFilter) return false;
    return true;
  });

  const today = new Date().toISOString().slice(0, 10);
  const d = cloneDraft || {};

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- 상단 페이지 헤더 + 컴팩트 탭 (가로 100% 금지) -->
      <div class="mc-page-header">
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <div class="mc-title-wrap">
            <h1>할인 · 행사 관리</h1>
            <span class="mc-count-pill">활성 룰 ${promotions.length}건</span>
          </div>
          <div style="display: inline-flex; gap: 6px; padding: 3px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 9px;">
            <button type="button" class="btn-promo-tab" data-tab="RULES" style="height: 30px; padding: 0 12px; border: none; border-radius: 7px; font-size: 12.5px; font-weight: 700; cursor: pointer; background: ${viewTab === 'RULES' ? '#007749' : 'transparent'}; color: ${viewTab === 'RULES' ? '#ffffff' : '#475569'};">
              할인 · 행사 룰 (${promotions.length})
            </button>
            <button type="button" class="btn-promo-tab" data-tab="PROMO_PRODUCTS" style="height: 30px; padding: 0 12px; border: none; border-radius: 7px; font-size: 12.5px; font-weight: 700; cursor: pointer; background: ${viewTab === 'PROMO_PRODUCTS' ? '#007749' : 'transparent'}; color: ${viewTab === 'PROMO_PRODUCTS' ? '#ffffff' : '#475569'};">
              행사별 상품 연결 (${linkedProducts.length})
            </button>
            <button type="button" class="btn-promo-tab" data-tab="FLYER_IMPORT" style="height: 30px; padding: 0 12px; border: none; border-radius: 7px; font-size: 12.5px; font-weight: 700; cursor: pointer; background: ${viewTab === 'FLYER_IMPORT' ? '#007749' : 'transparent'}; color: ${viewTab === 'FLYER_IMPORT' ? '#ffffff' : '#475569'};">
              전단 이미지 일괄 파싱
            </button>
          </div>
        </div>
        <div class="mc-header-actions" style="display: flex; gap: 8px;">
          ${viewTab === 'FLYER_IMPORT'
            ? `<button type="button" class="mc-btn-secondary" id="btn-fill-flyer-sample">전단 샘플 채우기</button>`
            : `<button type="button" class="mc-btn-secondary" id="btn-open-type-mgr">행사 유형 관리</button>
               <button type="button" class="mc-btn-primary" id="btn-open-promo-drawer">+ 새 행사 룰 등록</button>`
          }
        </div>
      </div>

      ${viewTab === 'RULES' ? `
        <div class="mc-surface">
          <div class="mc-filter-bar">
            <div class="mc-filter-controls">
              <select id="promo-scope-filter" class="mc-select">
                <option value="ALL" ${scopeFilter === 'ALL' ? 'selected' : ''}>전체 채널 (${promotions.length})</option>
                <option value="ALL_CHANNELS" ${scopeFilter === 'ALL_CHANNELS' ? 'selected' : ''}>온·오프 공통</option>
                <option value="ONLINE_ONLY" ${scopeFilter === 'ONLINE_ONLY' ? 'selected' : ''}>온라인 전용</option>
                <option value="POS_ONLY" ${scopeFilter === 'POS_ONLY' ? 'selected' : ''}>오프라인 POS 전용</option>
              </select>
            </div>
            <div style="font-size: 12px; color: #64748b;">조회 ${filtered.length}건 · [복제]로 기존 룰을 재사용할 수 있습니다</div>
          </div>

          <div class="mc-table-wrap">
            <table class="mc-table">
              <thead>
                <tr>
                  <th>행사명</th>
                  <th>유형</th>
                  <th>적용 채널 · 카드</th>
                  <th>할인 · 조건 · 한도</th>
                  <th>기간 · 요일</th>
                  <th style="text-align: right;">관리</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? `
                  <tr><td colspan="6" style="text-align: center; padding: 48px 16px; color: #64748b;">등록된 행사 룰이 없습니다.</td></tr>
                ` : filtered.map(pr => {
                  const ch = getChannelScope(pr);
                  const chPill = ch === 'POS_ONLY' ? 'mc-pill-amber' : ch === 'ONLINE_ONLY' ? 'mc-pill-blue' : 'mc-pill-green';
                  const cards = Array.isArray(pr.card_targets) && pr.card_targets.length > 0
                    ? pr.card_targets.map(c => (CARD_LIST.find(x => x.code === c) || {}).label || c).join('·')
                    : '전체 카드·결제';
                  return `
                    <tr>
                      <td><strong style="color: #0f172a;">${esc(pr.name)}</strong></td>
                      <td><span class="mc-pill mc-pill-blue">${esc(typeLabelMap[pr.promo_type] || pr.promo_type)}</span></td>
                      <td>
                        <div><span class="mc-pill ${chPill}">${CHANNEL_LABEL[ch] || ch}</span></div>
                        <div style="font-size: 11.5px; color: #64748b; margin-top: 3px;">${esc(cards)}</div>
                      </td>
                      <td style="color: #334155;">
                        <div>
                          필요 <b>${pr.required_qty || 1}개</b>
                          ${pr.min_purchase_amount ? ` · ${Number(pr.min_purchase_amount).toLocaleString()}원↑` : ''}
                          ${pr.bundle_price ? ` · 묶음 ${Number(pr.bundle_price).toLocaleString()}원` : ''}
                          ${pr.discount_type === 'FIXED_AMOUNT' && pr.discount_amount ? ` · 정액 ${Number(pr.discount_amount).toLocaleString()}원` : ''}
                          ${pr.discount_type !== 'FIXED_AMOUNT' && (pr.discount_pct ?? pr.discount_rate) ? ` · 정률 ${pr.discount_pct ?? pr.discount_rate}%` : ''}
                        </div>
                        <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">
                          ${pr.max_discount_amount ? `최대 ${Number(pr.max_discount_amount).toLocaleString()}원 한도` : ''}
                          ${pr.limit_per_person ? ` · <span style="color:#b45309;font-weight:700;">1인 ${pr.limit_per_person}한정</span>` : ''}
                          ${pr.max_receipt_sections ? ` · 영수증당 ${pr.max_receipt_sections}구간` : ''}
                        </div>
                      </td>
                      <td style="white-space: nowrap; color: #475569;">
                        <div>${esc(pr.start_date || '-')} ~ ${esc(pr.end_date || '-')}</div>
                        <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">
                          ${Array.isArray(pr.days_of_week) && pr.days_of_week.length > 0
                            ? `요일: ${pr.days_of_week.map(code => (DAY_LIST.find(x => x.code === code) || {}).label || code).join('·')}`
                            : '요일: 매일 적용'}
                        </div>
                      </td>
                      <td style="text-align: right; white-space: nowrap;">
                        <button type="button" class="mc-row-edit-btn btn-edit-promo" data-id="${esc(pr.id)}">수정</button>
                        <button type="button" class="mc-row-edit-btn btn-clone-promo" data-id="${esc(pr.id)}">복제</button>
                        <button type="button" class="mc-row-edit-btn btn-del-promo" data-id="${esc(pr.id)}" style="color: #b91c1c; border-color: #fecaca;">삭제</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${viewTab === 'PROMO_PRODUCTS' ? `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="mc-surface" style="padding: 16px 18px; display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <strong style="font-size: 13.5px; color: #0f172a;">대상 행사 룰 선택</strong>
              <select id="promo-link-select" class="mc-select" style="min-width: 280px;">
                ${promotions.map(pr => `<option value="${esc(pr.id)}" ${activePromo?.id === pr.id ? 'selected' : ''}>${esc(pr.name)}</option>`).join('')}
              </select>
            </div>
            ${activePromo ? `
              <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                <span class="mc-pill mc-pill-blue">${esc(typeLabelMap[activePromo.promo_type] || activePromo.promo_type)}</span>
                <span class="mc-pill mc-pill-green">${CHANNEL_LABEL[getChannelScope(activePromo)]}</span>
                <span class="mc-pill mc-pill-gray">${esc(activePromo.start_date || '-')} ~ ${esc(activePromo.end_date || '-')}</span>
              </div>
            ` : ''}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start;">
            <div class="mc-surface">
              <div style="padding: 14px 18px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 13.5px; color: #0f172a;">이 행사가 적용된 상품 (${linkedProducts.length}건)</strong>
                <span style="font-size: 12px; color: #64748b;">1. 상품등록과 실시간 동기화</span>
              </div>
              <div class="mc-table-wrap">
                <table class="mc-table">
                  <thead>
                    <tr><th>상품명</th><th style="text-align: right;">정상가 → 행사가</th><th style="text-align: right;">해제</th></tr>
                  </thead>
                  <tbody>
                    ${linkedProducts.length === 0 ? `
                      <tr><td colspan="3" style="text-align: center; padding: 32px 12px; color: #64748b;">연결된 상품이 없습니다. 우측에서 상품을 선택해 연결하세요.</td></tr>
                    ` : linkedProducts.map(p => `
                      <tr>
                        <td>
                          <strong>${esc(p.name)}</strong>
                          <div style="font-size: 11.5px; color: #64748b;">${esc(p.spec || '-')} · ${esc(p.barcode)}</div>
                        </td>
                        <td class="mc-num">
                          <span style="text-decoration: line-through; color: #94a3b8; font-size: 11.5px; margin-right: 4px;">${Number(p.regular_price || 0).toLocaleString()}</span>
                          <strong>${Number(p.sale_price ?? p.regular_price ?? 0).toLocaleString()}원</strong>
                        </td>
                        <td style="text-align: right;">
                          <button type="button" class="mc-row-edit-btn btn-unlink-promo-prod" data-id="${esc(p.id)}" style="color: #b91c1c; border-color: #fecaca;">연결 해제</button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="mc-surface">
              <div class="mc-filter-bar" style="gap: 8px; flex-wrap: wrap;">
                <select id="promo-prod-l1" class="mc-select" style="min-width: 120px;">
                  <option value="ALL" ${promoProdL1Filter === 'ALL' ? 'selected' : ''}>전체 대분류</option>
                  ${l1List.map(c => `<option value="${c.code}" ${promoProdL1Filter === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                </select>
                <input id="promo-prod-q" type="text" class="mc-search" value="${esc(promoProdQuery)}" placeholder="상품명 · 바코드 검색" style="min-width: 150px; flex: 1;" />
                <button type="button" class="mc-btn-primary" id="btn-link-selected-prods" style="height: 34px; font-size: 12.5px;">선택 상품 연결</button>
              </div>
              <div class="mc-table-wrap" style="max-height: 460px; overflow-y: auto;">
                <table class="mc-table">
                  <thead>
                    <tr><th style="width: 34px; text-align: center;"><input type="checkbox" id="chk-link-all-prods" title="전체 선택" /></th><th>상품명 · 규격</th><th style="text-align: right;">정상가</th></tr>
                  </thead>
                  <tbody>
                    ${candidateProducts.length === 0 ? `
                      <tr><td colspan="3" style="text-align: center; padding: 32px 12px; color: #64748b;">추가 연결 가능한 상품이 없습니다.</td></tr>
                    ` : candidateProducts.map(p => `
                      <tr>
                        <td style="text-align: center;"><input type="checkbox" class="chk-link-prod" data-id="${esc(p.id)}" /></td>
                        <td>
                          <strong>${esc(p.name)}</strong>
                          <div style="font-size: 11.5px; color: #64748b;">${esc(p.spec || '-')} · ${esc(p.barcode)}</div>
                        </td>
                        <td class="mc-num">${Number(p.regular_price || 0).toLocaleString()}원</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      ${viewTab === 'FLYER_IMPORT' ? `
        <div class="mc-surface" style="padding: 18px;">
          <div style="margin-bottom: 12px;">
            <strong style="font-size: 14px; color: #0f172a;">전단 이미지 대조 · 일괄 파싱</strong>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">좌측 원본 전단을 보며 우측 문구를 검수하면 1+1 · 골라담기 · 현장결제(POS_ONLY)가 자동 분류됩니다.</div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1.25fr; gap: 16px; align-items: stretch;">
            <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: 12px; font-weight: 700; color: #334155;">원본 전단 이미지 (PWA 배너 게시)</span>
                <div style="display: flex; gap: 6px;">
                  <label class="mc-btn-secondary" style="height: 28px; padding: 0 10px; font-size: 12px; display: inline-flex; align-items: center; cursor: pointer;">
                    이미지 선택
                    <input type="file" id="file-flyer-img" accept="image/*" style="display: none;" />
                  </label>
                  <button type="button" class="mc-btn-primary" id="btn-publish-flyer-banner" style="height: 28px; padding: 0 10px; font-size: 12px;" ${flyerImageFile ? '' : 'disabled'}>PWA 배너 게시</button>
                </div>
              </div>
              <div id="flyer-img-preview-box" style="flex: 1; min-height: 220px; max-height: 360px; overflow: auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                ${flyerPreviewUrl
                  ? `<img src="${flyerPreviewUrl}" alt="전단 미리보기" style="max-width: 100%; height: auto; display: block;" />`
                  : `<span style="font-size: 12px; color: #94a3b8; text-align: center; padding: 16px;">전단 이미지(.jpg, .png)를 선택하면<br/>대조 검수 후 고객 PWA 상단 배너로 게시할 수 있습니다.</span>`
                }
              </div>
              ${flyerBanners.length > 0 ? `
                <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                  <span style="font-size: 11px; color: #047857; font-weight: 700;">게시중인 전단 배너 ${flyerBanners.length}건:</span>
                  ${flyerBanners.map((b, idx) => `
                    <span class="mc-pill mc-pill-green" style="display: inline-flex; align-items: center; gap: 4px;">
                      배너#${idx + 1}
                      <button type="button" class="btn-del-flyer-banner" data-idx="${idx}" style="border: none; background: none; cursor: pointer; color: #b91c1c; font-weight: 800; padding: 0;">×</button>
                    </span>
                  `).join('')}
                </div>
              ` : ''}
            </div>

            <div style="display: flex; flex-direction: column;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: 12px; font-weight: 700; color: #334155;">전단 행사표 CSV / 문구 입력</span>
                <div style="display: flex; gap: 6px;">
                  <button type="button" class="mc-btn-secondary" id="btn-dl-flyer-csv" style="height: 28px; padding: 0 10px; font-size: 12px;">전단 CSV 양식</button>
                  <label class="mc-btn-secondary" style="height: 28px; padding: 0 10px; font-size: 12px; display: inline-flex; align-items: center; cursor: pointer;">
                    CSV/엑셀 업로드
                    <input type="file" id="file-flyer-csv" accept=".csv,.txt,.tsv" style="display: none;" />
                  </label>
                </div>
              </div>
              <textarea id="txt-flyer-import" rows="12" style="width: 100%; flex: 1; padding: 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-family: var(--font-mono); font-size: 12px; line-height: 1.6;" placeholder="전단 행사표 CSV 또는 전단 문구를 붙여넣거나 파일 업로드하세요.">${esc(flyerDraftText)}</textarea>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 12px; color: #64748b;"><code>현장결제</code> · <code>NH농협카드</code> · <code>금토일</code> · <code>최대 X원</code> 자동 추출</span>
                <div style="display: flex; gap: 6px;">
                  <button type="button" class="mc-btn-secondary" id="btn-preview-flyer-import">1. 파싱 미리보기</button>
                  <button type="button" class="mc-btn-primary" id="btn-run-flyer-import">2. 확정 일괄 반영</button>
                </div>
              </div>
            </div>
          </div>

          ${flyerPreviewData ? `
            <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="font-size: 13px; color: #0f172a;">
                  파싱 검수 결과: 상품 ${(flyerPreviewData.items || []).length}건 · 행사 룰 ${(flyerPreviewData.promotions || []).length}건
                  (${esc(flyerPreviewData.promo_start || '-')} ~ ${esc(flyerPreviewData.promo_end || '-')})
                </strong>
                <span style="font-size: 12px; color: #64748b;">기존 상품과 이름이 일치하면 신규 생성 대신 행사만 덮어씁니다.</span>
              </div>
              <div class="mc-table-wrap">
                <table class="mc-table">
                  <thead>
                    <tr>
                      <th>매칭 상태</th>
                      <th>상품명 · 규격</th>
                      <th>추출 유형 · 조건</th>
                      <th>채널 · 카드 · 요일</th>
                      <th style="text-align: right;">행사가</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(flyerPreviewData.items || []).map(it => `
                      <tr>
                        <td>
                          ${it.match_status === 'MATCHED_EXISTING'
                            ? `<span class="mc-pill mc-pill-green">기존 상품 연결</span><div style="font-size: 10.5px; color: #64748b;">${esc(it.matched_barcode)}</div>`
                            : `<span class="mc-pill mc-pill-blue">신규 상품 등록</span>`
                          }
                        </td>
                        <td>
                          <strong>${esc(it.name)}</strong>
                          <div style="font-size: 11.5px; color: #64748b;">${esc(it.spec || '-')} · ${esc(it.uom || '개')}</div>
                        </td>
                        <td>
                          <span class="mc-pill mc-pill-amber">${esc(typeLabelMap[it.applied_promo_type] || it.applied_promo_type || '기간 특가')}</span>
                          ${it.promo_limit_per_person ? `<span class="mc-pill mc-pill-gray">1인 ${it.promo_limit_per_person}한정</span>` : ''}
                          ${it.promo_max_discount_amount ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">최대 ${Number(it.promo_max_discount_amount).toLocaleString()}원</div>` : ''}
                        </td>
                        <td>
                          <span class="mc-pill ${it.channel_scope === 'POS_ONLY' ? 'mc-pill-amber' : it.channel_scope === 'ONLINE_ONLY' ? 'mc-pill-blue' : 'mc-pill-green'}">${esc(CHANNEL_LABEL[it.channel_scope] || '온·오프 공통')}</span>
                          ${(it.promo_card_targets || []).length > 0 ? `<div style="font-size: 11px; color: #0369a1; margin-top: 2px;">${esc(it.promo_card_targets.join(', '))}</div>` : ''}
                          ${(it.promo_days_of_week || []).length > 0 ? `<div style="font-size: 11px; color: #64748b;">${esc(it.promo_days_of_week.join(','))}</div>` : ''}
                        </td>
                        <td class="mc-num"><strong>${Number(it.sale_price || 0).toLocaleString()}원</strong></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${drawerOpen ? `
        <div class="mc-drawer-backdrop" id="mc-promo-backdrop">
          <form class="mc-drawer" id="form-promo-add" style="width: 560px;">
            <div class="mc-drawer-header">
              <h2>${editingPromoId ? '행사 룰 수정' : cloneDraft ? '행사 룰 복제 등록' : '새 행사 룰 등록'}</h2>
              <button type="button" class="mc-drawer-close" id="btn-close-promo-drawer">×</button>
            </div>
            <div class="mc-drawer-body">
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">1. 행사 유형 · 적용 채널</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">행사명 *</label>
                    <input id="pm-name" type="text" required class="erp-input" value="${esc(d.name || '')}" placeholder="예: 수요일 농산 15% 특가 / 금토일 특가 (최대 3천원)" />
                  </div>
                  <div>
                    <label class="erp-field-label">행사 유형</label>
                    <select id="pm-type" class="erp-input">
                      ${(() => {
                        const curType = d.promo_type === 'WEEKEND_SPECIAL' ? 'DAY_OF_WEEK' : (d.promo_type || activePromoTypes[0]?.code || 'PRICE_DISCOUNT');
                        const list = activePromoTypes.some(t => t.code === curType)
                          ? activePromoTypes
                          : [...activePromoTypes, { code: curType, label: typeLabelMap[curType] || curType }];
                        return list.map(t => `<option value="${esc(t.code)}" ${curType === t.code ? 'selected' : ''}>${esc(t.label)}</option>`).join('');
                      })()}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">온·오프 채널</label>
                    <select id="pm-scope" class="erp-input">
                      <option value="ALL_CHANNELS" ${getChannelScope(d) === 'ALL_CHANNELS' ? 'selected' : ''}>온·오프 공통</option>
                      <option value="ONLINE_ONLY" ${getChannelScope(d) === 'ONLINE_ONLY' ? 'selected' : ''}>온라인 전용</option>
                      <option value="POS_ONLY" ${getChannelScope(d) === 'POS_ONLY' ? 'selected' : ''}>오프라인 POS 전용</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">2. 할인 · 묶음 · 상한 · 한도 조건</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="erp-field-label">할인 방식</label>
                    <select id="pm-disc-type" class="erp-input">
                      <option value="PERCENT" ${d.discount_type !== 'FIXED_AMOUNT' ? 'selected' : ''}>정률 할인 (%)</option>
                      <option value="FIXED_AMOUNT" ${d.discount_type === 'FIXED_AMOUNT' ? 'selected' : ''}>정액 할인 (원)</option>
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">할인율 (%) / 정액 (원)</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                      <input id="pm-rate" type="number" min="0" max="99" value="${Number(d.discount_pct ?? 0)}" class="erp-input" title="정률 %" />
                      <input id="pm-fixed" type="number" min="0" value="${Number(d.discount_amount ?? 0)}" class="erp-input" title="정액 원" />
                    </div>
                  </div>
                  <div>
                    <label class="erp-field-label">필요 수량 (묶음·골라담기)</label>
                    <input id="pm-req-qty" type="number" min="1" value="${Number(d.required_qty ?? 1)}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">묶음가 (원, 골라담기 등)</label>
                    <input id="pm-bundle" type="number" min="0" value="${Number(d.bundle_price ?? 0)}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">기준 구매금액 (원, 이상 시)</label>
                    <input id="pm-min-amt" type="number" min="0" value="${Number(d.min_purchase_amount ?? 0)}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">최대 할인 상한 (원, 0=무제한)</label>
                    <input id="pm-max-disc" type="number" min="0" value="${Number(d.max_discount_amount ?? 0)}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">1인 구매 한정 (0=무제한)</label>
                    <input id="pm-limit" type="number" min="0" value="${Number(d.limit_per_person ?? 0)}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">영수증당 최대 구간 (0=무제한)</label>
                    <input id="pm-receipt-sec" type="number" min="0" value="${Number(d.max_receipt_sections ?? 0)}" class="erp-input" />
                  </div>
                </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">3. 기간 · 요일 · 카드/간편결제</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="erp-field-label">행사 시작일</label>
                    <input id="pm-start" type="date" value="${esc(d.start_date || today)}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">행사 종료일</label>
                    <input id="pm-end" type="date" value="${esc(d.end_date || today)}" class="erp-input" />
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">적용 요일 (미선택 시 매일 적용)</label>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                      ${DAY_LIST.map(day => `
                        <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc;">
                          <input type="checkbox" class="pm-day-chk" value="${day.code}" ${Array.isArray(d.days_of_week) && d.days_of_week.includes(day.code) ? 'checked' : ''} /> ${day.label}
                        </label>
                      `).join('')}
                    </div>
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">대상 카드 · 간편결제 (미선택 시 전체 적용)</label>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                      ${CARD_LIST.map(card => `
                        <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc;">
                          <input type="checkbox" class="pm-card-chk" value="${card.code}" ${Array.isArray(d.card_targets) && d.card_targets.includes(card.code) ? 'checked' : ''} /> ${card.label}
                        </label>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="mc-drawer-footer">
              <button type="button" class="mc-btn-secondary" id="btn-cancel-promo-drawer">취소</button>
              <button type="submit" class="mc-btn-primary">행사 룰 저장</button>
            </div>
          </form>
        </div>
      ` : ''}

      ${typeMgrOpen ? `
        <div class="mc-drawer-backdrop" id="mc-type-mgr-backdrop">
          <div class="mc-drawer" style="width: 560px;">
            <div class="mc-drawer-header">
              <div>
                <h2>행사 유형 관리 (추가 · 숨김 · 삭제)</h2>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">마트별 행사 명칭을 자유롭게 추가하고 계산 방식(단품/덤/골라담기/기준할인)을 연결합니다.</div>
              </div>
              <button type="button" class="mc-drawer-close" id="btn-close-type-mgr">×</button>
            </div>
            <div class="mc-drawer-body">
              <form id="form-add-promo-type" class="mc-drawer-section" style="margin-bottom: 14px;">
                <div class="mc-drawer-section-title">새 행사 유형 추가</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end;">
                  <div>
                    <label class="erp-field-label">행사 유형 이름 *</label>
                    <input id="pt-label" type="text" required class="erp-input" placeholder="예: 조합원 데이, 수요장터 특가" />
                  </div>
                  <div>
                    <label class="erp-field-label">적용 계산 방식 *</label>
                    <select id="pt-calc-mode" class="erp-input">
                      ${Object.entries(CALC_MODE_LABEL).map(([k, lbl]) => `<option value="${k}">${lbl}</option>`).join('')}
                    </select>
                  </div>
                  <button type="submit" class="mc-btn-primary" style="height: 36px;">추가</button>
                </div>
              </form>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">등록된 행사 유형 (${promoTypes.length}종)</div>
                <div style="display: flex; flex-direction: column; gap: 6px; max-height: 400px; overflow-y: auto;">
                  ${promoTypes.map(t => {
                    const used = promotions.some(pr => pr.promo_type === t.code);
                    return `
                      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${t.is_active !== false ? '#ffffff' : '#f8fafc'}; opacity: ${t.is_active !== false ? '1' : '0.65'};">
                        <div>
                          <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${esc(t.label)} <span style="font-size: 11px; color: #64748b; font-weight: 500;">(${esc(t.code)})</span></div>
                          <div style="font-size: 11.5px; color: #0369a1; margin-top: 2px;">${esc(CALC_MODE_LABEL[t.calc_mode] || t.calc_mode)}${used ? ' · 사용 중' : ''}</div>
                        </div>
                        <div style="display: flex; gap: 6px;">
                          <button type="button" class="mc-btn-secondary btn-toggle-promo-type" data-code="${esc(t.code)}" data-active="${t.is_active !== false ? '1' : '0'}" style="height: 28px; padding: 0 10px; font-size: 12px;">
                            ${t.is_active !== false ? '숨김' : '복원'}
                          </button>
                          <button type="button" class="mc-btn-secondary btn-del-promo-type" data-code="${esc(t.code)}" style="height: 28px; padding: 0 10px; font-size: 12px; color: #b91c1c;">
                            ${used ? '사용중지' : '삭제'}
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
            <div class="mc-drawer-footer">
              <button type="button" class="mc-btn-primary" id="btn-done-type-mgr">닫기</button>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  container.querySelectorAll('.btn-promo-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      viewTab = btn.dataset.tab;
      renderMartFlyerView(container);
    });
  });

  // 3번째 탭: 행사별 상품 연결/해제
  container.querySelector('#promo-link-select')?.addEventListener('change', (e) => {
    selectedPromoId = e.target.value;
    renderMartFlyerView(container);
  });
  container.querySelector('#promo-prod-q')?.addEventListener('input', (e) => {
    promoProdQuery = e.target.value;
    renderMartFlyerView(container, { focusId: 'promo-prod-q', cursorPos: e.target.selectionStart });
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
  container.querySelector('#promo-prod-l1')?.addEventListener('change', (e) => {
    promoProdL1Filter = e.target.value;
    renderMartFlyerView(container);
  });
  container.querySelector('#chk-link-all-prods')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    container.querySelectorAll('.chk-link-prod').forEach(chk => { chk.checked = checked; });
  });
  container.querySelectorAll('.btn-unlink-promo-prod').forEach(btn => {
    btn.addEventListener('click', async () => {
      const prod = allProducts.find(p => p.id === btn.dataset.id);
      if (!prod) return;
      await martApi.bulkUpdateGrid([{ id: prod.id, ...computePromoLinkUpdate(null, prod.regular_price) }]);
      await renderMartFlyerView(container);
    });
  });
  container.querySelector('#btn-link-selected-prods')?.addEventListener('click', async () => {
    if (!activePromo) return;
    const ids = Array.from(container.querySelectorAll('.chk-link-prod:checked')).map(c => c.dataset.id);
    if (ids.length === 0) return;
    const updates = ids.map(id => {
      const prod = allProducts.find(p => p.id === id);
      return { id, ...computePromoLinkUpdate(activePromo, prod?.regular_price || 0) };
    });
    await martApi.bulkUpdateGrid(updates);
    await renderMartFlyerView(container);
  });

  container.querySelector('#file-flyer-img')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    flyerImageFile = file;
    if (flyerPreviewUrl) URL.revokeObjectURL(flyerPreviewUrl);
    flyerPreviewUrl = URL.createObjectURL(file);
    renderMartFlyerView(container);
  });
  container.querySelector('#btn-publish-flyer-banner')?.addEventListener('click', async () => {
    if (!flyerImageFile) return;
    const dataUrl = await fileToWebpDataUrl(flyerImageFile, 1000, 0.84);
    const up = await martApi.uploadMedia({ data_url: dataUrl, original_name: flyerImageFile.name });
    const nextBanners = [{ id: up.media_id, image_url: up.image_url, title: flyerImageFile.name, created_at: new Date().toISOString() }, ...flyerBanners];
    await martApi.updatePwaControl({ flyer_banners: nextBanners });
    flyerImageFile = null;
    await renderMartFlyerView(container);
  });
  container.querySelectorAll('.btn-del-flyer-banner').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.idx);
      const nextBanners = flyerBanners.filter((_, i) => i !== idx);
      await martApi.updatePwaControl({ flyer_banners: nextBanners });
      await renderMartFlyerView(container);
    });
  });
  container.querySelector('#btn-dl-flyer-csv')?.addEventListener('click', () => {
    downloadExcelCsv('전단행사표_양식.csv', [
      ['바코드', '상품명', '행사유형', '정상가', '행사가', '필요수량', '묶음가', '시작일', '종료일', '채널', '카드사'],
      ['8801043014816', '농심 신라면 멀티', 'PRICE_DISCOUNT', '4480', '3680', '1', '0', '2026-11-20', '2026-11-30', 'ALL_CHANNELS', ''],
      ['2000010000008', '국내산 세척당근(특)', 'DAY_OF_WEEK', '3500', '2780', '1', '0', '2026-11-20', '2026-11-30', 'POS_ONLY', 'NH농협카드']
    ]);
  });
  container.querySelector('#file-flyer-csv')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readCsvOrTextFile(file);
    flyerDraftText = text;
    flyerPreviewData = await martApi.previewFlyerImport(text);
    renderMartFlyerView(container);
  });
  container.querySelector('#btn-fill-flyer-sample')?.addEventListener('click', () => {
    flyerDraftText = SAMPLE_FLYER;
    const ta = container.querySelector('#txt-flyer-import');
    if (ta) ta.value = SAMPLE_FLYER;
  });
  container.querySelector('#btn-preview-flyer-import')?.addEventListener('click', async () => {
    const text = container.querySelector('#txt-flyer-import')?.value?.trim();
    if (!text) return;
    flyerDraftText = text;
    flyerPreviewData = await martApi.previewFlyerImport(text);
    renderMartFlyerView(container);
  });
  container.querySelector('#btn-run-flyer-import')?.addEventListener('click', async () => {
    const text = (container.querySelector('#txt-flyer-import')?.value || flyerDraftText || '').trim();
    if (!text) return;
    await martApi.bulkImport('FLYER', text);
    flyerPreviewData = null;
    flyerDraftText = '';
    viewTab = 'RULES';
    await renderMartFlyerView(container);
  });
  container.querySelector('#promo-scope-filter')?.addEventListener('change', (e) => {
    scopeFilter = e.target.value;
    renderMartFlyerView(container);
  });

  container.querySelector('#btn-open-promo-drawer')?.addEventListener('click', () => {
    editingPromoId = '';
    cloneDraft = null;
    drawerOpen = true;
    renderMartFlyerView(container);
  });
  container.querySelectorAll('.btn-edit-promo').forEach(btn => {
    btn.addEventListener('click', () => {
      const src = promotions.find(p => p.id === btn.dataset.id);
      if (!src) return;
      editingPromoId = src.id;
      cloneDraft = { ...src };
      drawerOpen = true;
      renderMartFlyerView(container);
    });
  });
  container.querySelectorAll('.btn-clone-promo').forEach(btn => {
    btn.addEventListener('click', () => {
      const src = promotions.find(p => p.id === btn.dataset.id);
      editingPromoId = '';
      cloneDraft = src ? { ...src, name: `${src.name} (복제)` } : null;
      drawerOpen = true;
      renderMartFlyerView(container);
    });
  });
  container.querySelectorAll('.btn-del-promo').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('이 행사 룰을 삭제하시겠습니까? 연결된 상품의 행사도 함께 해제됩니다.')) return;
      await martApi.deletePromotion(btn.dataset.id);
      if (selectedPromoId === btn.dataset.id) selectedPromoId = '';
      await renderMartFlyerView(container);
    });
  });

  const closeDrawer = () => {
    drawerOpen = false;
    editingPromoId = '';
    cloneDraft = null;
    renderMartFlyerView(container);
  };
  container.querySelector('#btn-close-promo-drawer')?.addEventListener('click', closeDrawer);
  container.querySelector('#btn-cancel-promo-drawer')?.addEventListener('click', closeDrawer);
  container.querySelector('#mc-promo-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-promo-backdrop') closeDrawer();
  });

  container.querySelector('#btn-open-type-mgr')?.addEventListener('click', () => {
    typeMgrOpen = true;
    renderMartFlyerView(container);
  });
  const closeTypeMgr = () => {
    typeMgrOpen = false;
    renderMartFlyerView(container);
  };
  container.querySelector('#btn-close-type-mgr')?.addEventListener('click', closeTypeMgr);
  container.querySelector('#btn-done-type-mgr')?.addEventListener('click', closeTypeMgr);
  container.querySelector('#mc-type-mgr-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-type-mgr-backdrop') closeTypeMgr();
  });
  container.querySelector('#form-add-promo-type')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = container.querySelector('#pt-label')?.value?.trim();
    const calc_mode = container.querySelector('#pt-calc-mode')?.value || 'UNIT_DISCOUNT';
    if (!label) return;
    await martApi.savePromoType({ label, calc_mode });
    renderMartFlyerView(container);
  });
  container.querySelectorAll('.btn-toggle-promo-type').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = promoTypes.find(t => t.code === btn.dataset.code);
      if (!target) return;
      await martApi.savePromoType({
        is_update: true,
        code: target.code,
        label: target.label,
        calc_mode: target.calc_mode,
        is_active: btn.dataset.active !== '1'
      });
      renderMartFlyerView(container);
    });
  });
  container.querySelectorAll('.btn-del-promo-type').forEach(btn => {
    btn.addEventListener('click', async () => {
      await martApi.deletePromoType(btn.dataset.code);
      renderMartFlyerView(container);
    });
  });

  container.querySelector('#form-promo-add')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const daysOfWeek = Array.from(container.querySelectorAll('.pm-day-chk:checked')).map(c => c.value);
    const cardTargets = Array.from(container.querySelectorAll('.pm-card-chk:checked')).map(c => c.value);
    const channelScope = container.querySelector('#pm-scope')?.value || 'ALL_CHANNELS';
    const payload = {
      name: container.querySelector('#pm-name')?.value?.trim(),
      promo_type: container.querySelector('#pm-type')?.value || 'PRICE_DISCOUNT',
      channel_scope: channelScope,
      payment_scope: channelScope === 'POS_ONLY' ? 'POS_ONLY' : 'ONLINE_APPLICABLE',
      required_qty: Math.max(1, Number(container.querySelector('#pm-req-qty')?.value ?? 1)),
      min_purchase_amount: Math.max(0, Number(container.querySelector('#pm-min-amt')?.value ?? 0)),
      bundle_price: Math.max(0, Number(container.querySelector('#pm-bundle')?.value ?? 0)),
      discount_type: container.querySelector('#pm-disc-type')?.value || 'PERCENT',
      discount_pct: Math.max(0, Math.min(99, Number(container.querySelector('#pm-rate')?.value ?? 0))),
      discount_amount: Math.max(0, Number(container.querySelector('#pm-fixed')?.value ?? 0)),
      max_discount_amount: Math.max(0, Number(container.querySelector('#pm-max-disc')?.value ?? 0)),
      days_of_week: daysOfWeek,
      card_targets: cardTargets,
      limit_per_person: Math.max(0, Number(container.querySelector('#pm-limit')?.value ?? 0)),
      max_receipt_sections: Math.max(0, Number(container.querySelector('#pm-receipt-sec')?.value ?? 0)),
      start_date: container.querySelector('#pm-start')?.value || today,
      end_date: container.querySelector('#pm-end')?.value || today
    };
    if (editingPromoId) {
      await martApi.updatePromotion({ id: editingPromoId, ...payload });
    } else {
      await martApi.createPromotion(payload);
    }
    drawerOpen = false;
    editingPromoId = '';
    cloneDraft = null;
    await renderMartFlyerView(container);
  });
}
