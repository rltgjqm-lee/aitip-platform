/**
 * AITIP Mart Portal - 2. 대행 전처리 상품 전용 관리 모듈 (ESM)
 * 모던 커머스 어드민 UI: 3단계 표준 분류 + 전처리 공정 구분 + 우측 슬라이드 드로어
 */

import { martApi } from '../api.js';
import { fileToWebpDataUrl } from '../utils/media-webp.js';
import { getL1List, getL2List, getL3List, buildCategoryPath, inferCategoryFromProduct } from '../utils/mart-categories.js';
import { downloadExcelCsv, readCsvOrTextFile, parseDelimitedRows } from '../utils/excel-csv.js';
import { esc, bindStopPropagation } from '../utils/html.js';
import { paginateArray, renderMartPaginationHtml, bindMartPaginationEvents } from '../utils/pagination.js';

let drawerMode = 'NONE'; // 'NONE' | 'EDIT' | 'IMPORT'
let editingProductId = '';
let searchQuery = '';
let l1Filter = 'ALL';
let processFilter = 'ALL';
let tempFilter = 'ALL';
let imageFilter = 'ALL';
let currentPage = 1;
let pageSize = 10;
let quickPrepImgId = '';
let draftMedia = { media_id: '', image_url: '' };

const PREP_PROCESS_LABEL = {
  WASH_PEEL: '세척·탈피',
  CUT_SLICE: '절단·슬라이스',
  TRIM_PORTION: '정선·소분',
  SEASON_MARINATE: '양념·가공'
};

function inferPrepProcess(p = {}) {
  if (p.prep_process && PREP_PROCESS_LABEL[p.prep_process]) return p.prep_process;
  const txt = `${p.name || ''} ${p.prep_method || ''} ${p.spec || ''}`.toLowerCase();
  if (/양념|무침|데침|절임/.test(txt)) return 'SEASON_MARINATE';
  if (/슬라이스|채|다이스|컷|깍둑|불고기|구이/.test(txt)) return 'CUT_SLICE';
  if (/탈피|깐|세척|거두|껍질/.test(txt)) return 'WASH_PEEL';
  return 'TRIM_PORTION';
}

const SAMPLE_PREP = `1\t대파 (손질)\t국내산, 전처리(뿌리·겉잎제거), 상, 1kg/단\t단\t8\t진물·짓무름 없을 것
2\t콩나물 (거두)\t국내산, 전처리(꼬리제거/세척), 1kg/봉 (5봉/박스)\t봉\t8\t당일 생산품 납품 필수`;

