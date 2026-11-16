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

        <div>
          <label style="font-size: 12px; font-weight: 700;">알림톡 템플릿 — 주문 접수</label>
          <input id="pol-alim-accept" type="text" value="${p.alimtalk_order_accept || ''}" style="width: 100%; margin-top: 4px; padding: 8px 10px; border: 1px solid var(--border-default); border-radius: 6px;" />
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
      alimtalk_order_accept: bodyEl.querySelector('#pol-alim-accept')?.value,
      alimtalk_delivery_done: bodyEl.querySelector('#pol-alim-done')?.value
    });
    await renderSystemPoliciesView(container);
  });
}
