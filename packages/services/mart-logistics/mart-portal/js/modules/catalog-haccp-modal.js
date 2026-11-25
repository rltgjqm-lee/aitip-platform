/**
 * AITIP Mart Portal - 공용 바코드 · HACCP 상품 검색 및 와이드 선택 모달 모듈 (ESM)
 */

import { escapeHtml } from '../utils/html.js';

function cleanHaccpVal(v = '') {
  const s = String(v || '').trim();
  return (!s || s === '-' || s === '알수없음' || s === 'null' || s === 'undefined') ? '' : s;
}

export function bindCatalogHaccpLookup({ container, martApi, mpL1, mpL2, importExternalUrlAsWebp, onMediaSelected }) {
  const haccpLookupBtn = container.querySelector('#btn-haccp-lookup');
  ['#mp-name', '#mp-barcode'].forEach(sel => {
    container.querySelector(sel)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        haccpLookupBtn?.click();
      }
    });
  });

  const applyPickedHaccpItem = async (picked) => {
    if (!picked) return;
    const nameEl = container.querySelector('#mp-name');
    const specEl = container.querySelector('#mp-spec');
    const bcEl = container.querySelector('#mp-barcode');
    if (nameEl) nameEl.value = picked.name;
    const cleanSpec = cleanHaccpVal(picked.spec);
    if (specEl && cleanSpec) specEl.value = cleanSpec;
    if (bcEl && picked.barcode) bcEl.value = picked.barcode;
    if (picked.image_url) {
      let nextMedia;
      if (picked.image_url.startsWith('/api/mart/media/public/')) {
        nextMedia = { media_id: picked.id || null, image_url: picked.image_url };
      } else {
        const up = await importExternalUrlAsWebp(picked.image_url, picked.name, picked.barcode || '');
        nextMedia = { media_id: up.media_id, image_url: up.image_url };
      }
      onMediaSelected(nextMedia);
      const imgBox = container.querySelector('#mp-img-preview-box');
      if (imgBox) imgBox.innerHTML = `<img src="${escapeHtml(nextMedia.image_url)}" alt="미리보기" style="width:100%;height:100%;object-fit:cover;" />`;
    }
    const box = container.querySelector('#haccp-lookup-box');
    if (box) box.style.display = 'none';
    document.querySelector('#mc-haccp-wide-modal')?.remove();
  };

  const openHaccpWideModal = (list, queryText) => {
    document.querySelector('#mc-haccp-wide-modal')?.remove();
    const types = Array.from(new Set(list.map(it => String(it.prdkind || '').trim()).filter(Boolean)));
    const overlay = document.createElement('div');
    overlay.id = 'mc-haccp-wide-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;width:min(960px,96vw);max-height:86vh;display:flex;flex-direction:column;box-shadow:0 24px 48px rgba(15,23,42,0.22);overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e2e8f0;background:#f8fafc;">
          <div>
            <div style="font-size:15px;font-weight:800;color:#0f172a;">공용 바코드 · HACCP 상품 검색 결과 (${list.length}건)</div>
            <div style="font-size:12px;color:#64748b;">검색어: "${escapeHtml(queryText)}" · 사진 보유 및 분류 일치 우선 정렬</div>
          </div>
          <button type="button" id="btn-close-haccp-modal" class="mc-btn-secondary" style="height:30px;padding:0 12px;">닫기</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid #e2e8f0;background:#fff;">
          <input id="haccp-modal-filter" type="text" class="erp-input" style="max-width:240px;height:32px;" placeholder="결과 내 상품명·제조사 필터..." />
          <select id="haccp-modal-type" class="erp-input" style="max-width:170px;height:32px;">
            <option value="">전체 유형 (${list.length})</option>
            ${types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
          </select>
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#334155;cursor:pointer;">
            <input type="checkbox" id="haccp-modal-only-img" /> 사진 있는 상품만
          </label>
          <span id="haccp-modal-count" style="margin-left:auto;font-size:12px;color:#64748b;"></span>
        </div>
        <div id="haccp-modal-grid" style="padding:14px 18px;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;background:#f8fafc;"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const gridEl = overlay.querySelector('#haccp-modal-grid');
    const countEl = overlay.querySelector('#haccp-modal-count');
    const filterInput = overlay.querySelector('#haccp-modal-filter');
    const typeSelect = overlay.querySelector('#haccp-modal-type');
    const imgCheck = overlay.querySelector('#haccp-modal-only-img');

    const renderGrid = () => {
      const kw = String(filterInput?.value || '').trim().toLowerCase();
      const tp = String(typeSelect?.value || '').trim();
      const onlyImg = Boolean(imgCheck?.checked);
      const filtered = list.filter(it => {
        if (onlyImg && !it.image_url) return false;
        if (tp && String(it.prdkind || '').trim() !== tp) return false;
        if (kw) {
          const hay = `${it.name || ''} ${it.manufacture || ''} ${it.barcode || ''}`.toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      });
      if (countEl) countEl.textContent = `표시 ${filtered.length}건`;
      if (!gridEl) return;
      if (filtered.length === 0) {
        gridEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#64748b;font-size:13px;">조건에 맞는 상품이 없습니다.</div>';
        return;
      }
      gridEl.innerHTML = filtered.map((it, idx) => `
        <div class="haccp-modal-card" data-bc="${escapeHtml(it.barcode || '')}" data-fidx="${idx}" style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;display:flex;gap:10px;align-items:center;cursor:pointer;transition:border-color 0.15s;">
          <div style="width:52px;height:52px;border-radius:8px;background:#f1f5f9;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
            ${it.image_url ? `<img src="${escapeHtml(it.image_url)}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size:10px;color:#94a3b8;">이미지없음</span>`}
          </div>
          <div style="min-width:0;flex:1;">
            <div style="font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(it.name)}</div>
            <div style="font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(it.manufacture || '-')}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
              <code style="font-size:10.5px;color:#334155;background:#f1f5f9;padding:1px 5px;border-radius:4px;">${escapeHtml(it.barcode || '바코드없음')}</code>
              ${it.prdkind ? `<span style="font-size:10.5px;color:#047857;background:#ecfdf5;padding:1px 5px;border-radius:4px;">${escapeHtml(it.prdkind)}</span>` : ''}
            </div>
          </div>
        </div>
      `).join('');
      gridEl.querySelectorAll('.haccp-modal-card').forEach(card => {
        card.addEventListener('click', () => {
          const picked = filtered[Number(card.dataset.fidx)];
          applyPickedHaccpItem(picked);
        });
      });
    };

    renderGrid();
    filterInput?.addEventListener('input', renderGrid);
    typeSelect?.addEventListener('change', renderGrid);
    imgCheck?.addEventListener('change', renderGrid);
    overlay.querySelector('#btn-close-haccp-modal')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  };

  haccpLookupBtn?.addEventListener('click', async () => {
    const l1Val = mpL1?.value || '';
    const q = container.querySelector('#mp-name')?.value?.trim() || '';
    const barcode = container.querySelector('#mp-barcode')?.value?.trim() || '';
    const category_hint = mpL2?.selectedOptions?.[0]?.textContent?.trim() || '';
    const box = container.querySelector('#haccp-lookup-box');
    if (!box) return;
    if (['01', '02', '03'].includes(l1Val)) {
      box.style.display = 'block';
      box.innerHTML = '<div style="font-size:12px;color:#b45309;">신선 농·축·수산물은 가공식품 바코드/HACCP 조회 대상이 아닙니다. 아래 이미지 검색(구글/네이버) 또는 직접 업로드를 이용해 주세요.</div>';
      return;
    }
    if (!q && !barcode) {
      box.style.display = 'block';
      box.innerHTML = '<div style="font-size:12px;color:#b45309;">상품명 또는 바코드를 먼저 입력한 뒤 조회하세요.</div>';
      return;
    }
    box.style.display = 'block';
    box.innerHTML = '<div style="font-size:12px;color:#475569;">공용 바코드 · HACCP DB 조회 중...</div>';
    try {
      const res = await martApi.searchHaccp({ q, barcode, limit: 50, category_hint });
      const list = res.items || [];
      if (list.length === 0) {
        box.innerHTML = '<div style="font-size:12px;color:#64748b;">일치하는 등록 상품이 없습니다.</div>';
        return;
      }
      const previewList = list.slice(0, 8);
      const headerBar = list.length > 8
        ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 4px 6px;border-bottom:1px solid #cbd5e1;margin-bottom:4px;">
             <span style="font-size:11.5px;font-weight:700;color:#334155;">상위 8건 (총 ${list.length}건 · 사진 보유 우선)</span>
             <button type="button" id="btn-haccp-open-modal" class="mc-btn-secondary" style="height:24px;padding:0 8px;font-size:11px;">넓은 창에서 전체 ${list.length}건 보기</button>
           </div>`
        : '';
      box.innerHTML = headerBar + previewList.map((it, idx) => {
        const metaLine = [cleanHaccpVal(it.spec), cleanHaccpVal(it.manufacture), it.barcode].filter(Boolean).join(' · ');
        return `
        <div class="haccp-pick-row" data-idx="${idx}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px;border-bottom:1px solid #e2e8f0;cursor:pointer;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            ${it.image_url ? `<img src="${escapeHtml(it.image_url)}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0;" />` : `<div style="width:36px;height:36px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:9px;color:#94a3b8;flex-shrink:0;">없음</div>`}
            <div style="min-width:0;">
              <div style="font-size:12.5px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(it.name)}</div>
              <div style="font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(metaLine || '-')}</div>
            </div>
          </div>
          <span class="mc-pill mc-pill-green">선택</span>
        </div>`;
      }).join('');
      box.querySelector('#btn-haccp-open-modal')?.addEventListener('click', () => openHaccpWideModal(list, q || barcode));
      box.querySelectorAll('.haccp-pick-row').forEach(row => {
        row.addEventListener('click', () => {
          applyPickedHaccpItem(previewList[Number(row.dataset.idx)]);
        });
      });
    } catch (err) {
      box.innerHTML = `<div style="font-size:12px;color:#b91c1c;">조회 실패: ${escapeHtml(err.message)}</div>`;
    }
  });
}
