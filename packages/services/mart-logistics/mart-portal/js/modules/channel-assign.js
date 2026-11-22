/**
 * AITIP Mart Portal - 2-1. B2C · B2B 판매 · 가격 · 채널 배정 모듈 (ESM)
 * 1. 상품등록에서 저장된 상품 마스터를 가져와 판매대상(공통/B2C/B2B), B2C 판매가,
 * B2B 기관 공급가, 최소 발주수량, 온라인 노출 상태를 한눈에 배정한다.
 */

import { martApi } from '../api.js';
import { getL1List, getL2List, getL3List, inferCategoryFromProduct } from '../utils/mart-categories.js';
import { paginateArray, renderMartPaginationHtml, bindMartPaginationEvents } from '../utils/pagination.js';
import { downloadExcelCsv, readCsvOrTextFile, parseDelimitedRows } from '../utils/excel-csv.js';
import { esc, showToast } from '../utils/html.js';

let targetFilter = 'ALL'; // 'ALL' | 'BOTH' | 'B2C_ONLY' | 'B2B_ONLY'
let l1Filter = 'ALL';
let l2Filter = 'ALL';
let l3Filter = 'ALL';
let keyword = '';
let currentPage = 1;
let pageSize = 10;
let priceDrawerOpen = false;
let historyDrawerOpen = false;
let priceUploadMode = 'PARTIAL'; // 'PARTIAL' | 'SYNC_FRESH'
let priceCsvDraft = '';
let priceBatchResult = null;
let uploadHistory = [];
const selectedIds = new Set();

