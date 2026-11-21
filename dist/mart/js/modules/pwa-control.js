/**
 * AITIP Mart Portal - 6. PWA 6대 블록 디스플레이 제어 & 공동판매/공동구매 모듈 (ESM)
 * 모던 커머스 어드민 UI: 좌측 설정 카드 + 우측 고정 실시간 모바일/디바이스 미리보기
 */

import { martApi } from '../api.js';

let previewDevice = 'MOBILE'; // 'MOBILE' (375px) | 'TABLET' (768px) | 'PC' (1200px)
let editingBlockId = '';
let gbDrawerOpen = false;
let shelfSearchQuery = '';
let draftFeaturedIds = new Set();
const SHELF_BLOCK_IDS = new Set(['PROMO_SHELF', 'CURATED_SHELF']);

function escapeHtml(v = '') {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  const editingBlock = editingBlockId ? blocks.find(b => b.id === editingBlockId) : null;
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
            <div style="padding: 16px 18px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 14px; font-weight: 800; color: #0f172a;">2. 홈 6대 디스플레이 블록 조립</span>
              <span style="font-size: 12px; color: #64748b;">순서 숫자가 작을수록 상단에 노출됩니다</span>
            </div>
            <div class="mc-table-wrap">
              <table class="mc-table">
                <thead>
                  <tr>
                    <th style="width: 68px;">순서</th>
                    <th style="width: 52px; text-align: center;">노출</th>
                    <th>블록 ID</th>
                    <th>노출 섹션 제목</th>
                    <th style="text-align: right;">진열 상품</th>
                  </tr>
                </thead>
                <tbody>
                  ${blocks.map(b => {
                    const fIds = Array.isArray(b.featured_product_ids) ? b.featured_product_ids : [];
                    const isShelf = SHELF_BLOCK_IDS.has(b.id);
                    return `
                    <tr class="pwa-block-row" data-block-id="${escapeHtml(b.id)}">
                      <td><input type="number" class="blk-order erp-input" value="${b.order}" min="1" max="10" style="width: 58px; height: 32px; text-align: center;" /></td>
                      <td style="text-align: center;"><input type="checkbox" class="blk-enabled" ${b.enabled ? 'checked' : ''} /></td>
                      <td><span class="mc-pill mc-pill-gray">${escapeHtml(b.id)}</span></td>
                      <td><input type="text" class="blk-title erp-input" value="${escapeHtml(b.title)}" style="height: 32px;" /></td>
                      <td style="text-align: right; white-space: nowrap;">
                        ${isShelf ? `
                          <button type="button" class="mc-row-edit-btn btn-pick-shelf-prods" data-block-id="${escapeHtml(b.id)}">
                            ${fIds.length > 0 ? `지정 ${fIds.length}개` : '진열 상품 선택'}
                          </button>
                        ` : '<span style="font-size: 11.5px; color: #94a3b8;">자동</span>'}
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
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            <div style="display: flex; gap: 4px;">
              <button type="button" class="btn-device-preview" data-device="MOBILE" style="padding: 5px 10px; border-radius: 6px; border: none; cursor: pointer; font-size: 11.5px; font-weight: 700; background: ${previewDevice === 'MOBILE' ? '#007749' : '#334155'}; color: #fff;">모바일</button>
              <button type="button" class="btn-device-preview" data-device="TABLET" style="padding: 5px 10px; border-radius: 6px; border: none; cursor: pointer; font-size: 11.5px; font-weight: 700; background: ${previewDevice === 'TABLET' ? '#007749' : '#334155'}; color: #fff;">태블릿</button>
              <button type="button" class="btn-device-preview" data-device="PC" style="padding: 5px 10px; border-radius: 6px; border: none; cursor: pointer; font-size: 11.5px; font-weight: 700; background: ${previewDevice === 'PC' ? '#007749' : '#334155'}; color: #fff;">PC 웹</button>
            </div>
            <button type="button" id="btn-refresh-pwa-preview" style="background: #334155; color: #e2e8f0; border: none; border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 11.5px; font-weight: 600;">새로고침</button>
          </div>
          <div style="overflow-x: auto; display: flex; justify-content: center; background: #1e293b; border-radius: 10px; padding: 10px;">
            <iframe id="iframe-pwa-preview" src="/mart/pwa/" style="width: ${previewDevice === 'MOBILE' ? '375px' : previewDevice === 'TABLET' ? '768px' : '1200px'}; max-width: 100%; height: 640px; border: none; border-radius: 10px; background: #ffffff;"></iframe>
          </div>
        </div>
      </div>

      ${editingBlock ? `
        <div class="mc-drawer-backdrop" id="mc-shelf-backdrop">
          <div class="mc-drawer" style="width: 540px;">
            <div class="mc-drawer-header">
              <div>
                <h2>${escapeHtml(editingBlock.title)} — 진열 상품 선택</h2>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">체크한 상품들이 해당 홈 블록에 우선 진열됩니다. (미지정 시 자동 추천)</div>
              </div>
              <button type="button" class="mc-drawer-close" id="btn-close-shelf-drawer">×</button>
            </div>
            <div class="mc-drawer-body">
              <div class="mc-drawer-section">
                <input id="shelf-prod-q" type="text" class="mc-search" value="${escapeHtml(shelfSearchQuery)}" placeholder="상품명 · 바코드 · 규격 검색" style="width: 100%; margin-bottom: 12px;" />
                <div style="max-height: 460px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                  ${filteredProducts.map(p => {
                    const checked = draftFeaturedIds.has(p.id);
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
              <button type="button" class="mc-btn-primary" id="btn-save-shelf-drawer">진열 상품 저장</button>
            </div>
          </div>
        </div>
      ` : ''}

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

  container.querySelector('#btn-refresh-pwa-preview')?.addEventListener('click', () => {
    const iframe = container.querySelector('#iframe-pwa-preview');
    if (iframe) iframe.src = `/mart/pwa/?t=${Date.now()}`;
  });

  container.querySelectorAll('.btn-pick-shelf-prods').forEach(btn => {
    btn.addEventListener('click', () => {
      editingBlockId = btn.dataset.blockId;
      const targetBlk = blocks.find(b => b.id === editingBlockId);
      draftFeaturedIds = new Set(Array.isArray(targetBlk?.featured_product_ids) ? targetBlk.featured_product_ids : []);
      shelfSearchQuery = '';
      renderMartPwaControlView(container);
    });
  });
  container.querySelectorAll('.chk-shelf-prod').forEach(chk => {
    chk.addEventListener('change', () => {
      if (chk.checked) draftFeaturedIds.add(chk.value);
      else draftFeaturedIds.delete(chk.value);
      const lbl = chk.closest('label');
      if (lbl) {
        lbl.style.borderColor = chk.checked ? '#007749' : '#e5e7eb';
        lbl.style.background = chk.checked ? '#f0fdf4' : '#ffffff';
      }
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
    draftFeaturedIds = new Set();
    renderMartPwaControlView(container);
  };
  container.querySelector('#btn-close-shelf-drawer')?.addEventListener('click', closeShelfDrawer);
  container.querySelector('#btn-cancel-shelf-drawer')?.addEventListener('click', closeShelfDrawer);
  container.querySelector('#mc-shelf-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-shelf-backdrop') closeShelfDrawer();
  });
  container.querySelector('#btn-save-shelf-drawer')?.addEventListener('click', async () => {
    const selected = Array.from(draftFeaturedIds);
    const updatedBlocks = blocks.map(b => b.id === editingBlockId ? { ...b, featured_product_ids: selected } : b);
    await martApi.updatePwaControl({ blocks: updatedBlocks });
    editingBlockId = '';
    draftFeaturedIds = new Set();
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
    if (iframe) iframe.src = `/mart/pwa/?t=${Date.now()}`;
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
