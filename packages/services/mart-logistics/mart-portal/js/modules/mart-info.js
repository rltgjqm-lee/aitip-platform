/**
 * AITIP Mart Portal - 마트 기본정보 · 정산계좌 · 관리자 · 사원 관리 모듈 (ESM)
 * DOC-00 계층형 UID(MRT-, A-, U-) 및 모던 커머스 어드민 UI(.mc-*) 통일
 */

import { martApi } from '../api.js';
import { esc } from '../utils/html.js';

let activeTab = 'BASIC'; // 'BASIC' | 'DELIVERY_BANK' | 'MANAGER' | 'STAFF'
let editingStaffId = '';

export async function renderMartInfoView(container) {
  if (!container) return;
  const [profRes, staffRes, facRes] = await Promise.all([
    martApi.getProfile(),
    martApi.getStaff(),
    martApi.getFacilities().catch(() => ({ facilities: [] }))
  ]);
  const m = profRes.mart || {};
  const mgr = m.manager || {};
  const staffList = staffRes.staff || [];
  const facilities = facRes.facilities || [];
  const editingStaff = editingStaffId ? staffList.find(s => s.staff_id === editingStaffId) : null;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px; max-width: 1120px;">
      <div class="mc-page-header">
        <div class="mc-title-wrap">
          <h1>마트 기본정보 & 인력</h1>
          <span class="mc-count-pill" style="font-family: var(--font-mono);">${esc(m.mart_id)}</span>
        </div>
        <div class="mc-header-actions" style="flex-wrap: wrap;">
          <button type="button" class="${activeTab === 'BASIC' ? 'mc-btn-primary' : 'mc-btn-secondary'} btn-mi-tab" data-tab="BASIC">기본정보</button>
          <button type="button" class="${activeTab === 'DELIVERY_BANK' ? 'mc-btn-primary' : 'mc-btn-secondary'} btn-mi-tab" data-tab="DELIVERY_BANK">배달·정산계좌</button>
          <button type="button" class="${activeTab === 'MANAGER' ? 'mc-btn-primary' : 'mc-btn-secondary'} btn-mi-tab" data-tab="MANAGER">관리자 정보</button>
          <button type="button" class="${activeTab === 'STAFF' ? 'mc-btn-primary' : 'mc-btn-secondary'} btn-mi-tab" data-tab="STAFF">사원 관리 (${staffList.length})</button>
          <button type="button" class="${activeTab === 'FACILITIES' ? 'mc-btn-primary' : 'mc-btn-secondary'} btn-mi-tab" data-tab="FACILITIES">기관 회원 B2B (${facilities.length})</button>
        </div>
      </div>

      ${activeTab === 'BASIC' ? `
        <form id="form-mi-basic" class="mc-surface" style="padding: 20px;">
          <div class="erp-form-grid-3">
            <div>
              <label class="erp-field-label">마트 상호명</label>
              <input id="mi-name" class="erp-input" type="text" value="${esc(m.mart_name)}" />
            </div>
            <div>
              <label class="erp-field-label">마트 유형</label>
              <select id="mi-type" class="erp-input">
                <option value="NH_HANARO" ${m.mart_type === 'NH_HANARO' ? 'selected' : ''}>단위농협 하나로마트</option>
                <option value="GENERAL_MART" ${m.mart_type === 'GENERAL_MART' ? 'selected' : ''}>일반 · 식자재마트</option>
              </select>
            </div>
            <div>
              <label class="erp-field-label">사업자등록번호</label>
              <input id="mi-biz" class="erp-input" type="text" value="${esc(m.biz_number)}" />
            </div>
            <div>
              <label class="erp-field-label">대표 전화번호</label>
              <input id="mi-phone" class="erp-input" type="text" value="${esc(m.phone)}" />
            </div>
            <div>
              <label class="erp-field-label">영업 시간</label>
              <input id="mi-hours" class="erp-input" type="text" value="${esc(m.open_hours)}" />
            </div>
            <div>
              <label class="erp-field-label">위탁 대행 운영팀</label>
              <input id="mi-op" class="erp-input" type="text" value="${esc(m.operator_name)}" />
            </div>
            <div style="grid-column: 1 / -1;">
              <label class="erp-field-label">매장 주소</label>
              <input id="mi-addr" class="erp-input" type="text" value="${esc(m.address)}" />
            </div>
            <div style="grid-column: 1 / -1; border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 4px;">
              <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px;">80mm 전표·영수증 자체 문구 (비워두면 미출력)</div>
              <div class="erp-form-grid-3">
                <div>
                  <label class="erp-field-label">전표 상단 문구</label>
                  <input id="mi-rcpt-top" class="erp-input" type="text" placeholder="예: 신선한 우리 농산물, 정직한 가격" value="${esc(m.receipt_top_notice || '')}" />
                </div>
                <div>
                  <label class="erp-field-label">마트 정보 아래 문구</label>
                  <input id="mi-rcpt-sub" class="erp-input" type="text" placeholder="예: 교환·환불 7일 이내 영수증 지참" value="${esc(m.receipt_sub_notice || '')}" />
                </div>
                <div>
                  <label class="erp-field-label">주문바코드 위 문구</label>
                  <input id="mi-rcpt-bottom" class="erp-input" type="text" placeholder="예: 이용해 주셔서 감사합니다." value="${esc(m.receipt_bottom_notice || '')}" />
                </div>
              </div>
            </div>
          </div>
          <div class="erp-form-footer" style="justify-content: flex-end;">
            <button type="submit" class="mc-btn-primary">기본정보 수정·저장</button>
          </div>
        </form>
      ` : ''}

      ${activeTab === 'DELIVERY_BANK' ? `
        <form id="form-mi-bank" class="mc-surface" style="padding: 20px;">
          <div class="erp-form-grid-3">
            <div>
              <label class="erp-field-label">최소 주문 금액 (원)</label>
              <input id="mi-min" class="erp-input" type="number" min="0" value="${Number(m.min_order_amount ?? 0)}" />
            </div>
            <div>
              <label class="erp-field-label">기본 배달비 (원)</label>
              <input id="mi-fee" class="erp-input" type="number" min="0" value="${Number(m.delivery_fee ?? 0)}" />
            </div>
            <div>
              <label class="erp-field-label">무료배송 기준 (원)</label>
              <input id="mi-free" class="erp-input" type="number" min="0" value="${Number(m.free_delivery_threshold ?? 0)}" />
            </div>
            <div>
              <label class="erp-field-label">정산 은행</label>
              <input id="mi-bank" class="erp-input" type="text" value="${esc(m.settlement_bank)}" />
            </div>
            <div>
              <label class="erp-field-label">정산 계좌번호</label>
              <input id="mi-acct" class="erp-input" type="text" value="${esc(m.settlement_account)}" />
            </div>
          </div>
          <div class="erp-form-footer">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">
              <input id="mi-pickup" type="checkbox" ${m.pickup_enabled ? 'checked' : ''} />
              <span>매장 방문 픽업(STORE_PICKUP) 허용</span>
            </label>
            <button type="submit" class="mc-btn-primary">배달·정산 수정·저장</button>
          </div>
        </form>
      ` : ''}

      ${activeTab === 'MANAGER' ? `
        <form id="form-mi-mgr" class="mc-surface" style="padding: 20px;">
          <div class="erp-form-grid-3">
            <div>
              <label class="erp-field-label">관리자 UID</label>
              <input id="mgr-uid" class="erp-input" type="text" readonly value="${esc(mgr.manager_uid || `${m.mart_id}-A01`)}" style="background: #f8fafc; color: #475569;" />
            </div>
            <div>
              <label class="erp-field-label">관리자 성명 *</label>
              <input id="mgr-name" class="erp-input" type="text" required value="${esc(mgr.name || '')}" />
            </div>
            <div>
              <label class="erp-field-label">직책 / 호칭</label>
              <input id="mgr-title" class="erp-input" type="text" value="${esc(mgr.role_title || '')}" />
            </div>
            <div>
              <label class="erp-field-label">권한 구분 (RBAC)</label>
              <select id="mgr-auth" class="erp-input">
                <option value="AGENCY_OPERATOR" ${mgr.auth_role === 'AGENCY_OPERATOR' ? 'selected' : ''}>위탁운영 총괄 (AGENCY_OPERATOR)</option>
                <option value="MART_OWNER" ${mgr.auth_role === 'MART_OWNER' ? 'selected' : ''}>단위농협·마트 점주 (MART_OWNER)</option>
              </select>
            </div>
            <div>
              <label class="erp-field-label">비상 연락처 *</label>
              <input id="mgr-phone" class="erp-input" type="text" required value="${esc(mgr.phone || '')}" />
            </div>
            <div>
              <label class="erp-field-label">관리자 이메일</label>
              <input id="mgr-email" class="erp-input" type="email" value="${esc(mgr.email || '')}" />
            </div>
          </div>
          <div class="erp-form-footer" style="justify-content: flex-end;">
            <button type="submit" class="mc-btn-primary">관리자 수정·저장</button>
          </div>
        </form>
      ` : ''}

      ${activeTab === 'STAFF' ? `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <form id="form-mi-staff" class="mc-surface" style="padding: 18px;">
            <div class="erp-staff-grid">
              <div>
                <label class="erp-field-label">사원명 *</label>
                <input id="stf-name" class="erp-input" type="text" required value="${esc(editingStaff?.name || '')}" placeholder="성명 입력" />
              </div>
              <div>
                <label class="erp-field-label">담당 직무</label>
                <select id="stf-role" class="erp-input">
                  <option value="PICKER" ${editingStaff?.role === 'PICKER' ? 'selected' : ''}>매장 피킹 · 박싱</option>
                  <option value="PREP_WORKER" ${editingStaff?.role === 'PREP_WORKER' ? 'selected' : ''}>전처리 작업자</option>
                  <option value="DRIVER" ${editingStaff?.role === 'DRIVER' ? 'selected' : ''}>순회 배송 기사</option>
                  <option value="CS_ADMIN" ${editingStaff?.role === 'CS_ADMIN' ? 'selected' : ''}>발주 · CS 담당</option>
                </select>
              </div>
              <div>
                <label class="erp-field-label">연락처 *</label>
                <input id="stf-phone" class="erp-input" type="text" required value="${esc(editingStaff?.phone || '')}" placeholder="010-0000-0000" />
              </div>
              <div>
                <label class="erp-field-label">근무 시간</label>
                <input id="stf-shift" class="erp-input" type="text" value="${esc(editingStaff?.work_shift || '09:00 ~ 18:00')}" />
              </div>
              <div>
                <label class="erp-field-label">재직 상태</label>
                <select id="stf-status" class="erp-input">
                  <option value="ACTIVE" ${editingStaff?.status !== 'INACTIVE' ? 'selected' : ''}>근무중</option>
                  <option value="INACTIVE" ${editingStaff?.status === 'INACTIVE' ? 'selected' : ''}>휴직/퇴사</option>
                </select>
              </div>
              <div style="display: flex; gap: 6px;">
                <button type="submit" class="mc-btn-primary" style="white-space: nowrap;">${editingStaff ? '수정 저장' : '+ 사원 등록'}</button>
                ${editingStaff ? `<button type="button" class="mc-btn-secondary" id="btn-cancel-staff-edit">취소</button>` : ''}
              </div>
            </div>
          </form>

          <div class="mc-surface">
            <div class="mc-table-wrap">
              <table class="mc-table">
                <thead>
                  <tr>
                    <th>사원 UID</th>
                    <th>성명</th>
                    <th>담당 직무</th>
                    <th>연락처</th>
                    <th>근무 시간</th>
                    <th>상태</th>
                    <th style="text-align: right;">관리</th>
                  </tr>
                </thead>
                <tbody>
                  ${staffList.map(s => `
                    <tr style="${editingStaffId === s.staff_id ? 'background: #f0fdf4;' : ''}">
                      <td><span class="mc-prod-code">${esc(s.staff_id)}</span></td>
                      <td><strong>${esc(s.name)}</strong></td>
                      <td><span class="mc-pill mc-pill-gray">${esc(s.role_label || s.role)}</span></td>
                      <td>${esc(s.phone)}</td>
                      <td>${esc(s.work_shift)}</td>
                      <td><span class="mc-pill ${s.status === 'ACTIVE' ? 'mc-pill-green' : 'mc-pill-gray'}">${s.status === 'ACTIVE' ? '근무중' : '휴직/퇴사'}</span></td>
                      <td style="text-align: right; white-space: nowrap;">
                        <button type="button" class="mc-row-edit-btn btn-edit-staff" data-sid="${esc(s.staff_id)}">수정</button>
                        <button type="button" class="mc-row-edit-btn btn-del-staff" data-sid="${esc(s.staff_id)}" style="color: #b91c1c; border-color: #fecaca; margin-left: 4px;">삭제</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ` : ''}

      ${activeTab === 'FACILITIES' ? `
        <div class="mc-surface" style="padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div>
              <strong style="font-size: 14.5px; color: #0f172a;">B2B 기관 회원 가입 승인 · 후불 여신 관리</strong>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">기관 발주 포털(/mart/b2b/)에서 가입 신청한 경로당·복지관을 승인하고 여신 한도를 설정합니다.</div>
            </div>
            <a href="/mart/b2b/" target="_blank" class="mc-btn-secondary" style="text-decoration: none;">기관 B2B 포털 열기</a>
          </div>
          <div class="mc-table-wrap">
            <table class="mc-table">
              <thead>
                <tr>
                  <th>기관 코드</th>
                  <th>기관명 / 주소</th>
                  <th>담당자 / 연락처</th>
                  <th>월말 여신 한도</th>
                  <th>상태</th>
                  <th style="text-align: right;">승인 처리</th>
                </tr>
              </thead>
              <tbody>
                ${facilities.map(f => `
                  <tr>
                    <td><span class="mc-prod-code">${esc(f.facility_id || '발급 대기')}</span></td>
                    <td>
                      <strong>${esc(f.facility_name)}</strong>
                      <div style="font-size: 11.5px; color: #64748b;">${esc(f.address)}</div>
                    </td>
                    <td>${esc(f.contact_name)} · ${esc(f.phone)}</td>
                    <td>
                      <input type="number" min="0" step="50000" class="erp-input fac-limit-input" data-rid="${esc(f.request_id)}" value="${Number(f.credit_limit || 500000)}" style="width: 120px; height: 30px;" />
                    </td>
                    <td>
                      <span class="mc-pill ${f.status === 'APPROVED' ? 'mc-pill-green' : f.status === 'REJECTED' ? 'mc-pill-red' : 'mc-pill-amber'}">
                        ${f.status === 'APPROVED' ? '승인 완료' : f.status === 'REJECTED' ? '반려' : '승인 대기'}
                      </span>
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                      <button type="button" class="mc-btn-primary btn-fac-approve" data-rid="${esc(f.request_id)}" style="height: 30px; padding: 0 10px; font-size: 12px;">
                        ${f.status === 'APPROVED' ? '한도 저장' : '승인(FAC발급)'}
                      </button>
                      ${f.status === 'PENDING_APPROVAL' ? `
                        <button type="button" class="mc-row-edit-btn btn-fac-reject" data-rid="${esc(f.request_id)}" style="color: #b91c1c; border-color: #fecaca; margin-left: 4px;">반려</button>
                      ` : ''}
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

  container.querySelectorAll('.btn-mi-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      editingStaffId = '';
      renderMartInfoView(container);
    });
  });

  container.querySelector('#form-mi-basic')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await martApi.updateProfile({
      mart_name: container.querySelector('#mi-name')?.value,
      mart_type: container.querySelector('#mi-type')?.value,
      biz_number: container.querySelector('#mi-biz')?.value,
      phone: container.querySelector('#mi-phone')?.value,
      open_hours: container.querySelector('#mi-hours')?.value,
      operator_name: container.querySelector('#mi-op')?.value,
      address: container.querySelector('#mi-addr')?.value,
      receipt_top_notice: container.querySelector('#mi-rcpt-top')?.value?.trim() || '',
      receipt_sub_notice: container.querySelector('#mi-rcpt-sub')?.value?.trim() || '',
      receipt_bottom_notice: container.querySelector('#mi-rcpt-bottom')?.value?.trim() || ''
    });
    alert('마트 기본정보가 수정되었습니다.');
    await renderMartInfoView(container);
  });

  container.querySelector('#form-mi-bank')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await martApi.updateProfile({
      min_order_amount: Math.max(0, Number(container.querySelector('#mi-min')?.value ?? 0)),
      delivery_fee: Math.max(0, Number(container.querySelector('#mi-fee')?.value ?? 0)),
      free_delivery_threshold: Math.max(0, Number(container.querySelector('#mi-free')?.value ?? 0)),
      settlement_bank: container.querySelector('#mi-bank')?.value,
      settlement_account: container.querySelector('#mi-acct')?.value,
      pickup_enabled: Boolean(container.querySelector('#mi-pickup')?.checked)
    });
    alert('배달·정산 정책이 수정되었습니다.');
    await renderMartInfoView(container);
  });

  container.querySelector('#form-mi-mgr')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await martApi.updateProfile({
      manager: {
        manager_uid: container.querySelector('#mgr-uid')?.value?.trim(),
        name: container.querySelector('#mgr-name')?.value?.trim(),
        role_title: container.querySelector('#mgr-title')?.value?.trim(),
        auth_role: container.querySelector('#mgr-auth')?.value,
        phone: container.querySelector('#mgr-phone')?.value?.trim(),
        email: container.querySelector('#mgr-email')?.value?.trim()
      }
    });
    alert('마트 관리자 정보가 수정되었습니다.');
    await renderMartInfoView(container);
  });

  container.querySelector('#btn-cancel-staff-edit')?.addEventListener('click', () => {
    editingStaffId = '';
    renderMartInfoView(container);
  });
  container.querySelectorAll('.btn-edit-staff').forEach(btn => {
    btn.addEventListener('click', () => {
      editingStaffId = btn.dataset.sid;
      renderMartInfoView(container);
    });
  });
  container.querySelectorAll('.btn-del-staff').forEach(btn => {
    btn.addEventListener('click', async () => {
      await martApi.deleteStaff(btn.dataset.sid);
      if (editingStaffId === btn.dataset.sid) editingStaffId = '';
      await renderMartInfoView(container);
    });
  });
  container.querySelector('#form-mi-staff')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await martApi.saveStaff({
      staff_id: editingStaffId || undefined,
      name: container.querySelector('#stf-name')?.value?.trim(),
      role: container.querySelector('#stf-role')?.value,
      phone: container.querySelector('#stf-phone')?.value?.trim(),
      work_shift: container.querySelector('#stf-shift')?.value?.trim(),
      status: container.querySelector('#stf-status')?.value
    });
    editingStaffId = '';
    await renderMartInfoView(container);
  });
  container.querySelectorAll('.btn-fac-approve').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rid = btn.dataset.rid;
      const limitEl = container.querySelector(`.fac-limit-input[data-rid="${CSS.escape(rid)}"]`);
      await martApi.decideFacility({ request_id: rid, decision: 'APPROVED', credit_limit: Number(limitEl?.value ?? 500000) });
      await renderMartInfoView(container);
    });
  });
  container.querySelectorAll('.btn-fac-reject').forEach(btn => {
    btn.addEventListener('click', async () => {
      await martApi.decideFacility({ request_id: btn.dataset.rid, decision: 'REJECTED' });
      await renderMartInfoView(container);
    });
  });
}
