/**
 * AITIP Mart Portal - 1. 일반·신선 상품 & 일일시세 관리 모듈 (ESM)
 * 모던 커머스 어드민 UI: 읽기 중심 목록 + 다중 선택 일괄 액션 바 + 우측 슬라이드 드로어 편집
 */

import { martApi } from '../api.js';
import { fileToWebpDataUrl } from '../utils/media-webp.js';
import { getL1List, getL2List, getL3List, buildCategoryPath, inferCategoryFromProduct } from '../utils/mart-categories.js';
import { downloadExcelCsv, readCsvOrTextFile, parseDelimitedRows } from '../utils/excel-csv.js';
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
let activeFilter = 'ALL';
let l1Filter = 'ALL';
let l2Filter = 'ALL';
let imageFilter = 'ALL'; // 'ALL' | 'HAS_IMG' | 'NO_IMG'
let quickImgProductId = '';
let searchQuery = '';
let sourceFilter = 'ALL';
let scopeFilter = 'ALL';
let publishFilter = 'ALL';
let promoFilter = 'ALL'; // 'ALL' | 'PROMO_ACTIVE'
let draftAppliedPromo = null;
let draftMedia = { media_id: '', image_url: '' };
const selectedIds = new Set();

export async function renderMartCatalogView(container, opts = {}) {
  if (!container) return;
  const data = await martApi.getCatalog();
  const baseProducts = (data.products || []).filter(p => p.category_type !== 'PREP_PROCESSED');
  const promotions = data.promotions || [];
  const editingProduct = editingProductId ? baseProducts.find(p => p.id === editingProductId) : null;
  const editCat = editingProduct ? inferCategoryFromProduct(editingProduct) : { l1: '01', l2: '0102', l3: '010202', path: buildCategoryPath('01', '0102', '010202') };
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
    if (imageFilter === 'HAS_IMG' && !p.image_url) return false;
    if (imageFilter === 'NO_IMG' && p.image_url) return false;
    if (promoFilter === 'PROMO_ACTIVE' && !p.applied_promo_id && !(p.discount_pct > 0) && !p.promo_start) return false;
    if (promoFilter === 'PENDING_MART' && p.mart_approval_status !== 'PENDING_MART') return false;
    if (q && !`${p.barcode} ${p.name} ${p.spec} ${cat.path}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));
  const curImgUrl = draftMedia.image_url || editingProduct?.image_url || '';

  const initCost = Number(editingProduct?.cost_price ?? 3500);
  const initReg = Number(editingProduct?.regular_price ?? 4900);
  const initSale = Number(editingProduct?.sale_price ?? editingProduct?.regular_price ?? 4900);
  const initDisc = Number(editingProduct?.discount_pct ?? (initReg > 0 && initSale < initReg ? Math.round((1 - initSale / initReg) * 100) : 0));
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
          <input id="quick-row-img-input" type="file" accept="image/*" style="display: none;" />
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
              ` : filtered.map(p => {
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
                    <td style="text-align: center;" onclick="event.stopPropagation()">
                      <input type="checkbox" class="chk-prod" data-id="${p.id}" ${isChecked ? 'checked' : ''} />
                    </td>
                    <td>
                      <div class="mc-prod-cell">
                        <div class="mc-thumb quick-thumb-upload" data-id="${p.id}" onclick="event.stopPropagation()" title="클릭하여 이미지 바로 등록/교체" style="cursor: pointer;">
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
                    <td style="text-align: right; white-space: nowrap;" onclick="event.stopPropagation()">
                      ${p.mart_approval_status === 'PENDING_MART' ? `
                        <button type="button" class="mc-btn-primary btn-mart-approve-prod" data-id="${p.id}" style="height: 26px; padding: 0 8px; font-size: 11.5px; margin-right: 4px;">취급 승인</button>
                        <button type="button" class="mc-btn-secondary btn-mart-reject-prod" data-id="${p.id}" style="height: 26px; padding: 0 8px; font-size: 11.5px; color: #b91c1c; margin-right: 4px;">반려</button>
                      ` : ''}
                      <button type="button" class="mc-row-edit-btn btn-edit-prod" data-id="${p.id}">수정</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${drawerMode === 'EDIT' ? `
        <div class="mc-drawer-backdrop" id="mc-drawer-backdrop">
          <form class="mc-drawer" id="form-mart-add">
            <div class="mc-drawer-header">
              <h2>${editingProduct ? '상품 정보 수정' : '새 상품 등록'}</h2>
              <button type="button" class="mc-drawer-close" id="btn-close-drawer">×</button>
            </div>
            <div class="mc-drawer-body">
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
                      <option value="EXEMPT" ${editingProduct?.tax_type === 'EXEMPT' ? 'selected' : ''}>면세 (농·축·수산)</option>
                      <option value="TAXABLE" ${editingProduct?.tax_type !== 'EXEMPT' ? 'selected' : ''}>과세 (가공·생활)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">2. 기본 정보</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">상품명 *</label>
                    <input id="mp-name" type="text" required class="erp-input" value="${escapeHtml(editingProduct?.name || '')}" placeholder="예: 국내산 세척당근(특)" />
                  </div>
                  <div>
                    <label class="erp-field-label">바코드 / PLU</label>
                    <input id="mp-barcode" type="text" class="erp-input" value="${escapeHtml(editingProduct?.barcode || '')}" placeholder="880... 또는 200..." />
                  </div>
                  <div>
                    <label class="erp-field-label">규격 / 단량</label>
                    <input id="mp-spec" type="text" class="erp-input" value="${escapeHtml(editingProduct?.spec || '')}" placeholder="1kg/봉" />
                  </div>
                  <div>
                    <label class="erp-field-label">단위 (UOM)</label>
                    <select id="mp-uom" class="erp-input">
                      ${['개', '봉', '단', '팩', '박스', '번들'].map(u => `<option value="${u}" ${editingProduct?.uom === u ? 'selected' : ''}>${u}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">보관 구분</label>
                    <select id="mp-temp" class="erp-input">
                      <option value="AMBIENT" ${editingProduct?.storage_temp === 'AMBIENT' ? 'selected' : ''}>상온</option>
                      <option value="REFRIGERATED" ${editingProduct?.storage_temp === 'REFRIGERATED' ? 'selected' : ''}>냉장</option>
                      <option value="FROZEN" ${editingProduct?.storage_temp === 'FROZEN' ? 'selected' : ''}>냉동</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>3. 가격 · 할인 · 행사기간 · 재고</span>
                  <span id="mp-margin-preview" class="mc-pill ${initSale < initCost ? 'mc-pill-red' : 'mc-pill-green'}">
                    ${initSale < initCost ? `역마진 ${initMargin}%` : `예상 마진 ${initMargin}%`}
                  </span>
                </div>
                <div style="margin-bottom: 12px;">
                  <label class="erp-field-label">저장된 행사 룰 불러와 적용 (선택 시 가격·기간·채널 자동 채움)</label>
                  <select id="mp-apply-promo" class="erp-input" style="border-color: #cbd5e1; background: #f8fafc;">
                    <option value="">-- 직접 입력 (행사 룰 미연결) --</option>
                    ${promotions.map(pr => `<option value="${escapeHtml(pr.id)}" ${editingProduct?.applied_promo_id === pr.id ? 'selected' : ''}>${escapeHtml(pr.name)}</option>`).join('')}
                  </select>
                  <div id="mp-promo-summary" style="font-size: 11.5px; color: #0369a1; margin-top: 4px;">
                    ${editingProduct?.applied_promo_name ? `적용중: ${escapeHtml(editingProduct.applied_promo_name)}` : ''}
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="erp-field-label">매입원가 (원)</label>
                    <input id="mp-cost" type="number" min="0" value="${initCost}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">정상판매가 (원) *</label>
                    <input id="mp-reg" type="number" min="1" required value="${initReg}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">할인율 (%)</label>
                    <input id="mp-disc" type="number" min="0" max="99" value="${initDisc}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">최종 행사가 (원) *</label>
                    <input id="mp-price" type="number" min="0" required value="${initSale}" class="erp-input" style="font-weight: 700; border-color: #007749;" />
                  </div>
                  <div>
                    <label class="erp-field-label">행사 시작일</label>
                    <input id="mp-pstart" type="date" value="${escapeHtml(editingProduct?.promo_start || '')}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">행사 종료일</label>
                    <input id="mp-pend" type="date" value="${escapeHtml(editingProduct?.promo_end || '')}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">현재 재고</label>
                    <input id="mp-stock" type="number" min="0" value="${Number(editingProduct?.stock_qty ?? 50)}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">안전 재고</label>
                    <input id="mp-safety" type="number" min="0" value="${Number(editingProduct?.safety_stock ?? 5)}" class="erp-input" />
                  </div>
                </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">4. 출고 거점 · 노출 · 결제 · 이미지</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                  <div>
                    <label class="erp-field-label">출고 거점</label>
                    <select id="mp-src" class="erp-input">
                      ${Object.entries(SOURCE_LABEL).map(([k, lbl]) => `<option value="${k}" ${editingProduct?.fulfillment_source === k ? 'selected' : ''}>${lbl}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">온라인 노출</label>
                    <select id="mp-pub" class="erp-input">
                      <option value="PUBLISHED_FEED" ${editingProduct?.online_publish_status === 'PUBLISHED_FEED' ? 'selected' : ''}>홈 진열</option>
                      <option value="SEARCH_ONLY" ${editingProduct?.online_publish_status === 'SEARCH_ONLY' ? 'selected' : ''}>검색 전용</option>
                      <option value="SUSPENDED" ${editingProduct?.online_publish_status === 'SUSPENDED' ? 'selected' : ''}>노출 중지</option>
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">결제 범위</label>
                    <select id="mp-scope" class="erp-input">
                      <option value="ALL_CHANNELS" ${(editingProduct?.channel_scope || (editingProduct?.payment_scope === 'POS_ONLY' ? 'POS_ONLY' : 'ALL_CHANNELS')) === 'ALL_CHANNELS' ? 'selected' : ''}>온·오프 공통</option>
                      <option value="ONLINE_ONLY" ${editingProduct?.channel_scope === 'ONLINE_ONLY' ? 'selected' : ''}>온라인 전용</option>
                      <option value="POS_ONLY" ${editingProduct?.payment_scope === 'POS_ONLY' || editingProduct?.channel_scope === 'POS_ONLY' ? 'selected' : ''}>현장 POS 전용</option>
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">POS 기준가 (불일치 감지용, 0=미사용)</label>
                    <input id="mp-pos-price" type="number" min="0" value="${Number(editingProduct?.pos_price ?? 0)}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">예약 시세변동 정책</label>
                    <select id="mp-res-policy" class="erp-input">
                      <option value="FIXED_AT_ORDER" ${editingProduct?.reservation_price_policy !== 'MARKET_AT_DELIVERY' ? 'selected' : ''}>주문시점 가격 고정</option>
                      <option value="MARKET_AT_DELIVERY" ${editingProduct?.reservation_price_policy === 'MARKET_AT_DELIVERY' ? 'selected' : ''}>배송일 시세 연동(차액 정정)</option>
                    </select>
                  </div>
                  <div style="display: flex; align-items: center; padding-top: 18px;">
                    <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: #334155; cursor: pointer;">
                      <input id="mp-pos-agency" type="checkbox" ${editingProduct?.pos_agency_tagged ? 'checked' : ''} />
                      POS 구매대행(위탁) 품목 표시
                    </label>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 14px; padding-top: 12px; border-top: 1px solid #f1f5f9;">
                  <div id="mp-img-preview-box" style="width: 76px; height: 76px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                    ${curImgUrl
                      ? `<img src="${escapeHtml(curImgUrl)}" alt="상품 이미지" style="width: 100%; height: 100%; object-fit: cover;" />`
                      : `<span style="font-size: 11px; color: #94a3b8;">이미지 없음</span>`
                    }
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label class="mc-btn-secondary" style="display: inline-flex; align-items: center; cursor: pointer;">
                      이미지 파일 선택 (WebP 변환)
                      <input id="mp-img-file" type="file" accept="image/*" style="display: none;" />
                    </label>
                    <span style="font-size: 11.5px; color: #64748b;">JPG/PNG 업로드 시 입력값 유지 상태로 경량화 저장됩니다.</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="mc-drawer-footer">
              <button type="button" class="mc-btn-secondary" id="btn-cancel-drawer">취소</button>
              <button type="submit" class="mc-btn-primary">${editingProduct ? '수정 저장' : '상품 등록'}</button>
            </div>
          </form>
        </div>
      ` : ''}

      ${drawerMode === 'IMPORT' ? `
        <div class="mc-drawer-backdrop" id="mc-drawer-backdrop">
          <div class="mc-drawer" style="width: 600px;">
            <div class="mc-drawer-header">
              <h2>POS 상품마스터 엑셀(CSV) 일괄 등록</h2>
              <button type="button" class="mc-drawer-close" id="btn-close-drawer">×</button>
            </div>
            <div class="mc-drawer-body">
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">0. 업로드 성격 분리 (기초 · 전단 · 당일신선)</div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                  ${[
                    { key: 'BASE_PRODUCT', label: '기초상품 (공산품)' },
                    { key: 'FLYER_PROMO', label: '전단행사 (기간할인)' },
                    { key: 'DAILY_FRESH', label: '당일신선 (일일시세)' }
                  ].map(t => `
                    <button type="button" class="${uploadBatchType === t.key ? 'mc-btn-primary' : 'mc-btn-secondary'} btn-import-batch-type" data-batch="${t.key}" style="height: 34px; font-size: 12px;">${t.label}</button>
                  `).join('')}
                </div>
              </div>
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>1. 엑셀 서식 다운로드 & 파일 선택</span>
                  <div style="display: flex; gap: 6px;">
                    <button type="button" class="mc-btn-secondary" id="btn-dl-pos-template" style="height: 28px; padding: 0 10px; font-size: 12px;">엑셀 서식 다운로드</button>
                    <button type="button" class="mc-btn-secondary" id="btn-fill-pos-sample" style="height: 28px; padding: 0 10px; font-size: 12px;">샘플 채우기</button>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                  <label class="mc-btn-secondary" style="display: inline-flex; align-items: center; cursor: pointer;">
                    CSV / TXT 파일 불러오기
                    <input id="file-pos-csv" type="file" accept=".csv,.tsv,.txt" style="display: none;" />
                  </label>
                  <span style="font-size: 12px; color: #64748b;">엑셀에서 저장한 CSV 파일을 올리거나 아래에 붙여넣으세요. (이미지는 등록 후 목록에서 일괄 보정 가능)</span>
                </div>
                <textarea id="txt-pos-import" rows="7" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: monospace; font-size: 12px;" placeholder="바코드,상품명,규격,단위,과면세구분,매입원가,정상판매가,행사가,행사시작일,행사종료일,분류코드"></textarea>
              </div>
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>2. 파싱 미리보기</span>
                  <span id="pos-preview-count" class="mc-pill mc-pill-gray">0건 인식</span>
                </div>
                <div id="pos-import-preview" style="max-height: 200px; overflow: auto; font-size: 12px; color: #64748b;">데이터를 입력하거나 파일을 선택하면 미리보기가 표시됩니다.</div>
              </div>
            </div>
            <div class="mc-drawer-footer">
              <button type="button" class="mc-btn-secondary" id="btn-cancel-drawer">취소</button>
              <button type="button" class="mc-btn-primary" id="btn-run-pos-import">엑셀(CSV) 일괄 반영</button>
            </div>
          </div>
        </div>
      ` : ''}
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
    draftMedia = { media_id: '', image_url: '' };
    drawerMode = 'EDIT';
    renderMartCatalogView(container);
  };
  container.querySelectorAll('.btn-edit-prod').forEach(btn => {
    btn.addEventListener('click', () => openEditDrawer(btn.dataset.id));
  });
  container.querySelectorAll('.mc-prod-row').forEach(row => {
    row.addEventListener('click', () => openEditDrawer(row.dataset.id));
  });

  const closeDrawer = () => {
    drawerMode = 'NONE';
    editingProductId = '';
    draftAppliedPromo = null;
    draftMedia = { media_id: '', image_url: '' };
    renderMartCatalogView(container);
  };
  container.querySelector('#btn-close-drawer')?.addEventListener('click', closeDrawer);
  container.querySelector('#btn-cancel-drawer')?.addEventListener('click', closeDrawer);
  container.querySelector('#mc-drawer-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-drawer-backdrop') closeDrawer();
  });

  // 드로어 내 이미지 업로드 (WebP, 입력 중인 폼 상태 유실 없이 미리보기만 갱신)
  container.querySelector('#mp-img-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const webpDataUrl = await fileToWebpDataUrl(file);
    const uploaded = await martApi.uploadMedia({ data_url: webpDataUrl, original_name: file.name });
    draftMedia = { media_id: uploaded.media_id, image_url: uploaded.image_url };
    const box = container.querySelector('#mp-img-preview-box');
    if (box) {
      box.innerHTML = `<img src="${escapeHtml(uploaded.image_url)}" alt="상품 이미지" style="width: 100%; height: 100%; object-fit: cover;" />`;
    }
  });

  // 드로어 내 할인(%) <-> 행사가 양방향 연동 + 실시간 마진율 미리보기
  const mpCost = container.querySelector('#mp-cost');
  const mpReg = container.querySelector('#mp-reg');
  const mpDisc = container.querySelector('#mp-disc');
  const mpPrice = container.querySelector('#mp-price');
  const mpMarginBadge = container.querySelector('#mp-margin-preview');

  const refreshMarginPreview = () => {
    if (!mpMarginBadge || !mpCost || !mpPrice) return;
    const c = Number(mpCost.value || 0);
    const s = Number(mpPrice.value || 0);
    const m = calcMarginPct(c, s);
    const neg = s < c;
    mpMarginBadge.className = `mc-pill ${neg ? 'mc-pill-red' : 'mc-pill-green'}`;
    mpMarginBadge.textContent = neg ? `역마진 ${m}%` : `예상 마진 ${m}%`;
  };
  mpCost?.addEventListener('input', refreshMarginPreview);
  mpReg?.addEventListener('input', () => {
    const r = Number(mpReg.value || 0);
    const d = Math.max(0, Math.min(99, Number(mpDisc?.value || 0)));
    if (r > 0 && mpPrice) mpPrice.value = Math.round(r * (1 - d / 100));
    refreshMarginPreview();
  });
  mpDisc?.addEventListener('input', () => {
    const r = Number(mpReg?.value || 0);
    const d = Math.max(0, Math.min(99, Number(mpDisc.value || 0)));
    if (r > 0 && mpPrice) mpPrice.value = Math.round(r * (1 - d / 100));
    refreshMarginPreview();
  });
  mpPrice?.addEventListener('input', () => {
    const r = Number(mpReg?.value || 0);
    const s = Number(mpPrice.value || 0);
    if (r > 0 && mpDisc) mpDisc.value = s < r ? Math.round((1 - s / r) * 100) : 0;
    refreshMarginPreview();
  });

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

  // 단건 등록/수정 저장
  container.querySelector('#form-mart-add')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const l1 = mpL1?.value || '';
    const l2 = mpL2?.value || '';
    const l3 = mpL3?.value || '';
    const selectedScope = container.querySelector('#mp-scope')?.value || 'ALL_CHANNELS';
    const promoMeta = draftAppliedPromo || (editingProduct?.applied_promo_id ? {
      applied_promo_id: editingProduct.applied_promo_id,
      applied_promo_name: editingProduct.applied_promo_name || '',
      applied_promo_type: editingProduct.applied_promo_type || '',
      promo_required_qty: editingProduct.promo_required_qty || 1,
      promo_bundle_price: editingProduct.promo_bundle_price || 0,
      promo_days_of_week: editingProduct.promo_days_of_week || [],
      promo_max_discount_amount: editingProduct.promo_max_discount_amount || 0,
      promo_limit_per_person: editingProduct.promo_limit_per_person || 0,
      promo_card_targets: editingProduct.promo_card_targets || []
    } : {});
    const payload = {
      id: editingProductId || undefined,
      ...promoMeta,
      category_l1: l1,
      category_l2: l2,
      category_l3: l3,
      category_path: buildCategoryPath(l1, l2, l3) || '-',
      tax_type: mpTax?.value || 'TAXABLE',
      category_type: editingProduct?.category_type === 'SUBSCRIPTION'
        ? 'SUBSCRIPTION'
        : (l1List.find(c => c.code === l1)?.default_category_type || 'B2B_INDUSTRIAL'),
      fulfillment_source: container.querySelector('#mp-src')?.value || 'MART_FLOOR',
      barcode: container.querySelector('#mp-barcode')?.value?.trim(),
      name: container.querySelector('#mp-name')?.value?.trim(),
      spec: container.querySelector('#mp-spec')?.value?.trim(),
      uom: container.querySelector('#mp-uom')?.value,
      online_publish_status: container.querySelector('#mp-pub')?.value || 'PUBLISHED_FEED',
      channel_scope: selectedScope,
      payment_scope: selectedScope === 'POS_ONLY' ? 'POS_ONLY' : 'ONLINE_APPLICABLE',
      storage_temp: container.querySelector('#mp-temp')?.value || 'AMBIENT',
      media_id: draftMedia.media_id || editingProduct?.media_id || '',
      image_url: draftMedia.image_url || editingProduct?.image_url || '',
      cost_price: Math.max(0, Number(container.querySelector('#mp-cost')?.value ?? 0)),
      regular_price: Math.max(0, Number(container.querySelector('#mp-reg')?.value ?? 0)),
      sale_price: Math.max(0, Number(container.querySelector('#mp-price')?.value ?? 0)),
      promo_start: container.querySelector('#mp-pstart')?.value || '',
      promo_end: container.querySelector('#mp-pend')?.value || '',
      pos_price: Math.max(0, Number(container.querySelector('#mp-pos-price')?.value ?? 0)),
      pos_agency_tagged: Boolean(container.querySelector('#mp-pos-agency')?.checked),
      reservation_price_policy: container.querySelector('#mp-res-policy')?.value || 'FIXED_AT_ORDER',
      stock_qty: Math.max(0, Number(container.querySelector('#mp-stock')?.value ?? 50)),
      safety_stock: Math.max(0, Number(container.querySelector('#mp-safety')?.value ?? 5))
    };
    if (editingProductId) await martApi.updateProduct(payload);
    else await martApi.addProduct(payload);
    drawerMode = 'NONE';
    editingProductId = '';
    draftAppliedPromo = null;
    draftMedia = { media_id: '', image_url: '' };
    await renderMartCatalogView(container);
  });

  // POS 엑셀(CSV) 일괄 등록 + 서식 다운로드 + 파싱 미리보기
  const renderPosPreview = () => {
    const raw = container.querySelector('#txt-pos-import')?.value || '';
    const rows = parseDelimitedRows(raw).filter(cols => cols[0] && cols[0] !== '바코드' && cols[1]);
    const cntEl = container.querySelector('#pos-preview-count');
    const prevEl = container.querySelector('#pos-import-preview');
    if (cntEl) cntEl.textContent = `${rows.length}건 인식`;
    if (prevEl) {
      if (rows.length === 0) {
        prevEl.innerHTML = '데이터를 입력하거나 파일을 선택하면 미리보기가 표시됩니다.';
      } else {
        prevEl.innerHTML = `
          <table class="mc-table" style="font-size: 11.5px;">
            <thead><tr><th>바코드</th><th>상품명</th><th>규격</th><th style="text-align:right;">정상가</th><th style="text-align:right;">행사가</th></tr></thead>
            <tbody>
              ${rows.slice(0, 20).map(c => `<tr><td><code>${escapeHtml(c[0])}</code></td><td><b>${escapeHtml(c[1])}</b></td><td>${escapeHtml(c[2] || '-')}</td><td class="mc-num">${Number(c[6] || 0).toLocaleString()}원</td><td class="mc-num">${Number(c[7] || c[6] || 0).toLocaleString()}원</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }
    }
  };
  container.querySelectorAll('.btn-import-batch-type').forEach(btn => {
    btn.addEventListener('click', () => {
      uploadBatchType = btn.dataset.batch;
      container.querySelectorAll('.btn-import-batch-type').forEach(b => {
        b.className = `${b.dataset.batch === uploadBatchType ? 'mc-btn-primary' : 'mc-btn-secondary'} btn-import-batch-type`;
      });
    });
  });
  container.querySelector('#txt-pos-import')?.addEventListener('input', renderPosPreview);
  container.querySelector('#btn-dl-pos-template')?.addEventListener('click', () => {
    downloadExcelCsv(
      'mart_pos_products_template.csv',
      ['바코드', '상품명', '규격', '단위', '과면세구분', '매입원가', '정상판매가', '행사가', '행사시작일', '행사종료일', '분류코드'],
      [
        ['8801007052120', 'CJ 백설 하얀설탕', '1KG', '봉', '과세', 1650, 2350, 1980, '2026-11-17', '2026-11-25', '가공식품>조미료'],
        ['2000020000005', '국내산 깐마늘(대)', '1KG', '봉', '면세', 6800, 8900, 7900, '2026-11-17', '2026-11-23', '농산>양념채소']
      ]
    );
  });
  container.querySelector('#file-pos-csv')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readCsvOrTextFile(file);
    const ta = container.querySelector('#txt-pos-import');
    if (ta) ta.value = text;
    renderPosPreview();
  });
  container.querySelector('#btn-fill-pos-sample')?.addEventListener('click', () => {
    const ta = container.querySelector('#txt-pos-import');
    if (ta) ta.value = SAMPLE_POS_CSV;
    renderPosPreview();
  });
  container.querySelector('#btn-run-pos-import')?.addEventListener('click', async () => {
    const text = container.querySelector('#txt-pos-import')?.value?.trim();
    if (!text) return;
    await martApi.bulkImport('POS_CSV', text);
    drawerMode = 'NONE';
    await renderMartCatalogView(container);
  });
}