export async function renderMartChannelAssignView(container) {
  if (!container) return;
  const res = await martApi.getCatalog();
  const products = res.products || [];
  const l1List = getL1List();

  function render() {
    const q = keyword.trim().toLowerCase();
    const filtered = products.filter(p => {
      const st = p.sales_target || 'BOTH';
      if (targetFilter !== 'ALL' && st !== targetFilter) return false;
      const cat = inferCategoryFromProduct(p);
      if (l1Filter !== 'ALL' && cat.l1 !== l1Filter) return false;
      if (l2Filter !== 'ALL' && cat.l2 !== l2Filter) return false;
      if (l3Filter !== 'ALL' && cat.l3 !== l3Filter) return false;
      if (q && !`${p.name} ${p.spec} ${p.barcode}`.toLowerCase().includes(q)) return false;
      return true;
    });

    const pgInfo = paginateArray(filtered, currentPage, pageSize);
    currentPage = pgInfo.page;
    const paged = pgInfo.paged;
    const allChecked = paged.length > 0 && paged.every(p => selectedIds.has(p.id));
    const l2List = l1Filter !== 'ALL' ? getL2List(l1Filter) : [];
    const l3List = (l1Filter !== 'ALL' && l2Filter !== 'ALL') ? getL3List(l1Filter, l2Filter) : [];

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="mc-page-header">
          <div class="mc-title-wrap">
            <h1>B2C · B2B 판매 · 가격 배정</h1>
            <span class="mc-count-pill">등록 상품 ${products.length}종</span>
          </div>
          <div class="mc-header-actions" style="flex-wrap: wrap;">
            <button type="button" class="mc-btn-secondary" id="btn-ca-open-history">업로드 이력 · 롤백</button>
            <button type="button" class="mc-btn-secondary" id="btn-ca-dl-daily">당일 시세 양식(현재가) 다운로드</button>
            <button type="button" class="mc-btn-primary" id="btn-ca-open-daily">당일 신선 시세 CSV 업로드</button>
          </div>
        </div>

        <div class="mc-surface" style="padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${[
              ['ALL', '전체'],
              ['BOTH', '공통 (B2C+B2B)'],
              ['B2C_ONLY', '일반몰 전용 (B2C)'],
              ['B2B_ONLY', '기관 전용 (B2B)']
            ].map(([k, lbl]) => `
              <button type="button" class="${targetFilter === k ? 'mc-btn-primary' : 'mc-btn-secondary'} btn-ca-target-filter" data-target="${k}" style="height: 32px; font-size: 12px;">${lbl}</button>
            `).join('')}
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <select id="ca-l1-filter" class="erp-input" style="width: 140px; height: 34px;">
              <option value="ALL">전체 대분류</option>
              ${l1List.map(c => `<option value="${c.code}" ${l1Filter === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
            <select id="ca-l2-filter" class="erp-input" style="width: 140px; height: 34px;" ${l1Filter === 'ALL' ? 'disabled' : ''}>
              <option value="ALL">전체 중분류</option>
              ${l2List.map(c => `<option value="${c.code}" ${l2Filter === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
            <select id="ca-l3-filter" class="erp-input" style="width: 140px; height: 34px;" ${l2Filter === 'ALL' ? 'disabled' : ''}>
              <option value="ALL">전체 소분류</option>
              ${l3List.map(c => `<option value="${c.code}" ${l3Filter === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
            <input id="ca-search" class="erp-input" type="search" style="width: 210px; height: 34px;" placeholder="상품명 · 바코드 검색" value="${esc(keyword)}" />
          </div>
        </div>

        ${selectedIds.size > 0 ? `
          <div class="mc-bulk-bar" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <strong style="font-size: 13px;">${selectedIds.size}개 상품 선택됨</strong>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <select id="ca-bulk-target" class="erp-input" style="width: 160px; height: 32px; font-size: 12px;">
                <option value="">판매대상 변경 안함</option>
                <option value="BOTH">공통 (B2C+B2B)</option>
                <option value="B2C_ONLY">일반몰 전용 (B2C)</option>
                <option value="B2B_ONLY">기관 전용 (B2B)</option>
              </select>
              <div style="display: flex; align-items: center; gap: 4px;">
                <input id="ca-bulk-b2b-disc" type="number" min="0" max="80" placeholder="B2B 할인%" class="erp-input" style="width: 96px; height: 32px; font-size: 12px;" />
              </div>
              <select id="ca-bulk-pub" class="erp-input" style="width: 130px; height: 32px; font-size: 12px;">
                <option value="">노출 변경 안함</option>
                <option value="PUBLISHED_FEED">홈 진열</option>
                <option value="SEARCH_ONLY">검색 전용</option>
                <option value="SUSPENDED">노출 중지</option>
              </select>
              <button type="button" id="btn-ca-bulk-apply" class="mc-btn-primary" style="height: 32px; font-size: 12px;">선택 일괄 배정</button>
              <button type="button" id="btn-ca-dl-selected" class="mc-btn-secondary" style="height: 32px; font-size: 12px;">선택 미니 엑셀 다운로드</button>
              <button type="button" id="btn-ca-bulk-clear" class="mc-btn-secondary" style="height: 32px; font-size: 12px;">선택 해제</button>
            </div>
          </div>
        ` : ''}

        <div class="mc-surface">
          <div class="mc-table-wrap">
            <table class="mc-table">
              <thead>
                <tr>
                  <th style="width: 36px;"><input type="checkbox" id="ca-chk-all" ${allChecked ? 'checked' : ''} /></th>
                  <th>상품명 · 기준가</th>
                  <th>판매 대상</th>
                  <th style="text-align: right;">B2C 판매가 (원)</th>
                  <th style="text-align: right;">B2B 공급가 (원)</th>
                  <th style="text-align: center;">B2B 최소수량</th>
                  <th>노출 상태</th>
                  <th style="text-align: right;">적용</th>
                </tr>
              </thead>
              <tbody>
                ${paged.length === 0 ? `
                  <tr><td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">조건에 맞는 상품이 없습니다.</td></tr>
                ` : paged.map(p => {
                  const st = p.sales_target || 'BOTH';
                  const pub = p.online_publish_status || 'PUBLISHED_FEED';
                  return `
                    <tr data-pid="${esc(p.id)}">
                      <td><input type="checkbox" class="ca-row-chk" data-pid="${esc(p.id)}" ${selectedIds.has(p.id) ? 'checked' : ''} /></td>
                      <td>
                        <strong style="color: #0f172a;">${esc(p.name)}</strong>
                        <div style="font-size: 11.5px; color: #64748b;">${esc(p.spec || '-')} · 정상가 ${Number(p.regular_price || 0).toLocaleString()}원</div>
                      </td>
                      <td>
                        <select class="erp-input ca-target" data-pid="${esc(p.id)}" style="height: 30px; font-size: 12px; min-width: 125px;">
                          <option value="BOTH" ${st === 'BOTH' ? 'selected' : ''}>공통 (B2C+B2B)</option>
                          <option value="B2C_ONLY" ${st === 'B2C_ONLY' ? 'selected' : ''}>일반 전용 (B2C)</option>
                          <option value="B2B_ONLY" ${st === 'B2B_ONLY' ? 'selected' : ''}>기관 전용 (B2B)</option>
                        </select>
                      </td>
                      <td style="text-align: right;">
                        <input type="number" min="0" class="erp-input ca-b2c-price" data-pid="${esc(p.id)}" value="${Number(p.sale_price ?? p.regular_price ?? 0)}" style="width: 100px; height: 30px; text-align: right; display: inline-block;" />
                      </td>
                      <td style="text-align: right;">
                        <input type="number" min="0" class="erp-input ca-b2b-price" data-pid="${esc(p.id)}" value="${Number(p.b2b_price ?? 0)}" placeholder="0=일반가" style="width: 100px; height: 30px; text-align: right; display: inline-block;" />
                      </td>
                      <td style="text-align: center;">
                        <input type="number" min="1" class="erp-input ca-b2b-min" data-pid="${esc(p.id)}" value="${Number(p.b2b_min_qty ?? 1)}" style="width: 68px; height: 30px; text-align: center; display: inline-block;" />
                      </td>
                      <td>
                        <select class="erp-input ca-pub" data-pid="${esc(p.id)}" style="height: 30px; font-size: 12px; min-width: 100px;">
                          <option value="PUBLISHED_FEED" ${pub === 'PUBLISHED_FEED' ? 'selected' : ''}>홈 진열</option>
                          <option value="SEARCH_ONLY" ${pub === 'SEARCH_ONLY' ? 'selected' : ''}>검색 전용</option>
                          <option value="SUSPENDED" ${pub === 'SUSPENDED' ? 'selected' : ''}>노출 중지</option>
                        </select>
                      </td>
                      <td style="text-align: right;">
                        <button type="button" class="mc-btn-primary btn-ca-save-row" data-pid="${esc(p.id)}" style="height: 30px; padding: 0 12px; font-size: 12px;">저장</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ${renderMartPaginationHtml(pgInfo, 'ca')}
        </div>

        ${priceDrawerOpen ? `
          <div class="mc-drawer-backdrop" id="ca-daily-backdrop">
            <div class="mc-drawer" style="width: 720px;">
              <div class="mc-drawer-header">
                <div>
                  <h2>당일 신선 · 야채 시세 일괄 업데이트 (부분 반영 · 오류 재수정)</h2>
                  <div style="font-size: 12px; color: #64748b; margin-top: 2px;">성공 건은 즉시 반영하고, 실패한 행만 아래에서 바로 수정해 재반영하거나 오류 CSV로 받을 수 있습니다.</div>
                </div>
                <button type="button" class="mc-drawer-close" id="btn-ca-close-daily">×</button>
              </div>
              <div class="mc-drawer-body">
                <div class="mc-drawer-section">
                  <div class="mc-drawer-section-title">0. 업로드 방식 선택</div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button type="button" class="${priceUploadMode === 'PARTIAL' ? 'mc-btn-primary' : 'mc-btn-secondary'} btn-ca-upload-mode" data-mode="PARTIAL" style="height: 34px; font-size: 12px;">A. 부분 업데이트 (올린 상품만 수정)</button>
                    <button type="button" class="${priceUploadMode === 'SYNC_FRESH' ? 'mc-btn-primary' : 'mc-btn-secondary'} btn-ca-upload-mode" data-mode="SYNC_FRESH" style="height: 34px; font-size: 12px;">B. 오늘의 신선 동기화 (미포함 농·축·수산 자동 중지)</button>
                  </div>
                </div>
                <div class="mc-drawer-section">
                  <div class="mc-drawer-section-title">
                    <span>1. 당일 시세 CSV 불러오기</span>
                    <label class="mc-btn-secondary" style="height: 28px; padding: 0 10px; font-size: 12px; display: inline-flex; align-items: center; cursor: pointer;">
                      CSV 파일 선택
                      <input id="file-ca-daily-csv" type="file" accept=".csv,.tsv,.txt" style="display: none;" />
                    </label>
                  </div>
                  <textarea id="txt-ca-daily-csv" rows="5" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: monospace; font-size: 12px;" placeholder="바코드,상품명,규격,매입원가,정상판매가,B2C판매가,B2B공급가,재고">${esc(priceCsvDraft)}</textarea>
                </div>

                ${priceBatchResult ? `
                  <div class="mc-drawer-section" style="background: ${priceBatchResult.error_count > 0 ? '#fffbeb' : '#f0fdf4'}; border-color: ${priceBatchResult.error_count > 0 ? '#fde68a' : '#bbf7d0'};">
                    <div class="mc-drawer-section-title">
                      <span>반영 결과: 성공 ${priceBatchResult.success_count}건 / 실패 ${priceBatchResult.error_count}건${priceBatchResult.synced_suspended_count ? ` (미포함 신선 ${priceBatchResult.synced_suspended_count}건 중지)` : ''}</span>
                      ${priceBatchResult.error_count > 0 ? `
                        <button type="button" class="mc-btn-secondary" id="btn-ca-dl-errors" style="height: 28px; padding: 0 10px; font-size: 12px;">오류 ${priceBatchResult.error_count}건만 CSV 다운로드</button>
                      ` : ''}
                    </div>
                    ${priceBatchResult.error_count > 0 ? `
                      <div style="font-size: 12px; color: #92400e; margin-bottom: 8px;">성공한 ${priceBatchResult.success_count}건은 이미 저장되었습니다. 아래 실패 행만 수정 후 <b>[오류건만 재반영]</b>을 누르세요.</div>
                      <div style="overflow-x: auto;">
                        <table class="mc-table" style="font-size: 11.5px; background: #fff;">
                          <thead><tr><th>행</th><th>바코드</th><th>상품명</th><th>사유</th><th>정상가</th><th>B2C가</th><th>B2B가</th><th>재고</th></tr></thead>
                          <tbody>
                            ${priceBatchResult.errors.map((er, idx) => `
                              <tr>
                                <td>${er.row_no}</td>
                                <td><input type="text" class="erp-input err-bc" data-idx="${idx}" value="${esc(er.barcode)}" style="width: 105px; height: 28px; font-size: 11.5px;" /></td>
                                <td><input type="text" class="erp-input err-nm" data-idx="${idx}" value="${esc(er.name)}" style="width: 120px; height: 28px; font-size: 11.5px;" /></td>
                                <td style="color: #b91c1c; font-weight: 700;">${esc(er.reason)}</td>
                                <td><input type="text" class="erp-input err-reg" data-idx="${idx}" value="${esc(er.regular_price)}" style="width: 66px; height: 28px; font-size: 11.5px; text-align: right;" /></td>
                                <td><input type="text" class="erp-input err-sale" data-idx="${idx}" value="${esc(er.sale_price)}" style="width: 66px; height: 28px; font-size: 11.5px; text-align: right;" /></td>
                                <td><input type="text" class="erp-input err-b2b" data-idx="${idx}" value="${esc(er.b2b_price)}" style="width: 66px; height: 28px; font-size: 11.5px; text-align: right;" /></td>
                                <td><input type="text" class="erp-input err-stk" data-idx="${idx}" value="${esc(er.stock_qty)}" style="width: 54px; height: 28px; font-size: 11.5px; text-align: right;" /></td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                      <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                        <button type="button" class="mc-btn-primary" id="btn-ca-retry-errors" style="height: 32px; font-size: 12px;">오류 ${priceBatchResult.error_count}건만 재반영</button>
                      </div>
                    ` : ''}
                  </div>
                ` : `
                  <div class="mc-drawer-section">
                    <div class="mc-drawer-section-title">
                      <span>2. 매칭 · 가격 변동 미리보기</span>
                      <span id="ca-daily-count" class="mc-pill mc-pill-gray">0건 인식</span>
                    </div>
                    <div id="ca-daily-preview" style="max-height: 220px; overflow: auto; font-size: 12px; color: #64748b;">CSV를 불러오거나 붙여넣으면 기존 상품 매칭 결과가 표시됩니다.</div>
                  </div>
                `}
              </div>
              <div class="mc-drawer-footer">
                <button type="button" class="mc-btn-secondary" id="btn-ca-cancel-daily">닫기</button>
                <button type="button" class="mc-btn-primary" id="btn-ca-apply-daily">시세 일괄 반영</button>
              </div>
            </div>
          </div>
        ` : ''}

        ${historyDrawerOpen ? `
          <div class="mc-drawer-backdrop" id="ca-history-backdrop">
            <div class="mc-drawer" style="width: 620px;">
              <div class="mc-drawer-header">
                <div>
                  <h2>시세 · 일괄 업로드 이력 및 원클릭 롤백</h2>
                  <div style="font-size: 12px; color: #64748b; margin-top: 2px;">잘못 업로드된 경우 해당 업로드 직전 가격/재고 상태로 되돌립니다.</div>
                </div>
                <button type="button" class="mc-drawer-close" id="btn-ca-close-history">×</button>
              </div>
              <div class="mc-drawer-body">
                ${uploadHistory.length === 0 ? `
                  <div style="text-align: center; padding: 36px; color: #64748b;">아직 업로드 이력이 없습니다.</div>
                ` : `
                  <table class="mc-table" style="font-size: 12px;">
                    <thead><tr><th>일시</th><th>방식</th><th>결과</th><th>상태</th><th style="text-align: right;">복원</th></tr></thead>
                    <tbody>
                      ${uploadHistory.map(h => `
                        <tr>
                          <td>${esc(String(h.created_at || '').slice(0, 16).replace('T', ' '))}</td>
                          <td><span class="mc-pill mc-pill-gray">${h.mode === 'SYNC_FRESH' ? '신선동기화' : '부분수정'}</span></td>
                          <td>성공 ${h.success_count}건 / 실패 ${h.error_count}건</td>
                          <td>${h.rolled_back_at ? '<span class="mc-pill mc-pill-amber">복원됨</span>' : '<span class="mc-pill mc-pill-green">적용중</span>'}</td>
                          <td style="text-align: right;">
                            <button type="button" class="mc-row-edit-btn btn-ca-rollback" data-bid="${esc(h.batch_id)}">이 시점으로 롤백</button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `}
              </div>
              <div class="mc-drawer-footer">
                <button type="button" class="mc-btn-secondary" id="btn-ca-cancel-history">닫기</button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    container.querySelectorAll('.btn-ca-target-filter').forEach(btn => {
      btn.addEventListener('click', () => { targetFilter = btn.dataset.target; currentPage = 1; render(); });
    });
    container.querySelector('#ca-l1-filter')?.addEventListener('change', (e) => {
      l1Filter = e.target.value;
      l2Filter = 'ALL';
      l3Filter = 'ALL';
      currentPage = 1;
      render();
    });
    container.querySelector('#ca-l2-filter')?.addEventListener('change', (e) => {
      l2Filter = e.target.value;
      l3Filter = 'ALL';
      currentPage = 1;
      render();
    });
    container.querySelector('#ca-l3-filter')?.addEventListener('change', (e) => {
      l3Filter = e.target.value;
      currentPage = 1;
      render();
    });
    bindMartPaginationEvents(container, {
      prefix: 'ca',
      totalPages: pgInfo.totalPages,
      onPageChange: (nextP) => { currentPage = nextP; render(); },
      onSizeChange: (nextSz) => { pageSize = nextSz; currentPage = 1; render(); }
    });
    const searchEl = container.querySelector('#ca-search');
    searchEl?.addEventListener('input', (e) => {
      keyword = e.target.value;
      currentPage = 1;
      const pos = e.target.selectionStart;
      render();
      const next = container.querySelector('#ca-search');
      if (next) {
        next.focus();
        if (typeof pos === 'number') next.setSelectionRange(pos, pos);
      }
    });

    container.querySelector('#ca-chk-all')?.addEventListener('change', (e) => {
      if (e.target.checked) paged.forEach(p => selectedIds.add(p.id));
      else paged.forEach(p => selectedIds.delete(p.id));
      render();
    });
    container.querySelectorAll('.ca-row-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        if (chk.checked) selectedIds.add(chk.dataset.pid);
        else selectedIds.delete(chk.dataset.pid);
        render();
      });
    });
    container.querySelector('#btn-ca-bulk-clear')?.addEventListener('click', () => {
      selectedIds.clear();
      render();
    });
    container.querySelector('#btn-ca-bulk-apply')?.addEventListener('click', async () => {
      const bulkTarget = container.querySelector('#ca-bulk-target')?.value || '';
      const bulkPub = container.querySelector('#ca-bulk-pub')?.value || '';
      const discRaw = container.querySelector('#ca-bulk-b2b-disc')?.value;
      const hasDisc = discRaw !== '' && discRaw !== null && !Number.isNaN(Number(discRaw));
      const discPct = hasDisc ? Math.min(80, Math.max(0, Number(discRaw))) : 0;

      for (const pid of selectedIds) {
        const p = products.find(x => x.id === pid);
        if (!p) continue;
        const patch = { id: pid };
        if (bulkTarget) patch.sales_target = bulkTarget;
        if (bulkPub) patch.online_publish_status = bulkPub;
        if (hasDisc) {
          const base = Number(p.regular_price || p.sale_price || 0);
          patch.b2b_price = Math.round((base * (1 - discPct / 100)) / 10) * 10;
        }
        await martApi.updateProduct(patch);
      }
      selectedIds.clear();
      await renderMartChannelAssignView(container);
    });

    container.querySelectorAll('.btn-ca-save-row').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.pid;
        const escPid = CSS.escape(pid);
        await martApi.updateProduct({
          id: pid,
          sales_target: container.querySelector(`.ca-target[data-pid="${escPid}"]`)?.value || 'BOTH',
          sale_price: Math.max(0, Number(container.querySelector(`.ca-b2c-price[data-pid="${escPid}"]`)?.value ?? 0)),
          b2b_price: Math.max(0, Number(container.querySelector(`.ca-b2b-price[data-pid="${escPid}"]`)?.value ?? 0)),
          b2b_min_qty: Math.max(1, Number(container.querySelector(`.ca-b2b-min[data-pid="${escPid}"]`)?.value ?? 1)),
          online_publish_status: container.querySelector(`.ca-pub[data-pid="${escPid}"]`)?.value || 'PUBLISHED_FEED'
        });
        btn.textContent = '완료';
        setTimeout(() => renderMartChannelAssignView(container), 400);
      });
    });

    const exportPriceCsv = (list, filename) => {
      downloadExcelCsv(
        filename,
        ['바코드', '상품명', '규격', '매입원가', '정상판매가', 'B2C판매가', 'B2B공급가', '재고'],
        list.map(p => [
          p.barcode || '',
          p.name || '',
          p.spec || '-',
          p.cost_price ?? 0,
          p.regular_price ?? 0,
          p.sale_price ?? p.regular_price ?? 0,
          p.b2b_price ?? 0,
          p.stock_qty ?? 50
        ])
      );
    };

    container.querySelector('#btn-ca-dl-selected')?.addEventListener('click', () => {
      const picked = products.filter(p => selectedIds.has(p.id));
      if (picked.length > 0) exportPriceCsv(picked, `mart_selected_mini_${new Date().toISOString().slice(0, 10)}.csv`);
    });

    const parseRawPriceRows = (rawText) => {
      const rows = parseDelimitedRows(rawText).filter(c => (c[0] || c[1]) && c[0] !== '바코드');
      return rows.map((c, idx) => ({
        row_no: idx + 1,
        barcode: String(c[0] || '').trim(),
        name: String(c[1] || '').trim(),
        spec: String(c[2] || '').trim(),
        cost_price: c[3] ?? '',
        regular_price: c[4] ?? '',
        sale_price: c[5] ?? '',
        b2b_price: c[6] ?? '',
        stock_qty: c[7] ?? ''
      }));
    };

    const parseDailyMatches = (rawText) => {
      const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
      return parseRawPriceRows(rawText).map(r => {
        const matched = products.find(p => (r.barcode && p.barcode === r.barcode) || (r.name && norm(p.name) === norm(r.name)));
        return {
          ...r,
          name: r.name || matched?.name || '-',
          matched,
          sale_num: r.sale_price !== '' ? Number(String(r.sale_price).replace(/,/g, '')) : undefined,
          b2b_num: r.b2b_price !== '' ? Number(String(r.b2b_price).replace(/,/g, '')) : undefined
        };
      });
    };

    const renderDailyPreview = () => {
      if (priceBatchResult) return;
      const text = container.querySelector('#txt-ca-daily-csv')?.value || '';
      priceCsvDraft = text;
      const list = parseDailyMatches(text);
      const matchedCount = list.filter(x => x.matched).length;
      const cntEl = container.querySelector('#ca-daily-count');
      const prevEl = container.querySelector('#ca-daily-preview');
      if (cntEl) cntEl.textContent = `${matchedCount} / ${list.length}건 매칭`;
      if (prevEl) {
        if (list.length === 0) {
          prevEl.innerHTML = 'CSV를 불러오거나 붙여넣으면 기존 상품 매칭 결과가 표시됩니다.';
        } else {
          prevEl.innerHTML = `
            <table class="mc-table" style="font-size: 11.5px;">
              <thead><tr><th>상태</th><th>상품명</th><th style="text-align:right;">B2C 변경</th><th style="text-align:right;">B2B 변경</th></tr></thead>
              <tbody>
                ${list.map(it => `
                  <tr>
                    <td><span class="mc-pill ${it.matched ? 'mc-pill-green' : 'mc-pill-red'}">${it.matched ? '매칭' : '미등록'}</span></td>
                    <td><b>${esc(it.name)}</b></td>
                    <td class="mc-num">${it.matched ? `${Number(it.matched.sale_price ?? it.matched.regular_price ?? 0).toLocaleString()} -> <b>${Number(Number.isFinite(it.sale_num) ? it.sale_num : (it.matched.sale_price ?? 0)).toLocaleString()}원</b>` : '-'}</td>
                    <td class="mc-num">${it.matched ? `${Number(it.matched.b2b_price ?? 0).toLocaleString()} -> <b>${Number(Number.isFinite(it.b2b_num) ? it.b2b_num : (it.matched.b2b_price ?? 0)).toLocaleString()}원</b>` : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        }
      }
    };

    container.querySelector('#btn-ca-dl-daily')?.addEventListener('click', () => {
      const exportList = filtered.length > 0 ? filtered : products;
      exportPriceCsv(exportList, `mart_daily_price_${new Date().toISOString().slice(0, 10)}.csv`);
    });
    container.querySelector('#btn-ca-open-daily')?.addEventListener('click', () => {
      priceBatchResult = null;
      priceDrawerOpen = true;
      render();
    });
    const closeDaily = () => { priceDrawerOpen = false; priceBatchResult = null; render(); };
    container.querySelector('#btn-ca-close-daily')?.addEventListener('click', closeDaily);
    container.querySelector('#btn-ca-cancel-daily')?.addEventListener('click', closeDaily);
    container.querySelector('#ca-daily-backdrop')?.addEventListener('click', (e) => { if (e.target.id === 'ca-daily-backdrop') closeDaily(); });
    container.querySelectorAll('.btn-ca-upload-mode').forEach(btn => {
      btn.addEventListener('click', () => { priceUploadMode = btn.dataset.mode; render(); });
    });
    container.querySelector('#txt-ca-daily-csv')?.addEventListener('input', () => {
      priceBatchResult = null;
      renderDailyPreview();
    });
    container.querySelector('#file-ca-daily-csv')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await readCsvOrTextFile(file);
      const ta = container.querySelector('#txt-ca-daily-csv');
      if (ta) ta.value = text;
      priceBatchResult = null;
      renderDailyPreview();
    });
    container.querySelector('#btn-ca-apply-daily')?.addEventListener('click', async () => {
      const rows = parseRawPriceRows(container.querySelector('#txt-ca-daily-csv')?.value || '');
      if (rows.length === 0) { showToast('업로드할 시세 데이터가 없습니다.', 'warn'); return; }
      const batchRes = await martApi.applyDailyPriceBatch({ rows, mode: priceUploadMode });
      priceBatchResult = batchRes;
      if (batchRes.error_count === 0) {
        priceDrawerOpen = false;
        priceCsvDraft = '';
        priceBatchResult = null;
        showToast(`성공 ${batchRes.success_count}건 시세가 반영되었습니다.${batchRes.synced_suspended_count ? ` (미포함 신선 ${batchRes.synced_suspended_count}건 노출중지)` : ''}`, 'success');
      }
      await renderMartChannelAssignView(container);
    });
    container.querySelector('#btn-ca-dl-errors')?.addEventListener('click', () => {
      if (!priceBatchResult?.errors?.length) return;
      exportPriceCsv(priceBatchResult.errors, `mart_price_errors_${new Date().toISOString().slice(0, 10)}.csv`);
    });
    container.querySelector('#btn-ca-retry-errors')?.addEventListener('click', async () => {
      if (!priceBatchResult?.errors?.length) return;
      const retryRows = priceBatchResult.errors.map((er, idx) => ({
        row_no: er.row_no,
        barcode: container.querySelector(`.err-bc[data-idx="${idx}"]`)?.value?.trim() || '',
        name: container.querySelector(`.err-nm[data-idx="${idx}"]`)?.value?.trim() || '',
        cost_price: er.cost_price,
        regular_price: container.querySelector(`.err-reg[data-idx="${idx}"]`)?.value?.trim() ?? '',
        sale_price: container.querySelector(`.err-sale[data-idx="${idx}"]`)?.value?.trim() ?? '',
        b2b_price: container.querySelector(`.err-b2b[data-idx="${idx}"]`)?.value?.trim() ?? '',
        stock_qty: container.querySelector(`.err-stk[data-idx="${idx}"]`)?.value?.trim() ?? ''
      }));
      const retryRes = await martApi.applyDailyPriceBatch({ rows: retryRows, mode: 'PARTIAL' });
      priceBatchResult = retryRes;
      if (retryRes.error_count === 0) {
        priceDrawerOpen = false;
        priceCsvDraft = '';
        priceBatchResult = null;
        showToast(`오류건 ${retryRes.success_count}건 재반영이 완료되었습니다.`, 'success');
      }
      await renderMartChannelAssignView(container);
    });

    container.querySelector('#btn-ca-open-history')?.addEventListener('click', async () => {
      const histRes = await martApi.getPriceUploadHistory().catch(() => ({ history: [] }));
      uploadHistory = histRes.history || [];
      historyDrawerOpen = true;
      render();
    });
    const closeHistory = () => { historyDrawerOpen = false; render(); };
    container.querySelector('#btn-ca-close-history')?.addEventListener('click', closeHistory);
    container.querySelector('#ca-history-backdrop')?.addEventListener('click', (e) => { if (e.target.id === 'ca-history-backdrop') closeHistory(); });
    container.querySelector('#btn-ca-cancel-history')?.addEventListener('click', closeHistory);
    container.querySelectorAll('.btn-ca-rollback').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.armed !== '1') {
          btn.dataset.armed = '1';
          btn.textContent = '복원 확인(다시 클릭)';
          btn.style.color = '#b91c1c';
          showToast('직전 상태로 복원하려면 한 번 더 클릭하세요.', 'warn');
          return;
        }
        const rb = await martApi.rollbackPriceUpload(btn.dataset.bid);
        historyDrawerOpen = false;
        showToast(`${rb.restored_count}개 상품이 직전 상태로 복원되었습니다.`, 'success');
        await renderMartChannelAssignView(container);
      });
    });

    if (priceDrawerOpen) renderDailyPreview();
  }

  render();
}
