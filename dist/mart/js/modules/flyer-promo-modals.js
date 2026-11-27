/**
 * AITIP Mart Portal - 행사 룰 등록/수정 모달 & 행사 유형 관리 모달 모듈 (ESM)
 */

import { esc } from '../utils/html.js';
import { CALC_MODE_LABEL, DAY_LIST, CARD_LIST, getChannelScope } from './flyer-promo-helpers.js';

export function renderPromoAddDrawerHtml({ d, editingPromoId, cloneDraft, activePromoTypes, typeLabelMap, today }) {
  const curType = d.promo_type === 'WEEKEND_SPECIAL'
    ? 'DAY_OF_WEEK'
    : (d.promo_type || activePromoTypes[0]?.code || 'PRICE_DISCOUNT');
  const typeOptions = activePromoTypes.some(t => t.code === curType)
    ? activePromoTypes
    : [...activePromoTypes, { code: curType, label: typeLabelMap[curType] || curType }];

  return `
    <div class="mc-drawer-backdrop" id="mc-promo-backdrop">
      <form class="mc-drawer" id="form-promo-add" style="width: 560px;">
        <div class="mc-drawer-header">
          <h2>${editingPromoId ? '행사 룰 수정' : cloneDraft ? '행사 룰 복제 등록' : '새 행사 룰 등록'}</h2>
          <button type="button" class="mc-drawer-close" id="btn-close-promo-drawer">×</button>
        </div>
        <div class="mc-drawer-body">
          ${!editingPromoId ? `
            <div style="margin-bottom: 14px; padding: 10px 12px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0;">
              <div style="font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 6px;">실무 빠른 프리셋 (클릭 시 조건 자동 입력)</div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                <button type="button" class="mc-btn-secondary btn-promo-preset" data-preset="WEEKEND" style="height: 28px; padding: 0 10px; font-size: 11.5px;">주말 특가 (금·토·일 15%)</button>
                <button type="button" class="mc-btn-secondary btn-promo-preset" data-preset="CLOSING" style="height: 28px; padding: 0 10px; font-size: 11.5px;">오늘 마감세일 (20% · 50개 한정)</button>
                <button type="button" class="mc-btn-secondary btn-promo-preset" data-preset="BOGO" style="height: 28px; padding: 0 10px; font-size: 11.5px;">1+1 덤 행사</button>
                <button type="button" class="mc-btn-secondary btn-promo-preset" data-preset="MIX" style="height: 28px; padding: 0 10px; font-size: 11.5px;">골라담기 (3개 9,900원)</button>
              </div>
            </div>
          ` : ''}
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
                  ${typeOptions.map(t => `<option value="${esc(t.code)}" ${curType === t.code ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
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
                <label class="erp-field-label">선착순 전체 한정수량 (0=무제한)</label>
                <input id="pm-total-limit" type="number" min="0" value="${Number(d.total_limit_qty ?? 0)}" class="erp-input" />
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
          ${!editingPromoId ? `<button type="button" class="mc-btn-secondary" id="btn-promo-save-and-link" style="border-color: #007749; color: #007749;">저장 후 바로 상품 연결</button>` : ''}
          <button type="submit" class="mc-btn-primary">행사 룰 저장</button>
        </div>
      </form>
    </div>
  `;
}

export function renderPromoTypeMgrModalHtml({ promoTypes, promotions }) {
  return `
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
  `;
}

export function bindFlyerPromoModalEvents({
  container,
  martApi,
  promoTypes,
  editingPromoId,
  today,
  onCloseDrawer,
  onCreatedAndLink,
  onOpenTypeMgr,
  onCloseTypeMgr,
  onReload
}) {
  let goLinkAfterCreate = false;

  // 실무 빠른 프리셋 4종
  container.querySelectorAll('.btn-promo-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.preset;
      const now = new Date();
      const addDays = (n) => {
        const dt = new Date(now.getTime() + n * 86400000);
        return dt.toISOString().slice(0, 10);
      };
      const setVal = (sel, v) => {
        const el = container.querySelector(sel);
        if (el) el.value = String(v);
      };
      const setDays = (codes = []) => {
        container.querySelectorAll('.pm-day-chk').forEach(c => {
          c.checked = codes.includes(c.value);
        });
      };

      if (code === 'WEEKEND') {
        const daysToSun = (7 - now.getDay()) % 7;
        setVal('#pm-name', `주말 반짝 특가 (${today.slice(5)})`);
        setVal('#pm-type', 'DAY_OF_WEEK');
        setVal('#pm-scope', 'ALL_CHANNELS');
        setVal('#pm-disc-type', 'PERCENT');
        setVal('#pm-rate', 15);
        setVal('#pm-fixed', 0);
        setVal('#pm-req-qty', 1);
        setVal('#pm-bundle', 0);
        setVal('#pm-total-limit', 0);
        setVal('#pm-start', today);
        setVal('#pm-end', addDays(daysToSun || 3));
        setDays(['FRI', 'SAT', 'SUN']);
      } else if (code === 'CLOSING') {
        setVal('#pm-name', `오늘의 마감세일 20% (${today.slice(5)})`);
        setVal('#pm-type', 'PRICE_DISCOUNT');
        setVal('#pm-scope', 'ONLINE_ONLY');
        setVal('#pm-disc-type', 'PERCENT');
        setVal('#pm-rate', 20);
        setVal('#pm-fixed', 0);
        setVal('#pm-req-qty', 1);
        setVal('#pm-bundle', 0);
        setVal('#pm-total-limit', 50);
        setVal('#pm-start', today);
        setVal('#pm-end', today);
        setDays([]);
      } else if (code === 'BOGO') {
        setVal('#pm-name', `인기상품 1+1 덤 행사 (${today.slice(5)})`);
        setVal('#pm-type', 'BOGO_1_PLUS_1');
        setVal('#pm-scope', 'ALL_CHANNELS');
        setVal('#pm-disc-type', 'PERCENT');
        setVal('#pm-rate', 0);
        setVal('#pm-fixed', 0);
        setVal('#pm-req-qty', 2);
        setVal('#pm-bundle', 0);
        setVal('#pm-total-limit', 0);
        setVal('#pm-start', today);
        setVal('#pm-end', addDays(6));
        setDays([]);
      } else if (code === 'MIX') {
        setVal('#pm-name', `골라담기 3개 9,900원 (${today.slice(5)})`);
        setVal('#pm-type', 'MIX_AND_MATCH');
        setVal('#pm-scope', 'ALL_CHANNELS');
        setVal('#pm-disc-type', 'PERCENT');
        setVal('#pm-rate', 0);
        setVal('#pm-fixed', 0);
        setVal('#pm-req-qty', 3);
        setVal('#pm-bundle', 9900);
        setVal('#pm-total-limit', 0);
        setVal('#pm-start', today);
        setVal('#pm-end', addDays(6));
        setDays([]);
      }
      container.querySelector('#pm-name')?.focus();
    });
  });

  container.querySelector('#btn-promo-save-and-link')?.addEventListener('click', () => {
    goLinkAfterCreate = true;
    container.querySelector('#form-promo-add')?.requestSubmit();
  });
  container.querySelector('#btn-close-promo-drawer')?.addEventListener('click', onCloseDrawer);
  container.querySelector('#btn-cancel-promo-drawer')?.addEventListener('click', onCloseDrawer);
  container.querySelector('#mc-promo-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-promo-backdrop') onCloseDrawer();
  });

  container.querySelector('#btn-open-type-mgr')?.addEventListener('click', onOpenTypeMgr);
  container.querySelector('#btn-close-type-mgr')?.addEventListener('click', onCloseTypeMgr);
  container.querySelector('#btn-done-type-mgr')?.addEventListener('click', onCloseTypeMgr);
  container.querySelector('#mc-type-mgr-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mc-type-mgr-backdrop') onCloseTypeMgr();
  });

  container.querySelector('#form-add-promo-type')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = container.querySelector('#pt-label')?.value?.trim();
    const calc_mode = container.querySelector('#pt-calc-mode')?.value || 'UNIT_DISCOUNT';
    if (!label) return;
    await martApi.savePromoType({ label, calc_mode });
    await onReload();
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
      await onReload();
    });
  });

  container.querySelectorAll('.btn-del-promo-type').forEach(btn => {
    btn.addEventListener('click', async () => {
      await martApi.deletePromoType(btn.dataset.code);
      await onReload();
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
      total_limit_qty: Math.max(0, Number(container.querySelector('#pm-total-limit')?.value ?? 0)),
      max_receipt_sections: Math.max(0, Number(container.querySelector('#pm-receipt-sec')?.value ?? 0)),
      start_date: container.querySelector('#pm-start')?.value || today,
      end_date: container.querySelector('#pm-end')?.value || today
    };
    if (editingPromoId) {
      await martApi.updatePromotion({ id: editingPromoId, ...payload });
      onCloseDrawer();
    } else {
      const createdRes = await martApi.createPromotion(payload);
      const newId = createdRes?.promotion?.id || '';
      const shouldGoLink = goLinkAfterCreate && Boolean(newId);
      goLinkAfterCreate = false;
      if (shouldGoLink && typeof onCreatedAndLink === 'function') {
        onCreatedAndLink(newId);
      } else {
        onCloseDrawer();
      }
    }
  });
}