export async function renderMartPrepView(container, opts = {}) {
  if (!container) return;
  const data = await martApi.getCatalog();
  const prepItems = (data.products || []).filter(p => p.category_type === 'PREP_PROCESSED' || p.fulfillment_source === 'PREP_CENTER');
  const editingProduct = editingProductId ? prepItems.find(p => p.id === editingProductId) : null;
  const editCat = editingProduct ? inferCategoryFromProduct(editingProduct) : { l1: '01', l2: '0102', l3: '010203', path: buildCategoryPath('01', '0102', '010203') };
  const editProc = editingProduct ? inferPrepProcess(editingProduct) : 'WASH_PEEL';
  const l1List = getL1List();

  const q = searchQuery.trim().toLowerCase();
  const filtered = prepItems.filter(p => {
    const cat = inferCategoryFromProduct(p);
    const proc = inferPrepProcess(p);
    if (l1Filter !== 'ALL' && cat.l1 !== l1Filter) return false;
    if (processFilter !== 'ALL' && proc !== processFilter) return false;
    if (tempFilter !== 'ALL' && (p.storage_temp || 'AMBIENT') !== tempFilter) return false;
    if (imageFilter === 'HAS_IMG' && !p.image_url) return false;
    if (imageFilter === 'NO_IMG' && p.image_url) return false;
    if (q && !`${p.barcode} ${p.name} ${p.prep_method || ''} ${p.spec || ''} ${cat.path}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const pageInfo = paginateArray(filtered, currentPage, pageSize);
  currentPage = pageInfo.page;
  const curImgUrl = draftMedia.image_url || editingProduct?.image_url || '';

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="mc-page-header">
        <div class="mc-title-wrap">
          <h1>전처리 상품</h1>
          <span class="mc-count-pill">총 ${prepItems.length}개</span>
        </div>
        <div class="mc-header-actions">
          <button type="button" class="mc-btn-secondary" id="btn-open-prep-import">엑셀(CSV) 품목 일괄 등록</button>
          <button type="button" class="mc-btn-primary" id="btn-open-prep-add">+ 전처리 등록</button>
          <input id="quick-prep-img-input" type="file" accept="image/*" style="display: none;" />
        </div>
      </div>

      <div class="mc-surface">
        <div class="mc-filter-bar">
          <div class="mc-filter-controls">
            <input id="prep-filter-q" type="text" class="mc-search" value="${esc(searchQuery)}" placeholder="품목명 · 전처리 방식 · 규격 · 코드 검색" />
            <select id="prep-filter-l1" class="mc-select">
              <option value="ALL" ${l1Filter === 'ALL' ? 'selected' : ''}>전체 대분류</option>
              ${l1List.map(c => `<option value="${c.code}" ${l1Filter === c.code ? 'selected' : ''}>${c.code} ${esc(c.name)}</option>`).join('')}
            </select>
            <select id="prep-filter-proc" class="mc-select">
              <option value="ALL" ${processFilter === 'ALL' ? 'selected' : ''}>전체 공정</option>
              ${Object.entries(PREP_PROCESS_LABEL).map(([k, lbl]) => `<option value="${k}" ${processFilter === k ? 'selected' : ''}>${lbl}</option>`).join('')}
            </select>
            <select id="prep-filter-temp" class="mc-select">
              <option value="ALL" ${tempFilter === 'ALL' ? 'selected' : ''}>전체 보관</option>
              <option value="REFRIGERATED" ${tempFilter === 'REFRIGERATED' ? 'selected' : ''}>냉장(0~5℃)</option>
              <option value="AMBIENT" ${tempFilter === 'AMBIENT' ? 'selected' : ''}>상온</option>
            </select>
            <select id="prep-filter-img" class="mc-select">
              <option value="ALL" ${imageFilter === 'ALL' ? 'selected' : ''}>전체 이미지</option>
              <option value="NO_IMG" ${imageFilter === 'NO_IMG' ? 'selected' : ''}>이미지 미등록</option>
              <option value="HAS_IMG" ${imageFilter === 'HAS_IMG' ? 'selected' : ''}>이미지 등록됨</option>
            </select>
          </div>
          <div style="font-size: 12px; color: #64748b; white-space: nowrap;">
            조회 ${filtered.length}건 · 행 클릭 시 상세 수정
          </div>
        </div>

        <div class="mc-table-wrap">
          <table class="mc-table">
            <thead>
              <tr>
                <th>품목 정보</th>
                <th>표준 분류 · 공정</th>
                <th>보관</th>
                <th>검수 기준</th>
                <th style="text-align: right;">공급 단가</th>
                <th style="text-align: right;">관리</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 48px 16px; color: #64748b;">
                    조건에 맞는 전처리 품목이 없습니다. 필터를 변경하거나 '+ 전처리 등록'을 이용해 주세요.
                  </td>
                </tr>
              ` : pageInfo.paged.map(p => {
                const catInfo = inferCategoryFromProduct(p);
                const procCode = inferPrepProcess(p);
                return `
                  <tr class="mc-prep-row" data-id="${p.id}" style="cursor: pointer;">
                    <td>
                      <div class="mc-prod-cell">
                        <div class="mc-thumb quick-prep-thumb mc-stop-prop" data-id="${p.id}" title="클릭하여 이미지 바로 등록/교체" style="cursor: pointer;">
                          ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" />` : '<span style="color:#007749;">+IMG</span>'}
                        </div>
                        <div>
                          <div class="mc-prod-name">${esc(p.name)}</div>
                          <div class="mc-prod-sub">
                            ${esc(p.spec || '-')} · ${esc(p.uom || '봉')} · ${p.tax_type === 'TAXABLE' ? '과세' : '면세'}
                            <span class="mc-prod-code" style="margin-left: 6px;">${esc(p.barcode)}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                        <span class="mc-pill mc-pill-green">${PREP_PROCESS_LABEL[procCode]}</span>
                        <span class="mc-pill mc-pill-gray">${esc(p.prep_method || '손질·소분')}</span>
                        ${p.size_grade ? `<span class="mc-pill mc-pill-blue">${esc(p.size_grade)}등급</span>` : ''}
                      </div>
                      <div style="font-size: 11.5px; color: #475569; font-weight: 600; margin-top: 4px;">${esc(catInfo.path)}</div>
                    </td>
                    <td>
                      <span class="mc-pill ${p.storage_temp === 'REFRIGERATED' ? 'mc-pill-blue' : 'mc-pill-gray'}">
                        ${p.storage_temp === 'REFRIGERATED' ? '냉장(0~5℃)' : '상온'}
                      </span>
                    </td>
                    <td style="color: #475569; max-width: 240px;">${esc(p.inspection_note || '-')}</td>
                    <td class="mc-num">
                      <strong style="font-size: 14px;">${Number(p.sale_price ?? p.regular_price ?? 0).toLocaleString()}원</strong>
                    </td>
                    <td class="mc-stop-prop" style="text-align: right;">
                      <button type="button" class="mc-row-edit-btn btn-edit-prep" data-id="${p.id}">수정</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${renderMartPaginationHtml(pageInfo, 'prep')}
      </div>

      ${drawerMode === 'EDIT' ? `
        <div class="mc-drawer-backdrop" id="mc-prep-backdrop">
          <form class="mc-drawer" id="form-prep-add">
            <div class="mc-drawer-header">
              <h2>${editingProduct ? '전처리 품목 수정' : '새 전처리 품목 등록'}</h2>
              <button type="button" class="mc-drawer-close" id="btn-close-prep-drawer">×</button>
            </div>
            <div class="mc-drawer-body">
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">1. 표준 상품분류 (대 · 중 · 소) · 과면세</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="erp-field-label">대분류 *</label>
                    <select id="pr-cat-l1" class="erp-input">
                      ${l1List.map(c => `<option value="${c.code}" ${editCat.l1 === c.code ? 'selected' : ''}>${c.code} ${esc(c.name)}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">중분류 *</label>
                    <select id="pr-cat-l2" class="erp-input">
                      ${getL2List(editCat.l1).map(c => `<option value="${c.code}" ${editCat.l2 === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">소분류</label>
                    <select id="pr-cat-l3" class="erp-input">
                      ${getL3List(editCat.l1, editCat.l2 || getL2List(editCat.l1)[0]?.code).map(c => `<option value="${c.code}" ${editCat.l3 === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">과면세 구분</label>
                    <select id="pr-tax" class="erp-input">
                      <option value="EXEMPT" ${(editingProduct?.tax_type || 'EXEMPT') === 'EXEMPT' ? 'selected' : ''}>면세 (1차 손질)</option>
                      <option value="TAXABLE" ${editingProduct?.tax_type === 'TAXABLE' ? 'selected' : ''}>과세 (가공·양념)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">2. 전처리 품목 규격 · 공정</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">품목명 *</label>
                    <input id="pr-name" type="text" required class="erp-input" value="${esc(editingProduct?.name || '')}" placeholder="예: 양파 (깐양파)" />
                  </div>
                  <div>
                    <label class="erp-field-label">전처리 공정 구분</label>
                    <select id="pr-process" class="erp-input">
                      ${Object.entries(PREP_PROCESS_LABEL).map(([k, lbl]) => `<option value="${k}" ${editProc === k ? 'selected' : ''}>${lbl}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">세부 전처리 방식</label>
                    <input id="pr-method" type="text" class="erp-input" value="${esc(editingProduct?.prep_method || '')}" placeholder="탈피/꼭지제거" />
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">상세 규격 · 입수</label>
                    <input id="pr-spec" type="text" class="erp-input" value="${esc(editingProduct?.spec || '')}" placeholder="1kg/봉 (10봉/1망)" />
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <label class="erp-field-label">검수 기준</label>
                    <input id="pr-note" type="text" class="erp-input" value="${esc(editingProduct?.inspection_note || '')}" placeholder="무름 및 곰팡이 없을 것" />
                  </div>
                </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">3. 등급 · 단위 · 보관 · 단가</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="erp-field-label">등급</label>
                    <select id="pr-grade" class="erp-input">
                      ${['특', '상', '대', '중', '소'].map(g => `<option value="${g}" ${(editingProduct?.size_grade || '중') === g ? 'selected' : ''}>${g}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">발주 단위</label>
                    <select id="pr-uom" class="erp-input">
                      ${['봉', '단', '팩', '판', '망', '박스'].map(u => `<option value="${u}" ${editingProduct?.uom === u ? 'selected' : ''}>${u}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">보관 구분</label>
                    <select id="pr-temp" class="erp-input">
                      <option value="REFRIGERATED" ${(editingProduct?.storage_temp || 'REFRIGERATED') === 'REFRIGERATED' ? 'selected' : ''}>냉장(0~5℃)</option>
                      <option value="AMBIENT" ${editingProduct?.storage_temp === 'AMBIENT' ? 'selected' : ''}>상온</option>
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">공급가 (원) *</label>
                    <input id="pr-price" type="number" min="0" required value="${Number(editingProduct?.sale_price ?? editingProduct?.regular_price ?? 4200)}" class="erp-input" style="font-weight: 700; border-color: #007749;" />
                  </div>
                  <div>
                    <label class="erp-field-label">판매 대상</label>
                    <select id="pr-sales-target" class="erp-input">
                      <option value="B2B_ONLY" ${(editingProduct?.sales_target || 'B2B_ONLY') === 'B2B_ONLY' ? 'selected' : ''}>기관 전용 (B2B)</option>
                      <option value="BOTH" ${editingProduct?.sales_target === 'BOTH' ? 'selected' : ''}>공통 (일반 + 기관)</option>
                    </select>
                  </div>
                  <div>
                    <label class="erp-field-label">B2B 기관 공급가 (원, 0=기본)</label>
                    <input id="pr-b2b-price" type="number" min="0" value="${Number(editingProduct?.b2b_price ?? 0)}" class="erp-input" />
                  </div>
                  <div>
                    <label class="erp-field-label">B2B 최소 발주수량</label>
                    <input id="pr-b2b-min" type="number" min="1" value="${Number(editingProduct?.b2b_min_qty ?? 1)}" class="erp-input" />
                  </div>
                </div>
              </div>

              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">4. 전처리 이미지 (WebP 자동변환)</div>
                <div style="display: flex; align-items: center; gap: 14px;">
                  <div id="pr-img-preview-box" style="width: 84px; height: 84px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                    ${curImgUrl
                      ? `<img src="${esc(curImgUrl)}" alt="전처리 이미지" style="width: 100%; height: 100%; object-fit: cover;" />`
                      : `<span style="font-size: 11px; color: #94a3b8;">이미지 없음</span>`
                    }
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label class="mc-btn-secondary" style="display: inline-flex; align-items: center; cursor: pointer;">
                      이미지 파일 선택
                      <input id="pr-img-file" type="file" accept="image/*" style="display: none;" />
                    </label>
                    <span style="font-size: 11.5px; color: #64748b;">JPG/PNG 선택 시 입력값 유지 상태로 WebP 변환 저장됩니다.</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="mc-drawer-footer">
              <button type="button" class="mc-btn-secondary" id="btn-cancel-prep-drawer">취소</button>
              <button type="submit" class="mc-btn-primary">${editingProduct ? '수정 저장' : '전처리 등록'}</button>
            </div>
          </form>
        </div>
      ` : ''}

      ${drawerMode === 'IMPORT' ? `
        <div class="mc-drawer-backdrop" id="mc-prep-backdrop">
          <div class="mc-drawer" style="width: 600px;">
            <div class="mc-drawer-header">
              <h2>전처리 품목 엑셀(CSV) 일괄 등록</h2>
              <button type="button" class="mc-drawer-close" id="btn-close-prep-drawer">×</button>
            </div>
            <div class="mc-drawer-body">
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>1. 엑셀 서식 다운로드 & 파일 선택</span>
                  <div style="display: flex; gap: 6px;">
                    <button type="button" class="mc-btn-secondary" id="btn-dl-prep-template" style="height: 28px; padding: 0 10px; font-size: 12px;">엑셀 서식 다운로드</button>
                    <button type="button" class="mc-btn-secondary" id="btn-fill-prep-sample" style="height: 28px; padding: 0 10px; font-size: 12px;">품목 샘플 채우기</button>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                  <label class="mc-btn-secondary" style="display: inline-flex; align-items: center; cursor: pointer;">
                    CSV / TXT 파일 불러오기
                    <input id="file-prep-csv" type="file" accept=".csv,.tsv,.txt" style="display: none;" />
                  </label>
                  <span style="font-size: 12px; color: #64748b;">엑셀에서 저장한 CSV를 올리거나 표를 붙여넣으세요.</span>
                </div>
                <textarea id="txt-prep-import" rows="7" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: monospace; font-size: 12px;" placeholder="연번 [탭/콤마] 품목명 [탭/콤마] 상세규격(전처리·등급·중량·입수) [탭/콤마] 단위 [탭/콤마] 단가 [탭/콤마] 검수기준"></textarea>
              </div>
              <div class="mc-drawer-section">
                <div class="mc-drawer-section-title">
                  <span>2. 파싱 미리보기</span>
                  <span id="prep-preview-count" class="mc-pill mc-pill-gray">0건 인식</span>
                </div>
                <div id="prep-import-preview" style="max-height: 200px; overflow: auto; font-size: 12px; color: #64748b;">데이터를 입력하거나 파일을 선택하면 미리보기가 표시됩니다.</div>
              </div>
            </div>
            <div class="mc-drawer-footer">
              <button type="button" class="mc-btn-secondary" id="btn-cancel-prep-drawer">취소</button>
              <button type="button" class="mc-btn-primary" id="btn-run-prep-import">엑셀(CSV) 일괄 등록</button>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  container.querySelector('#prep-filter-q')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderMartPrepView(container, { focusId: 'prep-filter-q', cursorPos: e.target.selectionStart });
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
  container.querySelector('#prep-filter-l1')?.addEventListener('change', (e) => {
    l1Filter = e.target.value;
    renderMartPrepView(container);
  });
  container.querySelector('#prep-filter-proc')?.addEventListener('change', (e) => {
    processFilter = e.target.value;
    renderMartPrepView(container);
  });
  container.querySelector('#prep-filter-temp')?.addEventListener('change', (e) => {
    tempFilter = e.target.value;
    renderMartPrepView(container);
  });
  container.querySelector('#prep-filter-img')?.addEventListener('change', (e) => {
    imageFilter = e.target.value;
    renderMartPrepView(container);
  });

  // 목록 썸네일 클릭 즉시 이미지 보정 업로드 (WebP)
  const quickPrepInput = container.querySelector('#quick-prep-img-input');
  container.querySelectorAll('.quick-prep-thumb').forEach(el => {
    el.addEventListener('click', () => {
      quickPrepImgId = el.dataset.id;
      if (quickPrepInput) {
        quickPrepInput.value = '';
        quickPrepInput.click();
      }
    });
  });
  quickPrepInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file || !quickPrepImgId) return;
    const webpDataUrl = await fileToWebpDataUrl(file);
    const uploaded = await martApi.uploadMedia({ data_url: webpDataUrl, original_name: file.name });
    await martApi.updateProduct({
      id: quickPrepImgId,
      media_id: uploaded.media_id,
      image_url: uploaded.image_url
    });
    quickPrepImgId = '';
    await renderMartPrepView(container);
  });

  container.querySelector('#btn-open-prep-add')?.addEventListener('click', () => {
    editingProductId = '';
    draftMedia = { media_id: '', image_url: '' };
    drawerMode = 'EDIT';
    renderMartPrepView(container);
  });
  container.querySelector('#btn-open-prep-import')?.addEventListener('click', () => {
    drawerMode = 'IMPORT';
    renderMartPrepView(container);
  });

  const openEditDrawer = (id) => {
    editingProductId = id;
    draftMedia = { media_id: '', image_url: '' };
    drawerMode = 'EDIT';
    renderMartPrepView(container);
  };
  container.querySelectorAll('.btn-edit-prep').forEach(btn => {
    btn.addEventListener('click', () => openEditDrawer(btn.dataset.id));
  });
  bindStopPropagation(container);
  bindMartPaginationEvents(container, {
    prefix: 'prep',
    totalPages: pageInfo.totalPages,
    onPageChange: (nextP) => { currentPage = nextP; renderMartPrepView(container); },
    onSizeChange: (nextSz) => { pageSize = nextSz; currentPage = 1; renderMartPrepView(container); }
  });
  container.querySelectorAll('.mc-prep-row').forEach(row => {
    row.addEventListener('click', () => openEditDrawer(row.dataset.id));
  });

  const closeDrawer = () => {
    drawerMode = 'NONE';
    editingProductId = '';
    draftMedia = { media_id: '', image_url: '' };
    renderMartPrepView(container);
  };
  container.querySelector('#btn-close-prep-drawer')?.addEventListener('click', closeDrawer);
  container.querySelector('#btn-cancel-prep-drawer')?.addEventListener('click', closeDrawer);
  container.querySelector('#mc-prep-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-prep-backdrop') closeDrawer();
  });

  // 드로어 내 대/중/소분류 3단 연동
  const prL1 = container.querySelector('#pr-cat-l1');
  const prL2 = container.querySelector('#pr-cat-l2');
  const prL3 = container.querySelector('#pr-cat-l3');
  const prTax = container.querySelector('#pr-tax');

  const syncL3Options = () => {
    if (!prL1 || !prL2 || !prL3) return;
    const l3s = getL3List(prL1.value, prL2.value);
    prL3.innerHTML = l3s.map(c => `<option value="${c.code}">${esc(c.name)}</option>`).join('');
  };
  prL1?.addEventListener('change', () => {
    if (!prL2) return;
    const l2s = getL2List(prL1.value);
    prL2.innerHTML = l2s.map(c => `<option value="${c.code}">${esc(c.name)}</option>`).join('');
    syncL3Options();
    const l1Obj = l1List.find(c => c.code === prL1.value);
    if (l1Obj && !editingProductId && prTax) {
      prTax.value = l1Obj.default_tax_type;
    }
  });
  prL2?.addEventListener('change', syncL3Options);

  container.querySelector('#pr-img-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const webpDataUrl = await fileToWebpDataUrl(file);
    const uploaded = await martApi.uploadMedia({ data_url: webpDataUrl, original_name: file.name });
    draftMedia = { media_id: uploaded.media_id, image_url: uploaded.image_url };
    const box = container.querySelector('#pr-img-preview-box');
    if (box) {
      box.innerHTML = `<img src="${esc(uploaded.image_url)}" alt="전처리 이미지" style="width: 100%; height: 100%; object-fit: cover;" />`;
    }
  });

  const renderPrepPreview = () => {
    const raw = container.querySelector('#txt-prep-import')?.value || '';
    const rows = parseDelimitedRows(raw).filter(cols => cols[1] && cols[0] !== '연번');
    const cntEl = container.querySelector('#prep-preview-count');
    const prevEl = container.querySelector('#prep-import-preview');
    if (cntEl) cntEl.textContent = `${rows.length}건 인식`;
    if (prevEl) {
      if (rows.length === 0) {
        prevEl.innerHTML = '데이터를 입력하거나 파일을 선택하면 미리보기가 표시됩니다.';
      } else {
        prevEl.innerHTML = `
          <table class="mc-table" style="font-size: 11.5px;">
            <thead><tr><th>품목명</th><th>상세규격</th><th>단위</th><th>검수기준</th></tr></thead>
            <tbody>
              ${rows.slice(0, 20).map(c => `<tr><td><b>${esc(c[1])}</b></td><td>${esc(c[2] || '-')}</td><td>${esc(c[3] || '봉')}</td><td>${esc(c[5] || '-')}</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }
    }
  };
  container.querySelector('#txt-prep-import')?.addEventListener('input', renderPrepPreview);
  container.querySelector('#btn-dl-prep-template')?.addEventListener('click', () => {
    downloadExcelCsv(
      'mart_prep_products_template.csv',
      ['연번', '품목명', '상세규격(전처리·등급·중량·입수)', '단위', '수량', '검수기준'],
      [
        [1, '대파 (손질)', '국내산, 전처리(뿌리·겉잎제거), 상, 1kg/단', '단', 8, '진물·짓무름 없을 것'],
        [2, '콩나물 (거두)', '국내산, 전처리(꼬리제거/세척), 1kg/봉 (5봉/박스)', '봉', 8, '당일 생산품 납품 필수']
      ]
    );
  });
  container.querySelector('#file-prep-csv')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readCsvOrTextFile(file);
    const ta = container.querySelector('#txt-prep-import');
    if (ta) ta.value = text;
    renderPrepPreview();
  });
  container.querySelector('#btn-fill-prep-sample')?.addEventListener('click', () => {
    const ta = container.querySelector('#txt-prep-import');
    if (ta) ta.value = SAMPLE_PREP;
    renderPrepPreview();
  });
  container.querySelector('#btn-run-prep-import')?.addEventListener('click', async () => {
    const text = container.querySelector('#txt-prep-import')?.value?.trim();
    if (!text) return;
    await martApi.bulkImport('PREP_SHEET', text);
    drawerMode = 'NONE';
    await renderMartPrepView(container);
  });

  container.querySelector('#form-prep-add')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const price = Math.max(0, Number(container.querySelector('#pr-price')?.value ?? 0));
    const l1 = prL1?.value || '';
    const l2 = prL2?.value || '';
    const l3 = prL3?.value || '';
    const payload = {
      id: editingProductId || undefined,
      category_type: 'PREP_PROCESSED',
      fulfillment_source: 'PREP_CENTER',
      category_l1: l1,
      category_l2: l2,
      category_l3: l3,
      category_path: buildCategoryPath(l1, l2, l3) || '-',
      tax_type: prTax?.value || 'EXEMPT',
      prep_process: container.querySelector('#pr-process')?.value || 'WASH_PEEL',
      name: container.querySelector('#pr-name')?.value?.trim(),
      prep_method: container.querySelector('#pr-method')?.value?.trim(),
      size_grade: container.querySelector('#pr-grade')?.value,
      spec: container.querySelector('#pr-spec')?.value?.trim(),
      uom: container.querySelector('#pr-uom')?.value,
      storage_temp: container.querySelector('#pr-temp')?.value || 'REFRIGERATED',
      inspection_note: container.querySelector('#pr-note')?.value?.trim(),
      media_id: draftMedia.media_id || editingProduct?.media_id || '',
      image_url: draftMedia.image_url || editingProduct?.image_url || '',
      regular_price: price,
      sale_price: price,
      sales_target: container.querySelector('#pr-sales-target')?.value || 'B2B_ONLY',
      b2b_price: Math.max(0, Number(container.querySelector('#pr-b2b-price')?.value ?? 0)),
      b2b_min_qty: Math.max(1, Number(container.querySelector('#pr-b2b-min')?.value ?? 1))
    };
    if (editingProductId) await martApi.updateProduct(payload);
    else await martApi.addProduct(payload);
    drawerMode = 'NONE';
    editingProductId = '';
    draftMedia = { media_id: '', image_url: '' };
    await renderMartPrepView(container);
  });
}
