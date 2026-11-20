/**
 * AITIP Platform Admin - 시스템 정책, Zero-PII 파기 주기, 점검 모드 & 제휴사 API 통합 관제 (ESM)
 */

import { adminApi } from '../admin-api.js';
import { renderPartnerIntegrationsView } from './partner-integrations.js';

let activeTab = 'policies'; // 'policies' | 'integrations'

export async function renderSystemPoliciesView(container) {
  if (!container) return;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-default); padding-bottom: 10px;">
        <button type="button" class="header-btn ${activeTab === 'policies' ? 'header-btn-primary' : ''}" id="btn-sys-tab-policies" style="font-size: 12px; font-weight: 700;">
          시스템 정책 · Zero-PII 파기 · 점검 모드
        </button>
        <button type="button" class="header-btn ${activeTab === 'integrations' ? 'header-btn-primary' : ''}" id="btn-sys-tab-integrations" style="font-size: 12px; font-weight: 700;">
          제휴사 API & 서킷브레이커
        </button>
      </div>
      <div id="sys-tab-body"></div>
    </div>
  `;

  container.querySelector('#btn-sys-tab-policies')?.addEventListener('click', () => {
    activeTab = 'policies';
    renderSystemPoliciesView(container);
  });
  container.querySelector('#btn-sys-tab-integrations')?.addEventListener('click', () => {
    activeTab = 'integrations';
    renderSystemPoliciesView(container);
  });

  const bodyEl = container.querySelector('#sys-tab-body');
  if (!bodyEl) return;

  if (activeTab === 'integrations') {
    await renderPartnerIntegrationsView(bodyEl);
    return;
  }

  const res = await adminApi.getSystemPolicies();
  const p = res.policies || {};

  bodyEl.innerHTML = `
    <div class="panel-card" style="padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div>
          <div style="font-size: 14px; font-weight: 900;">시스템 공통 정책 · Zero-PII 자동 파기 · 점검 모드</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
            배달 완료 후 일회성 연락/주소 파기 주기와 알림톡 템플릿, 전사 점검 모드를 제어합니다.
          </div>
        </div>
        <span class="badge-status ${p.maintenance_mode ? 'danger' : 'success'}">${p.maintenance_mode ? '점검 모드 ON' : '정상 서비스중'}</span>
      </div>

      <form id="form-system-policies" style="display: flex; flex-direction: column; gap: 14px;">
        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; cursor: pointer;">
          <input id="pol-maint-mode" type="checkbox" ${p.maintenance_mode ? 'checked' : ''} />
          전사 서비스 점검 모드 활성화 (소비자 PWA 신규 주문 일시 차단)
        </label>

        <div>
          <label style="font-size: 12px; font-weight: 700;">점검 안내 문구</label>
          <input id="pol-maint-notice" type="text" value="${p.maintenance_notice || ''}" style="width: 100%; margin-top: 4px; padding: 8px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
        </div>

        <div>
          <label style="font-size: 12px; font-weight: 700;">배달 완료 후 일회성 주소/안심번호 자동 파기 시간 (시간)</label>
          <input id="pol-pii-hours" type="number" min="1" max="168" value="${p.pii_retention_hours_after_delivery ?? 24}" style="width: 140px; margin-top: 4px; padding: 8px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: 12.5px; font-weight: 800; color: #0f172a;">알림톡 1 — ARS 전화 인입 시 모바일 주문 링크 발송</div>
          <div>
            <label style="font-size: 11.5px; font-weight: 700;">본문 문구</label>
            <input id="pol-alim-ars-body" type="text" value="${p.alimtalk_ars_order_body || '[AITIP] #{store_name}입니다. 아래 버튼을 눌러 바로 메뉴를 보고 주문하실 수 있습니다.'}" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
          </div>
          <div style="display: grid; grid-template-columns: 180px 1fr; gap: 8px;">
            <div>
              <label style="font-size: 11.5px; font-weight: 700;">카카오 버튼명</label>
              <input id="pol-alim-ars-btn" type="text" value="${p.alimtalk_ars_order_btn_label || '주문하기'}" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 700;">버튼 연결 URL 템플릿</label>
              <input id="pol-alim-ars-url" type="text" value="${p.alimtalk_ars_order_btn_url || 'https://aitip-platform.pages.dev/food/pwa/?storeId=#{store_id}'}" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px; font-family: monospace; font-size: 12px;" />
            </div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: 12.5px; font-weight: 800; color: #0f172a;">알림톡 2 — 주문 접수 안내 & 실시간 추적 링크</div>
          <div>
            <label style="font-size: 11.5px; font-weight: 700;">본문 문구</label>
            <input id="pol-alim-accept" type="text" value="${p.alimtalk_order_accept || ''}" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
          </div>
          <div style="display: grid; grid-template-columns: 180px 1fr; gap: 8px;">
            <div>
              <label style="font-size: 11.5px; font-weight: 700;">카카오 버튼명</label>
              <input id="pol-alim-accept-btn" type="text" value="${p.alimtalk_order_accept_btn_label || '실시간 주문 확인'}" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 700;">버튼 연결 URL 템플릿</label>
              <input id="pol-alim-accept-url" type="text" value="${p.alimtalk_order_accept_btn_url || 'https://aitip-platform.pages.dev/food/pwa/?trackOrderId=#{order_id}'}" style="width: 100%; margin-top: 4px; padding: 7px 10px; border: 1px solid var(--border-default); border-radius: 6px; font-family: monospace; font-size: 12px;" />
            </div>
          </div>
        </div>

        <div>
          <label style="font-size: 12px; font-weight: 700;">알림톡 템플릿 — 배달 완료 및 안심번호 파기 안내</label>
          <input id="pol-alim-done" type="text" value="${p.alimtalk_delivery_done || ''}" style="width: 100%; margin-top: 4px; padding: 8px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
        </div>

        <div style="display: flex; justify-content: flex-end;">
          <button type="submit" class="header-btn" style="background: #0f172a; color: #ffffff; padding: 8px 16px; font-weight: 700;">정책 저장</button>
        </div>
      </form>
    </div>
  `;

  bodyEl.querySelector('#form-system-policies')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await adminApi.updateSystemPolicies({
      maintenance_mode: Boolean(bodyEl.querySelector('#pol-maint-mode')?.checked),
      maintenance_notice: bodyEl.querySelector('#pol-maint-notice')?.value,
      pii_retention_hours_after_delivery: Number(bodyEl.querySelector('#pol-pii-hours')?.value || 24),
      alimtalk_ars_order_body: bodyEl.querySelector('#pol-alim-ars-body')?.value,
      alimtalk_ars_order_btn_label: bodyEl.querySelector('#pol-alim-ars-btn')?.value,
      alimtalk_ars_order_btn_url: bodyEl.querySelector('#pol-alim-ars-url')?.value,
      alimtalk_order_accept: bodyEl.querySelector('#pol-alim-accept')?.value,
      alimtalk_order_accept_btn_label: bodyEl.querySelector('#pol-alim-accept-btn')?.value,
      alimtalk_order_accept_btn_url: bodyEl.querySelector('#pol-alim-accept-url')?.value,
      alimtalk_delivery_done: bodyEl.querySelector('#pol-alim-done')?.value
    });
    await renderSystemPoliciesView(container);
  });
}
