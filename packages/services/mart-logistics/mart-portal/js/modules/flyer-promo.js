/**
 * AITIP Mart Portal - 3. 할인 · 행사 룰 & 전단 일괄 파싱 모듈 (ESM)
 * 상단 컴팩트 탭 분리(가로 100% 금지) + 실전 농협 오퍼유형 + 온/오프/카드별 + 1클릭 복제
 */

import { martApi } from '../api.js';
import { downloadExcelCsv, readCsvOrTextFile, parseDelimitedRows } from '../utils/excel-csv.js';
import { fileToWebpDataUrl } from '../utils/media-webp.js';
import { getL1List, getL2List, getL3List, inferCategoryFromProduct } from '../utils/mart-categories.js';
import { paginateArray, renderMartPaginationHtml, bindMartPaginationEvents } from '../utils/pagination.js';
import { esc, showToast } from '../utils/html.js';
import { renderProductThumbHtml } from './catalog-helpers.js';
import {
  SAMPLE_FLYER,
  PROMO_TYPE_LABEL,
  CHANNEL_LABEL,
  DAY_LIST,
  CARD_LIST,
  getChannelScope,
  computePromoLinkUpdate
} from './flyer-promo-helpers.js';
import {
  renderPromoAddDrawerHtml,
  renderPromoTypeMgrModalHtml,
  bindFlyerPromoModalEvents
} from './flyer-promo-modals.js';

