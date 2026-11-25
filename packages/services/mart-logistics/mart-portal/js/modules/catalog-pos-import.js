/**
 * AITIP Mart Portal - POS 상품마스터 엑셀(CSV) 일괄 등록 모달 모듈 (ESM)
 */

import { downloadExcelCsv, readCsvOrTextFile, parseDelimitedRows } from '../utils/excel-csv.js';
import { escapeHtml } from '../utils/html.js';

export function renderPosImportDrawerHtml(uploadBatchType) {
  return `
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
  `;
}

export function bindPosImportEvents({ container, martApi, sampleCsv, setUploadBatchType, onImportComplete }) {
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
      const nextType = btn.dataset.batch;
      setUploadBatchType(nextType);
      container.querySelectorAll('.btn-import-batch-type').forEach(b => {
        b.className = `${b.dataset.batch === nextType ? 'mc-btn-primary' : 'mc-btn-secondary'} btn-import-batch-type`;
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
    if (ta) ta.value = sampleCsv;
    renderPosPreview();
  });
  container.querySelector('#btn-run-pos-import')?.addEventListener('click', async () => {
    const text = container.querySelector('#txt-pos-import')?.value?.trim();
    if (!text) return;
    await martApi.bulkImport('POS_CSV', text);
    await onImportComplete();
  });
}
