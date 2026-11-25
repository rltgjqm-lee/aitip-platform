/**
 * AITIP Mart Portal - 2-2. 당일 시세 · 재고 변동 전용 모듈 (ESM)
 * 신선(농·축·수산) 및 일반 상품의 당일 시세·재고 즉시 수정, 일괄 업로드,
 * 오류 행만 인라인 재업로드, SYNC_FRESH 미포함 자동 품절, 이력·원클릭 롤백을 제공한다.
 */

import { martApi } from '../api.js';
import { paginateArray, renderMartPaginationHtml, bindMartPaginationEvents } from '../utils/pagination.js';
import { downloadExcelCsv, readCsvOrTextFile, parseDelimitedRows } from '../utils/excel-csv.js';
import { esc } from '../utils/html.js';
import { renderProductThumbHtml } from './catalog-helpers.js';

let activeTab = 'LIVE'; // 'LIVE' | 'BATCH' | 'HISTORY'
let scopeFilter = 'FRESH'; // 'FRESH' | 'ALL' | 'OUT'
let keyword = '';
let currentPage = 1;
let pageSize = 10;
let uploadMode = 'PARTIAL'; // 'PARTIAL' | 'SYNC_FRESH'
let csvDraft = '';
let batchResult = null;
const selectedIds = new Set();

function isFreshProduct(p = {}) {
  return ['01', '02', '03'].includes(String(p.category_l1 || '')) || p.category_type === 'FRESH';
}

