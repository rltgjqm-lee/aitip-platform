/**
 * AITIP Mart Portal - 1. 일반·신선 상품 & 일일시세 관리 모듈 (ESM)
 * 모던 커머스 어드민 UI: 읽기 중심 목록 + 다중 선택 일괄 액션 바 + 우측 슬라이드 드로어 편집
 */

import { martApi } from '../api.js';
import { fileToWebpDataUrl } from '../utils/media-webp.js';
import { getL1List, getL2List, getL3List, buildCategoryPath, inferCategoryFromProduct } from '../utils/mart-categories.js';
import { bindStopPropagation, showToast } from '../utils/html.js';
import { paginateArray, renderMartPaginationHtml, bindMartPaginationEvents } from '../utils/pagination.js';
import { bindCatalogMediaPicker } from './catalog-media-picker.js';
import { bindCatalogHaccpLookup } from './catalog-haccp-modal.js';
import { renderPosImportDrawerHtml, bindPosImportEvents } from './catalog-pos-import.js';
import {
  SAMPLE_POS_CSV,
  TYPE_LABEL,
  SOURCE_LABEL,
  PUBLISH_LABEL,
  escapeHtml,
  fmtWon,
  calcMarginPct,
  renderPublishPill,
  renderScopePill,
  BUNDLE_PROMO_TYPES,
  DAY_KO,
  computePromoApplication
} from './catalog-helpers.js';

let drawerMode = 'NONE'; // 'NONE' | 'EDIT' | 'IMPORT'
let uploadBatchType = 'BASE_PRODUCT'; // 'BASE_PRODUCT' | 'FLYER_PROMO' | 'DAILY_FRESH'
let editingProductId = '';
let cloneProductDraft = null;
let continueAddAfterSave = false;
let activeFilter = 'ALL';
let l1Filter = 'ALL';
let l2Filter = 'ALL';
let imageFilter = 'ALL'; // 'ALL' | 'HAS_IMG' | 'NO_IMG'
let quickImgProductId = '';
let searchQuery = '';
let sourceFilter = 'ALL';
let scopeFilter = 'ALL';
let publishFilter = 'ALL';
let stockFilter = 'ALL'; // 'ALL' | 'OK' | 'LOW' | 'OUT'
let promoFilter = 'ALL'; // 'ALL' | 'PROMO_ACTIVE'
let currentPage = 1;
let pageSize = 10;
let draftAppliedPromo = null;
let draftMedia = { media_id: '', image_url: '' };
const selectedIds = new Set();