let viewTab = 'RULES'; // 'RULES' | 'PROMO_PRODUCTS' | 'FLYER_IMPORT'
let selectedPromoId = '';
let promoProdQuery = '';
let promoProdL1Filter = 'ALL';
let promoProdL2Filter = 'ALL';
let promoProdL3Filter = 'ALL';
let promoProdPage = 1;
let promoProdPageSize = 10;
let flyerPreviewUrl = '';
let flyerImageFile = null;
let flyerDraftText = '';
let flyerPreviewData = null;
let scopeFilter = 'ALL'; // 'ALL' | 'ALL_CHANNELS' | 'ONLINE_ONLY' | 'POS_ONLY'
let promoRuleQuery = '';
let drawerOpen = false;
let typeMgrOpen = false;
let editingPromoId = '';
let cloneDraft = null;
const expandedPromoIds = new Set();

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
  const promoL2List = promoProdL1Filter !== 'ALL' ? getL2List(promoProdL1Filter) : [];
  const promoL3List = (promoProdL1Filter !== 'ALL' && promoProdL2Filter !== 'ALL') ? getL3List(promoProdL1Filter, promoProdL2Filter) : [];
  const candidateProducts = activePromo
    ? allProducts.filter(p => {
        if (p.applied_promo_id === activePromo.id) return false;
        const cat = inferCategoryFromProduct(p);
        if (promoProdL1Filter !== 'ALL' && cat.l1 !== promoProdL1Filter) return false;
        if (promoProdL2Filter !== 'ALL' && cat.l2 !== promoProdL2Filter) return false;
        if (promoProdL3Filter !== 'ALL' && cat.l3 !== promoProdL3Filter) return false;
        if (pq && !`${p.name} ${p.barcode} ${p.spec}`.toLowerCase().includes(pq)) return false;
        return true;
      })
    : [];
  const promoProdPg = paginateArray(candidateProducts, promoProdPage, promoProdPageSize);
  promoProdPage = promoProdPg.page;
  const pagedCandidateProducts = promoProdPg.paged;
  const rq = promoRuleQuery.trim().toLowerCase();
  const filtered = promotions.filter(pr => {
    if (scopeFilter !== 'ALL' && getChannelScope(pr) !== scopeFilter) return false;
    if (rq && !`${pr.name || ''} ${pr.promo_type || ''} ${typeLabelMap[pr.promo_type] || ''}`.toLowerCase().includes(rq)) return false;
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
              1. 행사 룰 관리 (${promotions.length})
            </button>
            <button type="button" class="btn-promo-tab" data-tab="PROMO_PRODUCTS" style="height: 30px; padding: 0 12px; border: none; border-radius: 7px; font-size: 12.5px; font-weight: 700; cursor: pointer; background: ${viewTab === 'PROMO_PRODUCTS' ? '#007749' : 'transparent'}; color: ${viewTab === 'PROMO_PRODUCTS' ? '#ffffff' : '#475569'};">
              2. 행사별 상품 연결 (${linkedProducts.length})
            </button>
            <button type="button" class="btn-promo-tab" data-tab="FLYER_IMPORT" style="height: 30px; padding: 0 12px; border: none; border-radius: 7px; font-size: 12.5px; font-weight: 700; cursor: pointer; background: ${viewTab === 'FLYER_IMPORT' ? '#007749' : 'transparent'}; color: ${viewTab === 'FLYER_IMPORT' ? '#ffffff' : '#475569'};">
              3. 전단 CSV · 배너 등록
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
              <input id="promo-rule-search" type="text" class="mc-search" style="width: 190px;" value="${esc(promoRuleQuery)}" placeholder="행사명 · 유형 검색" />
              <select id="promo-scope-filter" class="mc-select">
                <option value="ALL" ${scopeFilter === 'ALL' ? 'selected' : ''}>전체 채널 (${promotions.length})</option>
                <option value="ALL_CHANNELS" ${scopeFilter === 'ALL_CHANNELS' ? 'selected' : ''}>온·오프 공통</option>
                <option value="ONLINE_ONLY" ${scopeFilter === 'ONLINE_ONLY' ? 'selected' : ''}>온라인 전용</option>
                <option value="POS_ONLY" ${scopeFilter === 'POS_ONLY' ? 'selected' : ''}>오프라인 POS 전용</option>
              </select>
              <button type="button" class="mc-btn-secondary" id="btn-dl-promo-rules-csv" style="height: 32px; font-size: 12px;">할인 규칙 CSV 다운로드</button>
              <label class="mc-btn-secondary" style="height: 32px; font-size: 12px; display: inline-flex; align-items: center; cursor: pointer;">
                할인 규칙 일괄 수정(CSV)
                <input id="file-promo-rules-csv" type="file" accept=".csv,.tsv,.txt" style="display: none;" />
              </label>
            </div>
            <div style="font-size: 12px; color: #64748b;">조회 ${filtered.length}건 · [복제] 또는 CSV로 여러 행사 기간·할인율을 일괄 수정할 수 있습니다</div>
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
                  const linked = allProducts.filter(p => p.applied_promo_id === pr.id);
                  const isExpanded = expandedPromoIds.has(pr.id);
                  const curStatus = String(pr.status || 'ACTIVE').toUpperCase();
                  const isPaused = curStatus === 'PAUSED' || curStatus === 'ENDED';
                  return `
                    <tr style="${isPaused ? 'opacity: 0.72;' : ''}">
                      <td>
                        <button type="button" class="btn-toggle-promo-acc" data-id="${esc(pr.id)}" style="border: 0; background: none; padding: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; text-align: left;">
                          <span style="display: inline-block; width: 14px; font-size: 12px; color: #64748b;">${isExpanded ? '▾' : '▸'}</span>
                          <strong style="color: #0f172a;">${esc(pr.name)}</strong>
                          <span class="mc-pill ${curStatus === 'ACTIVE' ? 'mc-pill-green' : curStatus === 'PAUSED' ? 'mc-pill-amber' : 'mc-pill-gray'}" style="font-size: 10.5px;">${curStatus === 'ACTIVE' ? '진행중' : curStatus === 'PAUSED' ? '일시중지' : '종료'}</span>
                          <span class="mc-pill ${linked.length > 0 ? 'mc-pill-green' : 'mc-pill-gray'}" style="font-size: 11px;">연결 ${linked.length}건</span>
                        </button>
                      </td>
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
                        <button type="button" class="mc-row-edit-btn btn-toggle-promo-status" data-id="${esc(pr.id)}" data-status="${esc(curStatus)}" style="${isPaused ? 'border-color: #007749; color: #007749;' : 'border-color: #f59e0b; color: #b45309;'}">${isPaused ? '재개' : '중지'}</button>
                        <button type="button" class="mc-row-edit-btn btn-edit-promo" data-id="${esc(pr.id)}">수정</button>
                        <button type="button" class="mc-row-edit-btn btn-clone-promo" data-id="${esc(pr.id)}">복제</button>
                        <button type="button" class="mc-row-edit-btn btn-del-promo" data-id="${esc(pr.id)}" style="color: #b91c1c; border-color: #fecaca;">삭제</button>
                      </td>
                    </tr>
                    ${isExpanded ? `
                      <tr class="mc-promo-acc-row" style="background: #f8fafc;">
                        <td colspan="6" style="padding: 12px 18px 14px 36px; border-bottom: 1px solid #e2e8f0;">
                          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: 12px; font-weight: 700; color: #334155;">연결된 상품 (${linked.length}건) · 행사가를 바로 수정하거나 연결 해제할 수 있습니다</span>
                            <button type="button" class="mc-btn-secondary btn-go-link-promo" data-id="${esc(pr.id)}" style="height: 28px; padding: 0 10px; font-size: 11.5px; border-color: #007749; color: #007749;">+ 이 행사에 상품 추가</button>
                          </div>
                          ${linked.length === 0 ? `
                            <div style="padding: 14px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #fff; font-size: 12px; color: #64748b; text-align: center;">
                              연결된 상품이 없습니다. 우측 [+ 이 행사에 상품 추가] 버튼으로 상품을 연결하세요.
                            </div>
                          ` : `
                            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto;">
                              ${linked.map(p => `
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 10px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;">
                                  <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                                    ${renderProductThumbHtml(p.image_url, p.name, 36)}
                                    <div style="min-width: 0;">
                                      <div style="font-size: 12.5px; font-weight: 700; color: #0f172a;">${esc(p.name)}</div>
                                      <div style="font-size: 11px; color: #64748b;">${esc(p.spec || '-')} · 정상가 ${Number(p.regular_price || 0).toLocaleString()}원</div>
                                    </div>
                                  </div>
                                  <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                                    <span style="font-size: 11.5px; color: #64748b;">행사가</span>
                                    <input type="number" min="0" class="erp-input acc-sale-input" data-pid="${esc(p.id)}" value="${Number(p.sale_price ?? p.regular_price ?? 0)}" style="width: 96px; height: 28px; text-align: right; font-size: 12px;" />
                                    <span style="font-size: 11.5px; color: #64748b;">원</span>
                                    <button type="button" class="mc-btn-primary btn-acc-save-price" data-pid="${esc(p.id)}" style="height: 28px; padding: 0 10px; font-size: 11.5px;">적용</button>
                                    <button type="button" class="mc-row-edit-btn btn-unlink-promo-prod" data-id="${esc(p.id)}" style="color: #b91c1c; border-color: #fecaca;">해제</button>
                                  </div>
                                </div>
                              `).join('')}
                            </div>
                          `}
                        </td>
                      </tr>
                    ` : ''}
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
                          <div style="display: flex; align-items: center; gap: 10px;">
                            ${renderProductThumbHtml(p.image_url, p.name, 36)}
                            <div style="min-width: 0;">
                              <strong>${esc(p.name)}</strong>
                              <div style="font-size: 11.5px; color: #64748b;">${esc(p.spec || '-')} · ${esc(p.barcode)}</div>
                            </div>
                          </div>
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
                <select id="promo-prod-l1" class="mc-select" style="min-width: 110px;">
                  <option value="ALL" ${promoProdL1Filter === 'ALL' ? 'selected' : ''}>전체 대분류</option>
                  ${l1List.map(c => `<option value="${c.code}" ${promoProdL1Filter === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                </select>
                <select id="promo-prod-l2" class="mc-select" style="min-width: 125px;" ${promoProdL1Filter === 'ALL' ? 'disabled' : ''}>
                  <option value="ALL" ${promoProdL2Filter === 'ALL' ? 'selected' : ''}>전체 중분류</option>
                  ${promoL2List.map(c => `<option value="${c.code}" ${promoProdL2Filter === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                </select>
                <select id="promo-prod-l3" class="mc-select" style="min-width: 130px;" ${promoProdL2Filter === 'ALL' ? 'disabled' : ''}>
                  <option value="ALL" ${promoProdL3Filter === 'ALL' ? 'selected' : ''}>전체 소분류</option>
                  ${promoL3List.map(c => `<option value="${c.code}" ${promoProdL3Filter === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                </select>
                <input id="promo-prod-q" type="text" class="mc-search" value="${esc(promoProdQuery)}" placeholder="상품명 · 바코드 검색" style="min-width: 140px; flex: 1;" />
                <button type="button" class="mc-btn-primary" id="btn-link-selected-prods" style="height: 34px; font-size: 12.5px;">선택 상품 연결 (${candidateProducts.length})</button>
              </div>
              <div class="mc-table-wrap">
                <table class="mc-table">
                  <thead>
                    <tr><th style="width: 34px; text-align: center;"><input type="checkbox" id="chk-link-all-prods" title="전체 선택" /></th><th>상품명 · 규격</th><th style="text-align: right;">정상가</th></tr>
                  </thead>
                  <tbody>
                    ${pagedCandidateProducts.length === 0 ? `
                      <tr><td colspan="3" style="text-align: center; padding: 32px 12px; color: #64748b;">추가 연결 가능한 상품이 없습니다.</td></tr>
                    ` : pagedCandidateProducts.map(p => `
                      <tr>
                        <td style="text-align: center;"><input type="checkbox" class="chk-link-prod" data-id="${esc(p.id)}" /></td>
                        <td>
                          <div style="display: flex; align-items: center; gap: 10px;">
                            ${renderProductThumbHtml(p.image_url, p.name, 36)}
                            <div style="min-width: 0;">
                              <strong>${esc(p.name)}</strong>
                              <div style="font-size: 11.5px; color: #64748b;">${esc(p.spec || '-')} · ${esc(p.barcode)}</div>
                            </div>
                          </div>
                        </td>
                        <td class="mc-num">${Number(p.regular_price || 0).toLocaleString()}원</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              ${renderMartPaginationHtml(promoProdPg, 'fp')}
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

      ${drawerOpen ? renderPromoAddDrawerHtml({ d, editingPromoId, cloneDraft, activePromoTypes, typeLabelMap, today }) : ''}

      ${typeMgrOpen ? renderPromoTypeMgrModalHtml({ promoTypes, promotions }) : ''}
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
    promoProdL2Filter = 'ALL';
    promoProdL3Filter = 'ALL';
    promoProdPage = 1;
    renderMartFlyerView(container);
  });
  container.querySelector('#promo-prod-l2')?.addEventListener('change', (e) => {
    promoProdL2Filter = e.target.value;
    promoProdL3Filter = 'ALL';
    promoProdPage = 1;
    renderMartFlyerView(container);
  });
  container.querySelector('#promo-prod-l3')?.addEventListener('change', (e) => {
    promoProdL3Filter = e.target.value;
    promoProdPage = 1;
    renderMartFlyerView(container);
  });
  bindMartPaginationEvents(container, {
    prefix: 'fp',
    totalPages: promoProdPg.totalPages,
    onPageChange: (nextP) => { promoProdPage = nextP; renderMartFlyerView(container); },
    onSizeChange: (nextSz) => { promoProdPageSize = nextSz; promoProdPage = 1; renderMartFlyerView(container); }
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
  container.querySelectorAll('.btn-toggle-promo-acc').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (!id) return;
      if (expandedPromoIds.has(id)) expandedPromoIds.delete(id);
      else expandedPromoIds.add(id);
      renderMartFlyerView(container);
    });
  });
  container.querySelectorAll('.btn-go-link-promo').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPromoId = btn.dataset.id || '';
      viewTab = 'PROMO_PRODUCTS';
      renderMartFlyerView(container);
    });
  });
  container.querySelectorAll('.btn-acc-save-price').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.dataset.pid;
      const prod = allProducts.find(p => p.id === pid);
      const input = container.querySelector(`.acc-sale-input[data-pid="${pid}"]`);
      if (!prod || !input) return;
      const sale = Math.max(0, Number(input.value ?? 0));
      const reg = Math.max(0, Number(prod.regular_price || 0));
      const discPct = reg > 0 && sale < reg ? Math.round((1 - sale / reg) * 100) : 0;
      await martApi.bulkUpdateGrid([{ id: prod.id, sale_price: sale, discount_pct: discPct }]);
      showToast(`${prod.name} 행사가(${sale.toLocaleString()}원)가 반영되었습니다.`, 'success');
      await renderMartFlyerView(container);
    });
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
      if (btn.dataset.armed !== '1') {
        btn.dataset.armed = '1';
        btn.textContent = '삭제 확인';
        showToast('행사 룰을 삭제하려면 한 번 더 클릭하세요. 연결 상품 할인도 해제됩니다.', 'warn');
        return;
      }
      await martApi.deletePromotion(btn.dataset.id);
      if (selectedPromoId === btn.dataset.id) selectedPromoId = '';
      showToast('행사 룰이 삭제되었습니다.', 'success');
      await renderMartFlyerView(container);
    });
  });

  container.querySelector('#promo-rule-search')?.addEventListener('input', (e) => {
    promoRuleQuery = e.target.value;
    renderMartFlyerView(container, { focusId: 'promo-rule-search', cursorPos: e.target.selectionStart });
  });
  container.querySelectorAll('.btn-toggle-promo-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const cur = String(btn.dataset.status || 'ACTIVE').toUpperCase();
      const nextStatus = (cur === 'ACTIVE') ? 'PAUSED' : 'ACTIVE';
      await martApi.updatePromotion({ id, status: nextStatus });
      showToast(nextStatus === 'ACTIVE' ? '행사가 다시 시작되었습니다.' : '행사가 일시중지되었습니다.', 'success');
      await renderMartFlyerView(container);
    });
  });

  bindFlyerPromoModalEvents({
    container,
    martApi,
    promoTypes,
    editingPromoId,
    today,
    onCloseDrawer: () => {
      drawerOpen = false;
      editingPromoId = '';
      cloneDraft = null;
      renderMartFlyerView(container);
    },
    onCreatedAndLink: (newId) => {
      drawerOpen = false;
      editingPromoId = '';
      cloneDraft = null;
      selectedPromoId = newId;
      viewTab = 'PROMO_PRODUCTS';
      showToast('행사가 등록되었습니다. 아래에서 행사 상품을 바로 연결하세요.', 'success');
      renderMartFlyerView(container);
    },
    onOpenTypeMgr: () => {
      typeMgrOpen = true;
      renderMartFlyerView(container);
    },
    onCloseTypeMgr: () => {
      typeMgrOpen = false;
      renderMartFlyerView(container);
    },
    onReload: () => renderMartFlyerView(container)
  });

  container.querySelector('#btn-dl-promo-rules-csv')?.addEventListener('click', () => {
    downloadExcelCsv(
      `mart_promo_rules_${new Date().toISOString().slice(0, 10)}.csv`,
      ['규칙ID(수정시 유지/신규시 공란)', '행사명', '할인율(%)', '할인금액(원)', '묶음가(원)', '최대할인(원)', '한정수량(0=무제한)', '시작일', '종료일', '상태(ACTIVE/ENDED)'],
      filtered.map(pr => [
        pr.id,
        pr.name || '',
        pr.discount_pct ?? 0,
        pr.discount_amount ?? 0,
        pr.bundle_price ?? 0,
        pr.max_discount_amount ?? 0,
        pr.total_limit_qty ?? 0,
        pr.start_date || '',
        pr.end_date || '',
        pr.status || 'ACTIVE'
      ])
    );
  });
  container.querySelector('#file-promo-rules-csv')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readCsvOrTextFile(file);
    const rows = parseDelimitedRows(text).filter(c => {
      const col0 = String(c[0] || '').trim();
      const col1 = String(c[1] || '').trim();
      if (!col0 && !col1) return false;
      if (col0.startsWith('규칙ID')) return false;
      return true;
    });
    let createdCount = 0;
    let updatedCount = 0;
    for (const c of rows) {
      const id = String(c[0] || '').trim();
      const name = c[1] ? String(c[1]).trim() : '';
      const discount_pct = c[2] !== undefined && c[2] !== '' ? Number(c[2]) : undefined;
      const discount_amount = c[3] !== undefined && c[3] !== '' ? Number(c[3]) : undefined;
      const bundle_price = c[4] !== undefined && c[4] !== '' ? Number(c[4]) : undefined;
      const max_discount_amount = c[5] !== undefined && c[5] !== '' ? Number(c[5]) : undefined;
      const total_limit_qty = c[6] !== undefined && c[6] !== '' ? Number(c[6]) : undefined;
      const start_date = c[7] ? String(c[7]).trim() : undefined;
      const end_date = c[8] ? String(c[8]).trim() : undefined;
      const status = c[9] ? String(c[9]).trim().toUpperCase() : undefined;

      if (!id) {
        if (!name) continue;
        await martApi.createPromotion({
          name,
          promo_type: 'PRICE_DISCOUNT',
          calc_mode: (bundle_price && bundle_price > 0) ? 'BOGO_BUNDLE' : 'UNIT_DISCOUNT',
          discount_pct: discount_pct ?? 0,
          discount_amount: discount_amount ?? 0,
          bundle_price: bundle_price ?? 0,
          max_discount_amount: max_discount_amount ?? 0,
          total_limit_qty: total_limit_qty ?? 0,
          start_date: start_date || '',
          end_date: end_date || '',
          status: status || 'ACTIVE'
        });
        createdCount += 1;
        continue;
      }

      if (!promotions.some(p => p.id === id)) continue;
      await martApi.updatePromotion({
        id,
        name: name || undefined,
        discount_pct,
        discount_amount,
        bundle_price,
        max_discount_amount,
        total_limit_qty,
        start_date,
        end_date,
        status
      });
      updatedCount += 1;
    }
    showToast(`할인 규칙 신규 ${createdCount}건 등록, 기존 ${updatedCount}건 수정되었습니다.`, 'success');
    await renderMartFlyerView(container);
  });
}