export async function renderMartDailyPriceView(container) {
  if (!container) return;
  const [catRes, histRes] = await Promise.all([
    martApi.getCatalog(),
    martApi.getPriceUploadHistory()
  ]);
  const products = catRes.products || [];
  const uploadHistory = histRes.history || [];

  function render() {
    const q = keyword.trim().toLowerCase();
    const filtered = products.filter(p => {
      if (scopeFilter === 'FRESH' && !isFreshProduct(p)) return false;
      if (scopeFilter === 'OUT' && Number(p.stock_qty ?? 50) > 0) return false;
      if (q) {
        const hay = `${p.name || ''} ${p.barcode || ''} ${p.spec || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const pageInfo = paginateArray(filtered, currentPage, pageSize);
    currentPage = pageInfo.page;
    const allPageChecked = pageInfo.paged.length > 0 && pageInfo.paged.every(p => selectedIds.has(p.id));

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="mc-page-header">
          <div class="mc-title-wrap">
            <h1>당일 시세 · 재고 변동</h1>
            <span class="mc-count-pill">신선 ${products.filter(isFreshProduct).length}종 · 전체 ${products.length}종</span>
          </div>
          <div class="mc-header-actions">
            <button type="button" class="mc-btn-secondary" id="btn-dp-mini-excel">선택 미니 엑셀 (${selectedIds.size})</button>
            <button type="button" class="mc-btn-secondary" id="btn-dp-template">시세 양식 다운로드</button>
          </div>
        </div>

        <div class="mc-tabs">
          <button type="button" class="mc-tab ${activeTab === 'LIVE' ? 'active' : ''}" data-dp-tab="LIVE">실시간 시세·재고 수정</button>
          <button type="button" class="mc-tab ${activeTab === 'BATCH' ? 'active' : ''}" data-dp-tab="BATCH">당일 시세 일괄 업로드${batchResult?.error_count ? ` (오류 ${batchResult.error_count}건)` : ''}</button>
          <button type="button" class="mc-tab ${activeTab === 'HISTORY' ? 'active' : ''}" data-dp-tab="HISTORY">업로드 이력 · 롤백 (${uploadHistory.length})</button>
        </div>

        ${activeTab === 'LIVE' ? `
          <div class="mc-surface">
            <div class="mc-filter-bar">
              <div class="mc-filter-controls">
                <select id="dp-scope-filter" class="mc-select">
                  <option value="FRESH" ${scopeFilter === 'FRESH' ? 'selected' : ''}>신선(농·축·수산) 중심</option>
                  <option value="ALL" ${scopeFilter === 'ALL' ? 'selected' : ''}>전체 상품</option>
                  <option value="OUT" ${scopeFilter === 'OUT' ? 'selected' : ''}>품절 상품 (재고 0)</option>
                </select>
                <input id="dp-search" class="mc-search" type="text" value="${esc(keyword)}" placeholder="상품명 · 바코드 · 규격 검색" />
              </div>
              <div style="font-size: 12px; color: #64748b;">
                조회 ${filtered.length}건 · 재고 0 입력 후 [적용] 시 즉시 품절 처리
              </div>
            </div>

            <div class="mc-table-wrap">
              <table class="mc-table">
                <thead>
                  <tr>
                    <th style="width: 36px; text-align: center;">
                      <input type="checkbox" id="chk-dp-all" ${allPageChecked ? 'checked' : ''} />
                    </th>
                    <th>상품명 · 바코드</th>
                    <th style="text-align: right;">원가 (원)</th>
                    <th style="text-align: right;">정상가 (원)</th>
                    <th style="text-align: right;">판매가 (원)</th>
                    <th style="text-align: right;">B2B 공급가</th>
                    <th style="text-align: right;">재고 (0=품절)</th>
                    <th style="text-align: right;">반영</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageInfo.paged.length === 0 ? `
                    <tr><td colspan="8" style="text-align: center; padding: 48px 16px; color: #64748b;">조건에 맞는 상품이 없습니다.</td></tr>
                  ` : pageInfo.paged.map(p => {
                    const stock = Number(p.stock_qty ?? 50);
                    return `
                      <tr data-pid="${esc(p.id)}">
                        <td style="text-align: center;">
                          <input type="checkbox" class="chk-dp-row" data-id="${esc(p.id)}" ${selectedIds.has(p.id) ? 'checked' : ''} />
                        </td>
                        <td>
                          <div style="display: flex; align-items: center; gap: 10px;">
                            ${renderProductThumbHtml(p.image_url, p.name, 36)}
                            <div style="min-width: 0;">
                              <div style="font-weight: 700; color: #0f172a;">${esc(p.name)}</div>
                              <div style="font-size: 11.5px; color: #64748b;">${esc(p.spec || '-')} · ${esc(p.barcode || p.id)} ${stock <= 0 ? '<span class="mc-pill mc-pill-red" style="margin-left:4px;">품절</span>' : ''}</div>
                            </div>
                          </div>
                        </td>
                        <td style="text-align: right;">
                          <input type="number" min="0" class="erp-input dp-cost" data-id="${esc(p.id)}" value="${Number(p.cost_price || 0)}" style="width: 88px; text-align: right; height: 32px;" />
                        </td>
                        <td style="text-align: right;">
                          <input type="number" min="0" class="erp-input dp-reg" data-id="${esc(p.id)}" value="${Number(p.regular_price || 0)}" style="width: 92px; text-align: right; height: 32px;" />
                        </td>
                        <td style="text-align: right;">
                          <input type="number" min="0" class="erp-input dp-sale" data-id="${esc(p.id)}" value="${Number(p.sale_price ?? p.regular_price ?? 0)}" style="width: 92px; text-align: right; height: 32px; font-weight: 700;" />
                        </td>
                        <td style="text-align: right;">
                          <input type="number" min="0" class="erp-input dp-b2b" data-id="${esc(p.id)}" value="${Number(p.b2b_price ?? 0)}" style="width: 88px; text-align: right; height: 32px;" />
                        </td>
                        <td style="text-align: right;">
                          <input type="number" min="0" class="erp-input dp-stock" data-id="${esc(p.id)}" value="${stock}" style="width: 72px; text-align: right; height: 32px;" />
                        </td>
                        <td style="text-align: right;">
                          <button type="button" class="mc-btn-primary btn-dp-save-row" data-id="${esc(p.id)}" style="height: 30px; padding: 0 12px; font-size: 12px;">적용</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
            ${renderMartPaginationHtml(pageInfo, 'dp')}
          </div>
        ` : ''}

        ${activeTab === 'BATCH' ? `
          <div class="mc-surface" style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div>
                <strong style="font-size: 14px; color: #0f172a;">당일 시세 · 재고 CSV/엑셀 일괄 반영</strong>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">일부 행에 오류가 있어도 정상 행은 즉시 반영되며, 오류 행만 아래 표에서 수정 후 재업로드할 수 있습니다.</div>
              </div>
              <select id="dp-upload-mode" class="mc-select">
                <option value="PARTIAL" ${uploadMode === 'PARTIAL' ? 'selected' : ''}>부분 반영 (올린 상품만 수정)</option>
                <option value="SYNC_FRESH" ${uploadMode === 'SYNC_FRESH' ? 'selected' : ''}>신선 전체 동기화 (미포함 신선 자동 판매중지)</option>
              </select>
            </div>

            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <label class="mc-btn-secondary" style="display: inline-flex; align-items: center; cursor: pointer;">
                CSV / TSV 파일 불러오기
                <input id="file-dp-csv" type="file" accept=".csv,.tsv,.txt" style="display: none;" />
              </label>
              <button type="button" class="mc-btn-primary" id="btn-dp-run-batch">일괄 시세 반영</button>
            </div>

            <textarea id="txt-dp-csv" rows="6" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: monospace; font-size: 12px;" placeholder="바코드, 상품명, 매입원가, 정상가, 판매가, B2B공급가, 재고수량">${esc(csvDraft)}</textarea>

            ${batchResult ? `
              <div style="padding: 12px 14px; border-radius: 8px; background: ${batchResult.error_count > 0 ? '#fffbeb' : '#f0fdf4'}; border: 1px solid ${batchResult.error_count > 0 ? '#fde68a' : '#bbf7d0'}; font-size: 13px;">
                <strong>반영 결과:</strong> 성공 <b>${batchResult.success_count}건</b> · 오류 <b style="color:#b91c1c;">${batchResult.error_count}건</b>${batchResult.synced_suspended_count ? ` · 미포함 신선 중지 <b>${batchResult.synced_suspended_count}건</b>` : ''}
              </div>
              ${batchResult.errors?.length ? `
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="font-size: 13px; color: #b91c1c;">오류 행만 수정 · 재업로드 (${batchResult.errors.length}건)</strong>
                    <div style="display: flex; gap: 6px;">
                      <button type="button" class="mc-btn-secondary" id="btn-dp-dl-errors">오류 행 CSV 다운로드</button>
                      <button type="button" class="mc-btn-primary" id="btn-dp-retry-errors">수정된 오류 행만 재업로드</button>
                    </div>
                  </div>
                  <div class="mc-table-wrap">
                    <table class="mc-table">
                      <thead>
                        <tr><th>행</th><th>바코드</th><th>상품명</th><th>정상가</th><th>판매가</th><th>재고</th><th>오류 사유</th></tr>
                      </thead>
                      <tbody>
                        ${batchResult.errors.map((er, i) => `
                          <tr class="dp-err-row" data-idx="${i}">
                            <td>${er.row_no}</td>
                            <td><input type="text" class="erp-input dp-err-bc" value="${esc(er.barcode)}" style="width: 125px; height: 28px; font-size: 12px;" /></td>
                            <td><input type="text" class="erp-input dp-err-name" value="${esc(er.name)}" style="width: 150px; height: 28px; font-size: 12px;" /></td>
                            <td><input type="text" class="erp-input dp-err-reg" value="${esc(er.regular_price)}" style="width: 80px; height: 28px; font-size: 12px;" /></td>
                            <td><input type="text" class="erp-input dp-err-sale" value="${esc(er.sale_price)}" style="width: 80px; height: 28px; font-size: 12px;" /></td>
                            <td><input type="text" class="erp-input dp-err-stock" value="${esc(er.stock_qty)}" style="width: 64px; height: 28px; font-size: 12px;" /></td>
                            <td style="color: #b91c1c; font-size: 12px;">${esc(er.reason)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              ` : ''}
            ` : ''}
          </div>
        ` : ''}

        ${activeTab === 'HISTORY' ? `
          <div class="mc-surface">
            <div style="padding: 14px 18px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 800; color: #0f172a;">
              시세 업로드 스냅샷 이력 · 원클릭 롤백
            </div>
            <div class="mc-table-wrap">
              <table class="mc-table">
                <thead>
                  <tr>
                    <th>일시</th>
                    <th>모드</th>
                    <th>소스</th>
                    <th style="text-align: right;">성공 / 오류 / 중지</th>
                    <th>상태</th>
                    <th style="text-align: right;">복원</th>
                  </tr>
                </thead>
                <tbody>
                  ${uploadHistory.length === 0 ? `
                    <tr><td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">저장된 업로드 이력이 없습니다.</td></tr>
                  ` : uploadHistory.map(h => `
                    <tr>
                      <td style="font-size: 12px;">${esc((h.created_at || '').slice(0, 19).replace('T', ' '))}</td>
                      <td><span class="mc-pill ${h.mode === 'SYNC_FRESH' ? 'mc-pill-amber' : 'mc-pill-gray'}">${esc(h.mode)}</span></td>
                      <td>${esc(h.source_name || '-')}</td>
                      <td class="mc-num">${h.success_count} / ${h.error_count} / ${h.synced_suspended_count || 0}</td>
                      <td>${h.rolled_back_at ? '<span class="mc-pill mc-pill-gray">복원 완료</span>' : '<span class="mc-pill mc-pill-green">적용중</span>'}</td>
                      <td style="text-align: right;">
                        <button type="button" class="mc-row-edit-btn btn-dp-rollback" data-batch-id="${esc(h.batch_id)}">원클릭 롤백</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    container.querySelectorAll('[data-dp-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.dpTab;
        render();
      });
    });

    container.querySelector('#dp-scope-filter')?.addEventListener('change', (e) => {
      scopeFilter = e.target.value;
      currentPage = 1;
      render();
    });
    const searchEl = container.querySelector('#dp-search');
    searchEl?.addEventListener('input', (e) => {
      keyword = e.target.value;
      currentPage = 1;
      const pos = e.target.selectionStart;
      render();
      const next = container.querySelector('#dp-search');
      if (next) {
        next.focus();
        if (typeof pos === 'number') next.setSelectionRange(pos, pos);
      }
    });

    container.querySelector('#chk-dp-all')?.addEventListener('change', (e) => {
      pageInfo.paged.forEach(p => {
        if (e.target.checked) selectedIds.add(p.id);
        else selectedIds.delete(p.id);
      });
      render();
    });
    container.querySelectorAll('.chk-dp-row').forEach(chk => {
      chk.addEventListener('change', () => {
        if (chk.checked) selectedIds.add(chk.dataset.id);
        else selectedIds.delete(chk.dataset.id);
        const btn = container.querySelector('#btn-dp-mini-excel');
        if (btn) btn.textContent = `선택 미니 엑셀 (${selectedIds.size})`;
      });
    });

    container.querySelector('#btn-dp-mini-excel')?.addEventListener('click', () => {
      const target = selectedIds.size > 0 ? products.filter(p => selectedIds.has(p.id)) : filtered;
      downloadExcelCsv(
        `mart_daily_price_${new Date().toISOString().slice(0, 10)}.csv`,
        ['바코드', '상품명', '매입원가', '정상가', '판매가', 'B2B공급가', '재고수량'],
        target.map(p => [p.barcode || '', p.name || '', p.cost_price || 0, p.regular_price || 0, p.sale_price ?? p.regular_price ?? 0, p.b2b_price ?? 0, p.stock_qty ?? 50])
      );
    });
    container.querySelector('#btn-dp-template')?.addEventListener('click', () => {
      downloadExcelCsv(
        'mart_daily_price_template.csv',
        ['바코드', '상품명', '매입원가', '정상가', '판매가', 'B2B공급가', '재고수량'],
        products.slice(0, 10).map(p => [p.barcode || '', p.name || '', p.cost_price || 0, p.regular_price || 0, p.sale_price ?? p.regular_price ?? 0, p.b2b_price ?? 0, p.stock_qty ?? 50])
      );
    });

    container.querySelectorAll('.btn-dp-save-row').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.id;
        const prod = products.find(p => p.id === pid);
        if (!prod) return;
        await martApi.applyDailyPriceBatch({
          mode: 'PARTIAL',
          source_name: 'inline_daily_price',
          rows: [{
            barcode: prod.barcode || '',
            name: prod.name || '',
            cost_price: container.querySelector(`.dp-cost[data-id="${pid}"]`)?.value,
            regular_price: container.querySelector(`.dp-reg[data-id="${pid}"]`)?.value,
            sale_price: container.querySelector(`.dp-sale[data-id="${pid}"]`)?.value,
            b2b_price: container.querySelector(`.dp-b2b[data-id="${pid}"]`)?.value,
            stock_qty: container.querySelector(`.dp-stock[data-id="${pid}"]`)?.value
          }]
        });
        await renderMartDailyPriceView(container);
      });
    });

    bindMartPaginationEvents(container, {
      prefix: 'dp',
      totalPages: pageInfo.totalPages,
      onPageChange: (nextP) => { currentPage = nextP; render(); },
      onSizeChange: (nextSz) => { pageSize = nextSz; currentPage = 1; render(); }
    });

    container.querySelector('#dp-upload-mode')?.addEventListener('change', (e) => {
      uploadMode = e.target.value;
    });
    container.querySelector('#txt-dp-csv')?.addEventListener('input', (e) => {
      csvDraft = e.target.value;
    });
    container.querySelector('#file-dp-csv')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      csvDraft = await readCsvOrTextFile(file);
      render();
    });

    container.querySelector('#btn-dp-run-batch')?.addEventListener('click', async () => {
      const parsed = parseDelimitedRows(csvDraft)
        .filter(cols => cols.length >= 2 && cols[0] !== '바코드' && cols[1] !== '상품명')
        .map((cols, idx) => ({
          row_no: idx + 1,
          barcode: cols[0] || '',
          name: cols[1] || '',
          cost_price: cols[2] ?? '',
          regular_price: cols[3] ?? '',
          sale_price: cols[4] ?? '',
          b2b_price: cols[5] ?? '',
          stock_qty: cols[6] ?? ''
        }));
      if (parsed.length === 0) return;
      const barcodesToLookup = parsed.map(r => String(r.barcode || '').replace(/[^0-9]/g, '')).filter(b => b.length >= 8);
      if (barcodesToLookup.length > 0) {
        try {
          const catRes = await martApi.lookupBarcodesBatch(barcodesToLookup);
          const byBc = catRes?.items_by_barcode || {};
          parsed.forEach(r => {
            const cleanBc = String(r.barcode || '').replace(/[^0-9]/g, '');
            const hit = byBc[cleanBc];
            if (!hit) return;
            if (!r.name || r.name === '-') r.name = hit.product_name || hit.name || r.name;
            if (!r.spec && hit.standard_spec) r.spec = hit.standard_spec;
            if (!r.image_url && hit.image_url) r.image_url = hit.image_url;
          });
        } catch (_) {}
      }
      batchResult = await martApi.applyDailyPriceBatch({
        mode: uploadMode,
        source_name: 'daily_price_batch.csv',
        rows: parsed
      });
      await renderMartDailyPriceView(container);
    });

    container.querySelector('#btn-dp-dl-errors')?.addEventListener('click', () => {
      if (!batchResult?.errors?.length) return;
      downloadExcelCsv(
        'mart_daily_price_errors.csv',
        ['바코드', '상품명', '정상가', '판매가', '재고', '오류사유'],
        batchResult.errors.map(er => [er.barcode, er.name, er.regular_price, er.sale_price, er.stock_qty, er.reason])
      );
    });
    container.querySelector('#btn-dp-retry-errors')?.addEventListener('click', async () => {
      const retryRows = Array.from(container.querySelectorAll('.dp-err-row')).map((tr, i) => ({
        row_no: i + 1,
        barcode: tr.querySelector('.dp-err-bc')?.value || '',
        name: tr.querySelector('.dp-err-name')?.value || '',
        regular_price: tr.querySelector('.dp-err-reg')?.value || '',
        sale_price: tr.querySelector('.dp-err-sale')?.value || '',
        stock_qty: tr.querySelector('.dp-err-stock')?.value || ''
      }));
      if (retryRows.length === 0) return;
      batchResult = await martApi.applyDailyPriceBatch({
        mode: 'PARTIAL',
        source_name: 'daily_price_error_retry.csv',
        rows: retryRows
      });
      await renderMartDailyPriceView(container);
    });

    container.querySelectorAll('.btn-dp-rollback').forEach(btn => {
      btn.addEventListener('click', async () => {
        await martApi.rollbackUploadBatch(btn.dataset.batchId);
        await renderMartDailyPriceView(container);
      });
    });
  }

  render();
}