export async function renderMartCatalogView(container, opts = {}) {
  if (!container) return;
  const data = await martApi.getCatalog();
  const baseProducts = (data.products || []).filter(p => p.category_type !== 'PREP_PROCESSED');
  const promotions = data.promotions || [];
  const editingProduct = editingProductId ? baseProducts.find(p => p.id === editingProductId) : null;
  const formProduct = editingProduct || cloneProductDraft;
  const editCat = formProduct
    ? (formProduct.category_l1
        ? { l1: formProduct.category_l1, l2: formProduct.category_l2 || '', l3: formProduct.category_l3 || '', path: buildCategoryPath(formProduct.category_l1, formProduct.category_l2, formProduct.category_l3) }
        : inferCategoryFromProduct(formProduct))
    : { l1: '01', l2: '0102', l3: '010202', path: buildCategoryPath('01', '0102', '010202') };
  const l1List = getL1List();
  const filterL2List = l1Filter !== 'ALL' ? getL2List(l1Filter) : [];

  const q = searchQuery.trim().toLowerCase();
  const filtered = baseProducts.filter(p => {
    const cat = inferCategoryFromProduct(p);
    if (l1Filter !== 'ALL' && cat.l1 !== l1Filter) return false;
    if (l2Filter !== 'ALL' && cat.l2 !== l2Filter) return false;
    if (activeFilter !== 'ALL' && p.category_type !== activeFilter) return false;
    if (sourceFilter !== 'ALL' && (p.fulfillment_source || 'MART_FLOOR') !== sourceFilter) return false;
    if (scopeFilter !== 'ALL' && (p.payment_scope || 'ONLINE_APPLICABLE') !== scopeFilter) return false;
    if (publishFilter !== 'ALL' && (p.online_publish_status || 'PUBLISHED_FEED') !== publishFilter) return false;
    const sq = Number(p.stock_qty ?? 50);
    const sf = Number(p.safety_stock ?? 5);
    if (stockFilter === 'OUT' && sq > 0) return false;
    if (stockFilter === 'LOW' && !(sq > 0 && sq <= sf)) return false;
    if (stockFilter === 'OK' && sq <= sf) return false;
    if (imageFilter === 'HAS_IMG' && !p.image_url) return false;
    if (imageFilter === 'NO_IMG' && p.image_url) return false;
    if (promoFilter === 'PROMO_ACTIVE' && !p.applied_promo_id && !(p.discount_pct > 0) && !p.promo_start) return false;
    if (promoFilter === 'PENDING_MART' && p.mart_approval_status !== 'PENDING_MART') return false;
    if (q && !`${p.barcode} ${p.name} ${p.spec} ${cat.path}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const pageInfo = paginateArray(filtered, currentPage, pageSize);
  currentPage = pageInfo.page;
  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));
  const curImgUrl = draftMedia.image_url || formProduct?.image_url || '';

  const initCost = Number(formProduct?.cost_price ?? 3500);
  const initReg = Number(formProduct?.regular_price ?? 4900);
  const initSale = Number(formProduct?.sale_price ?? formProduct?.regular_price ?? 4900);
  const initDisc = Number(formProduct?.discount_pct ?? (initReg > 0 && initSale < initReg ? Math.round((1 - initSale / initReg) * 100) : 0));
  const initMargin = calcMarginPct(initCost, initSale);

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- 상단 페이지 헤더 -->
      <div class="mc-page-header">
        <div class="mc-title-wrap">
          <h1>일반 · 신선 상품</h1>
          <span class="mc-count-pill">총 ${baseProducts.length}개</span>
        </div>
        <div class="mc-header-actions">
          <label class="mc-btn-secondary" style="display: inline-flex; align-items: center; cursor: pointer;" title="바코드.jpg 파일 여러 장을 선택해 자동 매칭">
            바코드 이미지 매칭
            <input id="batch-barcode-img-input" type="file" accept="image/*" multiple style="display: none;" />
          </label>
          <button type="button" class="mc-btn-secondary" id="btn-open-import">엑셀(CSV) 일괄 등록</button>
          <button type="button" class="mc-btn-primary" id="btn-open-add">+ 상품 등록</button>
          <button type="button" id="btn-catalog-help" title="사용 설명 보기" style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 800; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;">?</button>
          <input id="quick-row-img-input" type="file" accept="image/*" style="display: none;" />
        </div>
      </div>

      <div id="mc-catalog-help-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 1000; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: #ffffff; border-radius: 14px; max-width: 480px; width: 100%; padding: 20px; box-shadow: 0 20px 40px rgba(15, 23, 42, 0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
            <strong style="font-size: 15px; color: #0f172a;">일반 · 신선 상품 관리 사용 안내</strong>
            <button type="button" id="btn-close-catalog-help" style="border: none; background: none; font-size: 18px; color: #64748b; cursor: pointer;">×</button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12.5px; color: #334155; line-height: 1.6;">
            <div style="padding: 10px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <strong style="color: #007749;">1. 바코드 이미지 매칭</strong>
              <div>이미지 파일명을 <b>바코드.jpg</b> 또는 <b>상품명.png</b>로 맞춘 뒤 여러 장을 한 번에 선택하면, WebP로 자동 변환되어 일치하는 상품에 일괄 등록됩니다.</div>
            </div>
            <div style="padding: 10px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <strong style="color: #007749;">2. 엑셀(CSV) 일괄 등록</strong>
              <div>기본 상품표·전단 행사표·당일 신선 시세표를 CSV로 올려 여러 상품을 한 번에 등록하거나 갱신할 수 있습니다.</div>
            </div>
            <div style="padding: 10px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <strong style="color: #007749;">3. 빠른 이미지 교체 · 상세 수정</strong>
              <div>목록의 <b>+IMG(썸네일)</b>를 누르면 해당 상품 이미지만 즉시 교체되고, 상품 행을 클릭하면 우측 상세 수정 창이 열립니다.</div>
            </div>
          </div>
          <div style="margin-top: 14px; text-align: right;">
            <button type="button" class="mc-btn-primary" id="btn-ok-catalog-help">확인</button>
          </div>
        </div>
      </div>

      <!-- 메인 목록 카드 -->
      <div class="mc-surface">
        <div class="mc-filter-bar">
          <div class="mc-filter-controls">
            <input id="grid-filter-q" type="text" class="mc-search" value="${escapeHtml(searchQuery)}" placeholder="바코드 · 상품명 · 규격 · 분류 검색" />
            <select id="grid-filter-l1" class="mc-select">
              <option value="ALL" ${l1Filter === 'ALL' ? 'selected' : ''}>전체 대분류</option>
              ${l1List.map(c => `<option value="${c.code}" ${l1Filter === c.code ? 'selected' : ''}>${c.code} ${escapeHtml(c.name)}</option>`).join('')}
            </select>
            ${l1Filter !== 'ALL' ? `
              <select id="grid-filter-l2" class="mc-select">
                <option value="ALL" ${l2Filter === 'ALL' ? 'selected' : ''}>전체 중분류</option>
                ${filterL2List.map(c => `<option value="${c.code}" ${l2Filter === c.code ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
              </select>
            ` : ''}
            <select id="grid-filter-cat" class="mc-select">
              <option value="ALL" ${activeFilter === 'ALL' ? 'selected' : ''}>전체 운영구분</option>
              <option value="B2B_INDUSTRIAL" ${activeFilter === 'B2B_INDUSTRIAL' ? 'selected' : ''}>B2B 공산품</option>
              <option value="FRESH" ${activeFilter === 'FRESH' ? 'selected' : ''}>농·수산품</option>
              <option value="SUBSCRIPTION" ${activeFilter === 'SUBSCRIPTION' ? 'selected' : ''}>예약·정기</option>
            </select>
            <select id="grid-filter-pub" class="mc-select">
              <option value="ALL" ${publishFilter === 'ALL' ? 'selected' : ''}>전체 노출</option>
              <option value="PUBLISHED_FEED" ${publishFilter === 'PUBLISHED_FEED' ? 'selected' : ''}>홈 진열</option>
              <option value="SEARCH_ONLY" ${publishFilter === 'SEARCH_ONLY' ? 'selected' : ''}>검색 전용</option>
              <option value="SUSPENDED" ${publishFilter === 'SUSPENDED' ? 'selected' : ''}>노출 중지</option>
            </select>
            <select id="grid-filter-stock" class="mc-select">
              <option value="ALL" ${stockFilter === 'ALL' ? 'selected' : ''}>전체 재고</option>
              <option value="OK" ${stockFilter === 'OK' ? 'selected' : ''}>여유</option>
              <option value="LOW" ${stockFilter === 'LOW' ? 'selected' : ''}>곧 품절 (${baseProducts.filter(x => Number(x.stock_qty ?? 50) > 0 && Number(x.stock_qty ?? 50) <= Number(x.safety_stock ?? 5)).length})</option>
              <option value="OUT" ${stockFilter === 'OUT' ? 'selected' : ''}>품절 (${baseProducts.filter(x => Number(x.stock_qty ?? 50) <= 0).length})</option>
            </select>
            <select id="grid-filter-source" class="mc-select">
              <option value="ALL" ${sourceFilter === 'ALL' ? 'selected' : ''}>전체 거점</option>
              <option value="MART_FLOOR" ${sourceFilter === 'MART_FLOOR' ? 'selected' : ''}>마트 매장·창고</option>
              <option value="PREP_CENTER" ${sourceFilter === 'PREP_CENTER' ? 'selected' : ''}>전처리 작업장</option>
              <option value="DIRECT_SUPPLIER" ${sourceFilter === 'DIRECT_SUPPLIER' ? 'selected' : ''}>공급사·산지 직납</option>
            </select>
            <select id="grid-filter-scope" class="mc-select">
              <option value="ALL" ${scopeFilter === 'ALL' ? 'selected' : ''}>전체 결제</option>
              <option value="ONLINE_APPLICABLE" ${scopeFilter === 'ONLINE_APPLICABLE' ? 'selected' : ''}>온라인 적용</option>
              <option value="POS_ONLY" ${scopeFilter === 'POS_ONLY' ? 'selected' : ''}>POS 전용</option>
            </select>
            <select id="grid-filter-img" class="mc-select">
              <option value="ALL" ${imageFilter === 'ALL' ? 'selected' : ''}>전체 이미지</option>
              <option value="NO_IMG" ${imageFilter === 'NO_IMG' ? 'selected' : ''}>이미지 미등록</option>
              <option value="HAS_IMG" ${imageFilter === 'HAS_IMG' ? 'selected' : ''}>이미지 등록됨</option>
            </select>
            <select id="grid-filter-promo" class="mc-select">
              <option value="ALL" ${promoFilter === 'ALL' ? 'selected' : ''}>전체 행사</option>
              <option value="PROMO_ACTIVE" ${promoFilter === 'PROMO_ACTIVE' ? 'selected' : ''}>행사 적용중</option>
              <option value="PENDING_MART" ${promoFilter === 'PENDING_MART' ? 'selected' : ''}>본부 배포 승인대기 (${baseProducts.filter(x => x.mart_approval_status === 'PENDING_MART').length})</option>
            </select>
          </div>
          <div style="font-size: 12px; color: #64748b; white-space: nowrap;">
            조회 ${filtered.length}건 · 행 클릭 시 상세 수정
          </div>
        </div>

        ${selectedIds.size > 0 ? `
          <div class="mc-bulk-bar">
            <div class="mc-bulk-bar-left">
              <span>${selectedIds.size}개 상품 선택됨</span>
              <button type="button" class="mc-btn-secondary" id="btn-clear-sel" style="height: 28px; padding: 0 10px; font-size: 12px;">선택 해제</button>
            </div>
            <div class="mc-bulk-bar-actions">
              <select id="bulk-pub-select" class="mc-select" style="height: 30px; font-size: 12px;">
                <option value="">노출 일괄변경...</option>
                <option value="PUBLISHED_FEED">홈 진열</option>
                <option value="SEARCH_ONLY">검색 전용</option>
                <option value="SUSPENDED">노출 중지</option>
              </select>
              <select id="bulk-scope-select" class="mc-select" style="height: 30px; font-size: 12px;">
                <option value="">결제범위 일괄변경...</option>
                <option value="ONLINE_APPLICABLE">온라인 적용</option>
                <option value="POS_ONLY">현장 POS 전용</option>
              </select>
              <select id="bulk-promo-select" class="mc-select" style="height: 30px; font-size: 12px; max-width: 210px;">
                <option value="">행사 룰 일괄 적용...</option>
                ${promotions.map(pr => `<option value="${escapeHtml(pr.id)}">${escapeHtml(pr.name)}</option>`).join('')}
              </select>
              <button type="button" class="mc-btn-secondary" id="btn-bulk-promo-clear" style="height: 30px; padding: 0 10px; font-size: 12px;">행사 해제</button>
              <div style="display: flex; align-items: center; gap: 4px;">
                <input id="bulk-disc-input" type="number" min="0" max="99" placeholder="할인%" class="mc-select" style="width: 78px; height: 30px; font-size: 12px;" />
                <button type="button" class="mc-btn-primary" id="btn-bulk-disc-apply" style="height: 30px; padding: 0 10px; font-size: 12px;">할인 적용</button>
              </div>
            </div>
          </div>
        ` : ''}

        <div class="mc-table-wrap">
          <table class="mc-table">
            <thead>
              <tr>
                <th style="width: 38px; text-align: center;">
                  <input type="checkbox" id="chk-select-all" ${allFilteredSelected ? 'checked' : ''} />
                </th>
                <th>상품 정보</th>
                <th>분류 · 출고거점</th>
                <th style="text-align: right;">판매가 · 할인</th>
                <th style="text-align: center;">마진</th>
                <th style="text-align: right;">재고</th>
                <th>노출 · 결제</th>
                <th style="text-align: right;">관리</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 48px 16px; color: #64748b;">
                    조건에 맞는 상품이 없습니다. 필터를 변경하거나 새 상품을 등록해 주세요.
                  </td>
                </tr>
              ` : pageInfo.paged.map(p => {
                const cost = Number(p.cost_price ?? 0);
                const reg = Number(p.regular_price ?? 0);
                const sale = Number(p.sale_price ?? reg);
                const disc = Number(p.discount_pct ?? (reg > 0 && sale < reg ? Math.round((1 - sale / reg) * 100) : 0));
                const stock = Number(p.stock_qty ?? 50);
                const safety = Number(p.safety_stock ?? 5);
                const margin = calcMarginPct(cost, sale);
                const isNegativeMargin = sale < cost;
                const isLowStock = stock <= safety;
                const isChecked = selectedIds.has(p.id);
                const scope = p.payment_scope || 'ONLINE_APPLICABLE';
                const pub = p.online_publish_status || 'PUBLISHED_FEED';
                const src = p.fulfillment_source || 'MART_FLOOR';
                const catInfo = inferCategoryFromProduct(p);

                return `
                  <tr class="mc-prod-row ${isChecked ? 'is-selected' : ''}" data-id="${p.id}" style="cursor: pointer;">
                    <td class="mc-stop-prop" style="text-align: center;">
                      <input type="checkbox" class="chk-prod" data-id="${p.id}" ${isChecked ? 'checked' : ''} />
                    </td>
                    <td>
                      <div class="mc-prod-cell">
                        <div class="mc-thumb quick-thumb-upload mc-stop-prop" data-id="${p.id}" title="클릭하여 이미지 바로 등록/교체" style="cursor: pointer;">
                          ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="" />` : '<span style="color:#007749;">+IMG</span>'}
                        </div>
                        <div>
                          <div class="mc-prod-name">${escapeHtml(p.name)}</div>
                          <div class="mc-prod-sub">
                            ${escapeHtml(p.spec || '-')} · ${escapeHtml(p.uom || '개')} · ${p.tax_type === 'EXEMPT' ? '면세' : '과세'}
                            <span class="mc-prod-code" style="margin-left: 6px;">${escapeHtml(p.barcode)}</span>
                          </div>
                          ${p.promo_start || p.promo_end || p.applied_promo_name ? `
                            <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
                              ${p.applied_promo_name ? `<span class="mc-pill mc-pill-amber">룰: ${escapeHtml(p.applied_promo_name)}</span>` : ''}
                              ${p.promo_start || p.promo_end ? `<span class="mc-pill mc-pill-blue">행사 ${escapeHtml(p.promo_start || '-')} ~ ${escapeHtml(p.promo_end || '-')}</span>` : ''}
                              ${Array.isArray(p.promo_days_of_week) && p.promo_days_of_week.length > 0 ? `<span class="mc-pill mc-pill-gray">${p.promo_days_of_week.map(d => DAY_KO[d] || d).join('·')}</span>` : ''}
                              ${p.promo_limit_per_person ? `<span class="mc-pill mc-pill-red">1인 ${p.promo_limit_per_person}한정</span>` : ''}
                            </div>
                          ` : ''}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div><span class="mc-pill mc-pill-gray">${TYPE_LABEL[p.category_type] || p.category_type}</span></div>
                      <div style="font-size: 11.5px; color: #334155; font-weight: 600; margin-top: 4px;">${escapeHtml(catInfo.path)}</div>
                      <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">${SOURCE_LABEL[src] || src}</div>
                    </td>
                    <td class="mc-num">
                      <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                        ${disc > 0 ? `<span class="mc-pill mc-pill-amber">${disc}% 할인</span>` : ''}
                        <strong style="font-size: 14px; color: #0f172a;">${fmtWon(sale)}</strong>
                      </div>
                      <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">
                        ${disc > 0 ? `<span style="text-decoration: line-through; margin-right: 6px;">정상 ${fmtWon(reg)}</span>` : ''}
                        <span>원가 ${fmtWon(cost)}</span>
                      </div>
                    </td>
                    <td style="text-align: center;">
                      <span class="mc-pill ${isNegativeMargin ? 'mc-pill-red' : 'mc-pill-gray'}">
                        ${isNegativeMargin ? `역마진 ${margin}%` : `${margin}%`}
                      </span>
                    </td>
                    <td class="mc-num">
                      <span style="font-weight: 700; color: ${isLowStock ? '#b91c1c' : '#0f172a'};">${stock.toLocaleString()}</span>
                      <div style="font-size: 11px; color: ${isLowStock ? '#b91c1c' : '#94a3b8'};">
                        ${isLowStock ? `안전(${safety}) 미달` : `안전 ${safety}`}
                      </div>
                    </td>
                    <td>
                      <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                        ${renderPublishPill(pub)}
                        ${renderScopePill(scope, p.channel_scope)}
                        ${p.mart_approval_status === 'PENDING_MART' ? '<span class="mc-pill mc-pill-amber">본부 배포 승인대기</span>' : ''}
                        ${p.mart_approval_status === 'REJECTED' ? '<span class="mc-pill mc-pill-red">본부 배포 반려</span>' : ''}
                        ${p.pos_agency_tagged ? '<span class="mc-pill mc-pill-blue">POS 구매대행</span>' : ''}
                        ${Number(p.pos_price || 0) > 0 && Number(p.pos_price) !== sale ? `<span class="mc-pill mc-pill-red">POS가(${Number(p.pos_price).toLocaleString()}) 불일치</span>` : ''}
                      </div>
                    </td>
                    <td class="mc-stop-prop" style="text-align: right; white-space: nowrap;">
                      ${p.mart_approval_status === 'PENDING_MART' ? `
                        <button type="button" class="mc-btn-primary btn-mart-approve-prod" data-id="${p.id}" style="height: 26px; padding: 0 8px; font-size: 11.5px; margin-right: 4px;">취급 승인</button>
                        <button type="button" class="mc-btn-secondary btn-mart-reject-prod" data-id="${p.id}" style="height: 26px; padding: 0 8px; font-size: 11.5px; color: #b91c1c; margin-right: 4px;">반려</button>
                      ` : ''}
                      <button type="button" class="mc-row-edit-btn btn-clone-prod" data-id="${p.id}" style="margin-right: 4px;">복제</button>
                      <button type="button" class="mc-row-edit-btn btn-edit-prod" data-id="${p.id}">수정</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${renderMartPaginationHtml(pageInfo, 'cat')}
      </div>

      ${drawerMode === 'EDIT' ? `
        <div class="mc-drawer-backdrop" id="mc-drawer-backdrop">
          <form class="mc-drawer mc-drawer--wide" id="form-mart-add">
            <div class="mc-drawer-header">
              <h2>${editingProduct ? '상품 정보 수정' : cloneProductDraft?.name ? '상품 복제 등록' : '새 상품 등록'}</h2>
              <button type="button" class="mc-drawer-close" id="btn-close-drawer">×</button>
            </div>
            <div class="mc-drawer-body mc-drawer-grid-2">
              <div style="display: flex; flex-direction: column; gap: 16px;">
                <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">1. 표준 상품분류 (대 · 중 · 소) · 과면세</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="erp-field-label">대분류 *</label>
                    <select id="mp-cat-l1" class="erp-input">
                      ${l1List.map(c => `<option value="${c.code}" ${editCat.l1 === c.code ? 'selected' : ''}>${c.code} ${escapeHtml(c.name)}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">중분류 *</label>
                    <select id="mp-cat-l2" class="erp-input">
                      ${getL2List(editCat.l1).map(c => `<option value="${c.code}" ${editCat.l2 === c.code ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">소분류</label>
                    <select id="mp-cat-l3" class="erp-input">
                      ${getL3List(editCat.l1, editCat.l2 || getL2List(editCat.l1)[0]?.code).map(c => `<option value="${c.code}" ${editCat.l3 === c.code ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">과면세 구분 *</label>
                    <select id="mp-tax" class="erp-input">
                      <option value="EXEMPT" ${formProduct?.tax_type === 'EXEMPT' ? 'selected' : ''}>면세 (농·축·수산)</option>
                      <option value="TAXABLE" ${formProduct?.tax_type !== 'EXEMPT' ? 'selected' : ''}>과세 (가공·생활)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>2. 기본 정보</span>
                  <button type="button" id="btn-haccp-lookup" class="mc-btn-secondary" style="height: 26px; padding: 0 10px; font-size: 11.5px;">HACCP 공식 조회</button>
                </div>
                <div id="haccp-lookup-box" style="display: none; margin-bottom: 10px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; max-height: 180px; overflow-y: auto;"></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">상품명 *</label>
                    <input id="mp-name" type="text" required class="erp-input" value="${escapeHtml(formProduct?.name || '')}" placeholder="예: 국내산 세척당근(특) 또는 신라면 입력 후 HACCP 조회" />
                  </div>
                  <div>
                    <label class="erp-field-label">바코드 / PLU</label>
                    <input id="mp-barcode" type="text" class="erp-input" value="${escapeHtml(formProduct?.barcode || '')}" placeholder="880... 또는 200..." />
                  </div>
                  <div>
                    <label class="erp-field-label">규격 / 단량</label>
                    <input id="mp-spec" type="text" class="erp-input" value="${escapeHtml(formProduct?.spec || '')}" placeholder="1kg/봉" />
                  </div>
                  <div>
                    <label class="erp-field-label">단위 (UOM)</label>
                    <select id="mp-uom" class="erp-input">
                      ${['개', '봉', '단', '팩', '박스', '번들'].map(u => `<option value="${u}" ${formProduct?.uom === u ? 'selected' : ''}>${u}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">보관 구분</label>
                    <select id="mp-temp" class="erp-input">
                      <option value="AMBIENT" ${formProduct?.storage_temp === 'AMBIENT' ? 'selected' : ''}>상온</option>
                      <option value="REFRIGERATED" ${formProduct?.storage_temp === 'REFRIGERATED' ? 'selected' : ''}>냉장</option>
                      <option value="FROZEN" ${formProduct?.storage_temp === 'FROZEN' ? 'selected' : ''}>냉동</option>
                    </select>
                  </div>
                </div>
              </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>3. 기준 가격 · 재고 · 이미지</span>
                  <span id="mp-margin-preview" class="mc-pill ${initReg < initCost ? 'mc-pill-red' : 'mc-pill-green'}">
                    ${initReg < initCost ? `역마진 ${calcMarginPct(initCost, initReg)}%` : `기준 마진 ${calcMarginPct(initCost, initReg)}%`}
                  </span>
                </div>
                <div style="margin-bottom: 12px; padding: 8px 10px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 12px; color: #475569;">
                  B2C·B2B 가격/판매대상 배정은 <b>2. 판매 · 행사 적용 > B2C·B2B 판매·가격 배정</b>에서, 1+1·전단 할인은 <b>할인 / 전단일괄</b>에서 적용합니다.
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                  <div>
                    <label class="erp-field-label">매입원가 (원)</label>
                    <input id="mp-cost" type="number" min="0" value="${initCost}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">기준 판매가 · 정상가 (원) *</label>
                    <input id="mp-reg" type="number" min="1" required value="${initReg}" class="erp-input" style="font-weight: 700; border-color: #007749;" />
                  </div>
                  <div>
                    <label class="erp-field-label">현재 재고</label>
                    <input id="mp-stock" type="number" min="0" value="${Number(formProduct?.stock_qty ?? 50)}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">안전 재고</label>
                    <input id="mp-safety" type="number" min="0" value="${Number(formProduct?.safety_stock ?? 5)}" class="erp-input" />
                  </div>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 14px; padding-top: 12px; border-top: 1px solid #f1f5f9;">
                  <div id="mp-img-preview-box" style="width: 76px; height: 76px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                    ${curImgUrl
                      ? `<img src="${escapeHtml(curImgUrl)}" alt="상품 이미지" style="width: 100%; height: 100%; object-fit: cover;" />`
                      : `<span style="font-size: 11px; color: #94a3b8;">이미지 없음</span>`
                    }
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0;">
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                      <label class="mc-btn-secondary" style="display: inline-flex; align-items: center; cursor: pointer; height: 28px; padding: 0 10px; font-size: 11.5px;">
                        이미지 파일 선택 (WebP)
                        <input id="mp-img-file" type="file" accept="image/*" style="display: none;" />
                      </label>
                      <button type="button" id="btn-shared-img-search" class="mc-btn-secondary" style="height: 28px; padding: 0 10px; font-size: 11.5px; border-color: #007749; color: #007749;">공용 이미지 검색</button>
                      <button type="button" id="btn-web-img-google" class="mc-btn-secondary" style="height: 28px; padding: 0 10px; font-size: 11.5px;">구글 이미지 검색</button>
                      <button type="button" id="btn-web-img-naver" class="mc-btn-secondary" style="height: 28px; padding: 0 10px; font-size: 11.5px;">네이버 쇼핑 검색</button>
                    </div>
                    <div style="display: flex; gap: 6px;">
                      <input id="mp-img-url" type="url" class="erp-input" style="height: 28px; font-size: 11.5px; flex: 1;" placeholder="사진 우클릭 '이미지 주소 복사'(링크 주소 복사 X) 붙여넣기" />
                      <button type="button" id="btn-mp-img-url" class="mc-btn-secondary" style="height: 28px; padding: 0 10px; font-size: 11.5px; white-space: nowrap;">URL 붙여넣기</button>
                    </div>
                    <span id="mp-img-status" style="font-size: 11px; color: #64748b;">타사 워터마크·연출컷 금지 / 사진 위 우클릭 '이미지 복사' 후 Ctrl+V 또는 '이미지 주소 복사'(링크 주소 복사 아님) 사용</span>
                    <div id="shared-img-box" style="display: none; margin-top: 4px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; max-height: 180px; overflow-y: auto;"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="mc-drawer-footer">
              <button type="button" class="mc-btn-secondary" id="btn-cancel-drawer">취소</button>
              ${!editingProduct ? `<button type="button" class="mc-btn-secondary" id="btn-save-and-continue" style="border-color: #007749; color: #007749;">저장 후 계속 등록</button>` : ''}
              <button type="submit" class="mc-btn-primary">${editingProduct ? '수정 저장' : '상품 등록'}</button>
            </div>
          </form>
        </div>
      ` : ''}

      ${drawerMode === 'IMPORT' ? renderPosImportDrawerHtml(uploadBatchType) : ''}
    </div>
  `;

  // 필터 바 이벤트
  container.querySelector('#grid-filter-q')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderMartCatalogView(container, { focusId: 'grid-filter-q', cursorPos: e.target.selectionStart });
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
  container.querySelector('#grid-filter-l1')?.addEventListener('change', (e) => {
    l1Filter = e.target.value;
    l2Filter = 'ALL';
    renderMartCatalogView(container);
  });
  container.querySelector('#grid-filter-l2')?.addEventListener('change', (e) => {
    l2Filter = e.target.value;
    renderMartCatalogView(container);
  });
  container.querySelector('#grid-filter-cat')?.addEventListener('change', (e) => {
    activeFilter = e.target.value;
    renderMartCatalogView(container);
  });
  container.querySelector('#grid-filter-pub')?.addEventListener('change', (e) => {
    publishFilter = e.target.value;
    renderMartCatalogView(container);
  });
  container.querySelector('#grid-filter-stock')?.addEventListener('change', (e) => {
    stockFilter = e.target.value;
    renderMartCatalogView(container);
  });
  container.querySelector('#grid-filter-source')?.addEventListener('change', (e) => {
    sourceFilter = e.target.value;
    renderMartCatalogView(container);
  });
  container.querySelector('#grid-filter-scope')?.addEventListener('change', (e) => {
    scopeFilter = e.target.value;
    renderMartCatalogView(container);
  });
  container.querySelector('#grid-filter-img')?.addEventListener('change', (e) => {
    imageFilter = e.target.value;
    renderMartCatalogView(container);
  });
  container.querySelector('#grid-filter-promo')?.addEventListener('change', (e) => {
    promoFilter = e.target.value;
    renderMartCatalogView(container);
  });
  container.querySelectorAll('.btn-mart-approve-prod').forEach(btn => {
    btn.addEventListener('click', async () => {
      await martApi.decideProductApproval({ product_id: btn.dataset.id, decision: 'APPROVED' });
      await renderMartCatalogView(container);
    });
  });
  container.querySelectorAll('.btn-mart-reject-prod').forEach(btn => {
    btn.addEventListener('click', async () => {
      await martApi.decideProductApproval({ product_id: btn.dataset.id, decision: 'REJECTED' });
      await renderMartCatalogView(container);
    });
  });

  const helpModal = container.querySelector('#mc-catalog-help-modal');
  container.querySelector('#btn-catalog-help')?.addEventListener('click', () => {
    if (helpModal) helpModal.style.display = 'flex';
  });
  const closeHelp = () => { if (helpModal) helpModal.style.display = 'none'; };
  container.querySelector('#btn-close-catalog-help')?.addEventListener('click', closeHelp);
  container.querySelector('#btn-ok-catalog-help')?.addEventListener('click', closeHelp);
  helpModal?.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });

  // 목록 썸네일 클릭 즉시 이미지 보정 업로드 (WebP)
  const quickImgInput = container.querySelector('#quick-row-img-input');
  container.querySelectorAll('.quick-thumb-upload').forEach(el => {
    el.addEventListener('click', () => {
      quickImgProductId = el.dataset.id;
      if (quickImgInput) {
        quickImgInput.value = '';
        quickImgInput.click();
      }
    });
  });
  quickImgInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file || !quickImgProductId) return;
    const webpDataUrl = await fileToWebpDataUrl(file);
    const uploaded = await martApi.uploadMedia({ data_url: webpDataUrl, original_name: file.name });
    await martApi.updateProduct({
      id: quickImgProductId,
      media_id: uploaded.media_id,
      image_url: uploaded.image_url
    });
    quickImgProductId = '';
    await renderMartCatalogView(container);
  });

  // 바코드 파일명 다중 이미지 일괄 매칭 (예: 8801007052120.jpg)
  container.querySelector('#batch-barcode-img-input')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    let matchedCount = 0;
    for (const file of files) {
      const stem = file.name.replace(/\.[^.]+$/, '').trim();
      const target = baseProducts.find(p => p.barcode === stem || p.name === stem);
      if (!target) continue;
      const webpDataUrl = await fileToWebpDataUrl(file);
      const uploaded = await martApi.uploadMedia({ data_url: webpDataUrl, original_name: file.name });
      await martApi.updateProduct({
        id: target.id,
        media_id: uploaded.media_id,
        image_url: uploaded.image_url
      });
      matchedCount += 1;
    }
    e.target.value = '';
    if (matchedCount > 0) await renderMartCatalogView(container);
  });

  // 체크박스 다중 선택 & 일괄 수정
  container.querySelector('#chk-select-all')?.addEventListener('change', (e) => {
    if (e.target.checked) filtered.forEach(p => selectedIds.add(p.id));
    else filtered.forEach(p => selectedIds.delete(p.id));
    renderMartCatalogView(container);
  });
  container.querySelectorAll('.chk-prod').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      renderMartCatalogView(container);
    });
  });
  container.querySelector('#btn-clear-sel')?.addEventListener('click', () => {
    selectedIds.clear();
    renderMartCatalogView(container);
  });
  container.querySelector('#bulk-pub-select')?.addEventListener('change', async (e) => {
    const val = e.target.value;
    if (!val || selectedIds.size === 0) return;
    await martApi.bulkUpdateGrid(Array.from(selectedIds).map(id => ({ id, online_publish_status: val })));
    selectedIds.clear();
    await renderMartCatalogView(container);
  });
  container.querySelector('#bulk-scope-select')?.addEventListener('change', async (e) => {
    const val = e.target.value;
    if (!val || selectedIds.size === 0) return;
    await martApi.bulkUpdateGrid(Array.from(selectedIds).map(id => ({ id, payment_scope: val })));
    selectedIds.clear();
    await renderMartCatalogView(container);
  });
  container.querySelector('#bulk-promo-select')?.addEventListener('change', async (e) => {
    const pid = e.target.value;
    const promo = promotions.find(pr => pr.id === pid);
    if (!promo || selectedIds.size === 0) return;
    const updates = Array.from(selectedIds).map(id => {
      const prod = baseProducts.find(p => p.id === id);
      const reg = Number(prod?.regular_price || 0);
      return { id, ...computePromoApplication(promo, reg) };
    });
    await martApi.bulkUpdateGrid(updates);
    selectedIds.clear();
    await renderMartCatalogView(container);
  });
  container.querySelector('#btn-bulk-promo-clear')?.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    const updates = Array.from(selectedIds).map(id => {
      const prod = baseProducts.find(p => p.id === id);
      return { id, ...computePromoApplication(null, Number(prod?.regular_price || 0)) };
    });
    await martApi.bulkUpdateGrid(updates);
    selectedIds.clear();
    await renderMartCatalogView(container);
  });
  container.querySelector('#btn-bulk-disc-apply')?.addEventListener('click', async () => {
    const raw = container.querySelector('#bulk-disc-input')?.value;
    if (raw === '' || raw === undefined || selectedIds.size === 0) return;
    const disc = Math.max(0, Math.min(99, Number(raw)));
    await martApi.bulkUpdateGrid(Array.from(selectedIds).map(id => ({ id, discount_pct: disc })));
    selectedIds.clear();
    await renderMartCatalogView(container);
  });

  // 드로어 열기 / 닫기
  container.querySelector('#btn-open-add')?.addEventListener('click', () => {
    editingProductId = '';
    cloneProductDraft = null;
    continueAddAfterSave = false;
    draftMedia = { media_id: '', image_url: '' };
    drawerMode = 'EDIT';
    renderMartCatalogView(container);
  });
  container.querySelector('#btn-open-import')?.addEventListener('click', () => {
    drawerMode = 'IMPORT';
    renderMartCatalogView(container);
  });
  const openEditDrawer = (id) => {
    editingProductId = id;
    cloneProductDraft = null;
    continueAddAfterSave = false;
    draftMedia = { media_id: '', image_url: '' };
    drawerMode = 'EDIT';
    renderMartCatalogView(container);
  };
  container.querySelectorAll('.btn-edit-prod').forEach(btn => {
    btn.addEventListener('click', () => openEditDrawer(btn.dataset.id));
  });
  container.querySelectorAll('.btn-clone-prod').forEach(btn => {
    btn.addEventListener('click', () => {
      const src = baseProducts.find(p => p.id === btn.dataset.id);
      if (!src) return;
      const cat = inferCategoryFromProduct(src);
      editingProductId = '';
      continueAddAfterSave = false;
      cloneProductDraft = {
        ...src,
        id: undefined,
        barcode: '',
        name: `${src.name || ''} (복제)`.trim(),
        category_l1: src.category_l1 || cat.l1,
        category_l2: src.category_l2 || cat.l2,
        category_l3: src.category_l3 || cat.l3
      };
      draftMedia = { media_id: src.media_id || '', image_url: src.image_url || '' };
      drawerMode = 'EDIT';
      renderMartCatalogView(container, { focusId: 'mp-name' });
    });
  });
  bindStopPropagation(container);
  bindMartPaginationEvents(container, {
    prefix: 'cat',
    totalPages: pageInfo.totalPages,
    onPageChange: (nextP) => { currentPage = nextP; renderMartCatalogView(container); },
    onSizeChange: (nextSz) => { pageSize = nextSz; currentPage = 1; renderMartCatalogView(container); }
  });
  container.querySelectorAll('.mc-prod-row').forEach(row => {
    row.addEventListener('click', () => openEditDrawer(row.dataset.id));
  });

  const closeDrawer = () => {
    drawerMode = 'NONE';
    editingProductId = '';
    cloneProductDraft = null;
    continueAddAfterSave = false;
    draftAppliedPromo = null;
    draftMedia = { media_id: '', image_url: '' };
    renderMartCatalogView(container);
  };
  container.querySelector('#btn-close-drawer')?.addEventListener('click', closeDrawer);
  container.querySelector('#btn-cancel-drawer')?.addEventListener('click', closeDrawer);
  container.querySelector('#mc-drawer-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-drawer-backdrop') closeDrawer();
  });

  // 드로어 내 이미지 업로드 · 외부 URL WebP 변환 · 공용 이미지 풀 검색 (catalog-media-picker.js)
  const { importExternalUrlAsWebp } = bindCatalogMediaPicker({
    container,
    martApi,
    fileToWebpDataUrl,
    onMediaSelected: (nextMedia) => { draftMedia = nextMedia; }
  });

  // 드로어 내 원가 <-> 기준 판매가 실시간 마진율 미리보기
  const mpCost = container.querySelector('#mp-cost');
  const mpReg = container.querySelector('#mp-reg');
  const mpMarginBadge = container.querySelector('#mp-margin-preview');

  const refreshMarginPreview = () => {
    if (!mpMarginBadge || !mpCost || !mpReg) return;
    const c = Number(mpCost.value || 0);
    const r = Number(mpReg.value || 0);
    const m = calcMarginPct(c, r);
    const neg = r < c;
    mpMarginBadge.className = `mc-pill ${neg ? 'mc-pill-red' : 'mc-pill-green'}`;
    mpMarginBadge.textContent = neg ? `역마진 ${m}%` : `기준 마진 ${m}%`;
  };
  mpCost?.addEventListener('input', refreshMarginPreview);
  mpReg?.addEventListener('input', refreshMarginPreview);

  // 드로어 내 대/중/소분류 3단 연동
  const mpL1 = container.querySelector('#mp-cat-l1');
  const mpL2 = container.querySelector('#mp-cat-l2');
  const mpL3 = container.querySelector('#mp-cat-l3');
  const mpTax = container.querySelector('#mp-tax');

  const syncL3Options = () => {
    if (!mpL1 || !mpL2 || !mpL3) return;
    const l3s = getL3List(mpL1.value, mpL2.value);
    mpL3.innerHTML = l3s.map(c => `<option value="${c.code}">${escapeHtml(c.name)}</option>`).join('');
  };
  mpL1?.addEventListener('change', () => {
    if (!mpL2) return;
    const l2s = getL2List(mpL1.value);
    mpL2.innerHTML = l2s.map(c => `<option value="${c.code}">${escapeHtml(c.name)}</option>`).join('');
    syncL3Options();
    const l1Obj = l1List.find(c => c.code === mpL1.value);
    if (l1Obj && !editingProductId && mpTax) {
      mpTax.value = l1Obj.default_tax_type;
    }
  });
  mpL2?.addEventListener('change', syncL3Options);

  // HACCP 공식 제품이미지 · 규격 조회 및 와이드 모달 (catalog-haccp-modal.js)
  bindCatalogHaccpLookup({
    container,
    martApi,
    mpL1,
    mpL2,
    importExternalUrlAsWebp,
    onMediaSelected: (nextMedia) => { draftMedia = nextMedia; }
  });

  // 드로어 내 저장된 행사 룰 불러와 원클릭 자동 채움
  const mpApplyPromo = container.querySelector('#mp-apply-promo');
  const mpPromoSummary = container.querySelector('#mp-promo-summary');
  mpApplyPromo?.addEventListener('change', () => {
    const promo = promotions.find(pr => pr.id === mpApplyPromo.value);
    const regVal = Number(container.querySelector('#mp-reg')?.value || 0);
    const applied = computePromoApplication(promo || null, regVal);
    draftAppliedPromo = applied;
    const discEl = container.querySelector('#mp-disc');
    const priceEl = container.querySelector('#mp-price');
    const startEl = container.querySelector('#mp-pstart');
    const endEl = container.querySelector('#mp-pend');
    const scopeEl = container.querySelector('#mp-scope');
    if (discEl) discEl.value = applied.discount_pct;
    if (priceEl) priceEl.value = applied.sale_price;
    if (startEl && applied.promo_start) startEl.value = applied.promo_start;
    if (endEl && applied.promo_end) endEl.value = applied.promo_end;
    if (scopeEl && applied.channel_scope) scopeEl.value = applied.channel_scope;
    if (mpPromoSummary) {
      mpPromoSummary.textContent = promo
        ? `적용됨: ${promo.name}${promo.max_discount_amount ? ` (최대 ${Number(promo.max_discount_amount).toLocaleString()}원 한도)` : ''}`
        : '행사 룰 연결 해제됨';
    }
    const cVal = Number(container.querySelector('#mp-cost')?.value || 0);
    const badge = container.querySelector('#mp-margin-preview');
    if (badge) {
      const m = calcMarginPct(cVal, applied.sale_price);
      const neg = applied.sale_price < cVal;
      badge.className = `mc-pill ${neg ? 'mc-pill-red' : 'mc-pill-green'}`;
      badge.textContent = neg ? `역마진 ${m}%` : `예상 마진 ${m}%`;
    }
  });

  container.querySelector('#btn-save-and-continue')?.addEventListener('click', () => {
    continueAddAfterSave = true;
    container.querySelector('#form-mart-add')?.requestSubmit();
  });

  // 단건 등록/수정 저장 (상품 마스터 기본정보만 저장, 기존 판매/행사 배정값 보존)
  container.querySelector('#form-mart-add')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const shouldContinue = continueAddAfterSave && !editingProductId;
    continueAddAfterSave = false;
    const l1 = mpL1?.value || '';
    const l2 = mpL2?.value || '';
    const l3 = mpL3?.value || '';
    const regPrice = Math.max(0, Number(container.querySelector('#mp-reg')?.value ?? 0));
    const payload = {
      id: editingProductId || undefined,
      category_l1: l1,
      category_l2: l2,
      category_l3: l3,
      category_path: buildCategoryPath(l1, l2, l3) || '-',
      tax_type: mpTax?.value || 'TAXABLE',
      category_type: editingProduct?.category_type === 'SUBSCRIPTION'
        ? 'SUBSCRIPTION'
        : (l1List.find(c => c.code === l1)?.default_category_type || 'B2B_INDUSTRIAL'),
      barcode: container.querySelector('#mp-barcode')?.value?.trim(),
      name: container.querySelector('#mp-name')?.value?.trim(),
      spec: container.querySelector('#mp-spec')?.value?.trim(),
      uom: container.querySelector('#mp-uom')?.value,
      storage_temp: container.querySelector('#mp-temp')?.value || 'AMBIENT',
      media_id: draftMedia.media_id || formProduct?.media_id || '',
      image_url: draftMedia.image_url || formProduct?.image_url || '',
      cost_price: Math.max(0, Number(container.querySelector('#mp-cost')?.value ?? 0)),
      regular_price: regPrice,
      stock_qty: Math.max(0, Number(container.querySelector('#mp-stock')?.value ?? 50)),
      safety_stock: Math.max(0, Number(container.querySelector('#mp-safety')?.value ?? 5))
    };
    if (!editingProductId) {
      payload.sale_price = regPrice;
      payload.sales_target = 'BOTH';
      payload.online_publish_status = 'PUBLISHED_FEED';
    } else if (!editingProduct?.applied_promo_id) {
      payload.sale_price = regPrice;
    }
    if (editingProductId) await martApi.updateProduct(payload);
    else await martApi.addProduct(payload);

    if (shouldContinue) {
      // 대/중/소분류·과면세·단위·보관구분·재고 기본값은 유지하고 상품명·바코드·규격·이미지 비워 연속 등록
      cloneProductDraft = {
        category_l1: l1,
        category_l2: l2,
        category_l3: l3,
        tax_type: payload.tax_type,
        uom: payload.uom,
        storage_temp: payload.storage_temp,
        cost_price: payload.cost_price,
        regular_price: payload.regular_price,
        stock_qty: payload.stock_qty,
        safety_stock: payload.safety_stock,
        name: '',
        barcode: '',
        spec: '',
        media_id: '',
        image_url: ''
      };
      draftMedia = { media_id: '', image_url: '' };
      drawerMode = 'EDIT';
      showToast(`"${payload.name}" 등록 완료 — 같은 분류로 다음 상품을 이어서 등록하세요.`, 'success');
      await renderMartCatalogView(container, { focusId: 'mp-name' });
      return;
    }

    drawerMode = 'NONE';
    editingProductId = '';
    cloneProductDraft = null;
    draftAppliedPromo = null;
    draftMedia = { media_id: '', image_url: '' };
    await renderMartCatalogView(container);
  });

  // POS 엑셀(CSV) 일괄 등록 이벤트 (catalog-pos-import.js)
  bindPosImportEvents({
    container,
    martApi,
    sampleCsv: SAMPLE_POS_CSV,
    setUploadBatchType: (nextType) => { uploadBatchType = nextType; },
    onImportComplete: async () => {
      drawerMode = 'NONE';
      await renderMartCatalogView(container);
    }
  });
}
