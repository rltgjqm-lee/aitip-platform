/**
 * AITIP Platform Admin - 플랫폼 서비스 오픈 지역 & 5대 업종 관리 (ESM)
 * 주의: 개별 가게의 배달 행정동·반경·구간별 배달팁은 가맹점 포털(delivery.js)에서 점주가 직접 설정합니다.
 * 본사는 플랫폼 서비스 개시 지역(시·군·구) 및 재난/기상 시 긴급 배달 차단, 5대 업종 스위치만 제어합니다.
 */

import { adminApi } from '../admin-api.js';

export async function renderServiceZonesView(container) {
  if (!container) return;
  const res = await adminApi.getServiceZones();
  const modules = res.modules || [];
  const zones = res.zones || [];

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="panel-card" style="padding: 18px;">
        <div style="font-size: 13.5px; font-weight: 800; margin-bottom: 12px;">5대 업종 멀티모듈 서비스 스위치</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px;">
          ${modules.map(m => `
            <div style="border: 1px solid var(--border-default); border-radius: 8px; padding: 14px; background: ${m.active ? '#f0fdf4' : '#f8fafc'};">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 800; font-size: 13px;">${m.name}</span>
                <span class="badge-status ${m.active ? 'success' : 'default'}">${m.active ? '운영중' : '대기'}</span>
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px;">
                코드: <code>${m.code}</code> · 플랫폼 수수료 ${m.fee_pct}%
              </div>
              <button type="button" class="header-btn btn-toggle-module" data-code="${m.code}" style="margin-top: 10px; width: 100%; font-size: 11.5px; font-weight: 700;">
                ${m.active ? '서비스 일시중지' : '서비스 오픈'}
              </button>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="panel-card" style="padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-size: 13.5px; font-weight: 800;">플랫폼 서비스 오픈 지역(Launch Area) & 긴급 배달 차단 (${zones.length}개 지역)</div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">
              개별 매장의 배달 가능 행정동·반경·배달팁은 가맹점 포털에서 점주가 직접 설정합니다. 본사는 시·군·구 단위 오픈 및 기상악화 긴급 차단만 제어합니다.
            </div>
          </div>
          <form id="form-add-zone" style="display: flex; gap: 6px; flex-wrap: wrap;">
            <input id="zn-sido" type="text" value="서울특별시" style="width: 100px; padding: 5px 8px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 12px;" required />
            <input id="zn-sigungu" type="text" placeholder="시군구 (예: 송파구)" style="padding: 5px 8px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 12px;" required />
            <input id="zn-note" type="text" placeholder="오픈 비고 (예: 1차 정식 오픈)" style="padding: 5px 8px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 12px;" />
            <button type="submit" class="header-btn" style="background: #0f172a; color: #ffffff; padding: 5px 12px; font-size: 12px;">오픈 지역 추가</button>
          </form>
        </div>

        <table class="admin-table" style="font-size: 12.5px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th>지역 ID</th>
              <th>시/도 · 시/군/구</th>
              <th>비고 / 관제 메모</th>
              <th style="text-align: center;">서비스 오픈 상태</th>
              <th style="text-align: center;">긴급 배달 차단 (포장만 허용)</th>
              <th style="text-align: center;">제어</th>
            </tr>
          </thead>
          <tbody>
            ${zones.map(z => `
              <tr>
                <td><code>${z.zone_id}</code></td>
                <td style="font-weight: 700;">${z.sido} ${z.sigungu}</td>
                <td>${z.note || z.dongs || '정식 오픈 권역'}</td>
                <td style="text-align: center;">
                  <span class="badge-status ${z.active ? 'success' : 'default'}">${z.active ? '정식 오픈' : '준비중'}</span>
                </td>
                <td style="text-align: center;">
                  <span class="badge-status ${z.emergency_delivery_halt ? 'danger' : 'default'}">${z.emergency_delivery_halt ? '배달 차단중' : '정상'}</span>
                </td>
                <td style="text-align: center; white-space: nowrap;">
                  <button type="button" class="header-btn btn-toggle-zone" data-id="${z.zone_id}" style="padding: 4px 10px; font-size: 11.5px; margin-right: 4px;">${z.active ? '지역 중지' : '지역 오픈'}</button>
                  <button type="button" class="header-btn btn-toggle-halt" data-id="${z.zone_id}" style="padding: 4px 10px; font-size: 11.5px;">${z.emergency_delivery_halt ? '배달 재개' : '긴급 배달차단'}</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelectorAll('.btn-toggle-module').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminApi.updateServiceZoneOrModule({ kind: 'TOGGLE_MODULE', code: btn.getAttribute('data-code') });
      await renderServiceZonesView(container);
    });
  });

  container.querySelectorAll('.btn-toggle-zone').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminApi.updateServiceZoneOrModule({ kind: 'TOGGLE_ZONE', zone_id: btn.getAttribute('data-id') });
      await renderServiceZonesView(container);
    });
  });

  container.querySelectorAll('.btn-toggle-halt').forEach(btn => {
    btn.addEventListener('click', async () => {
      await adminApi.updateServiceZoneOrModule({ kind: 'TOGGLE_DELIVERY_HALT', zone_id: btn.getAttribute('data-id') });
      await renderServiceZonesView(container);
    });
  });

  container.querySelector('#form-add-zone')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await adminApi.updateServiceZoneOrModule({
      kind: 'ADD_ZONE',
      sido: container.querySelector('#zn-sido')?.value?.trim() || '서울특별시',
      sigungu: container.querySelector('#zn-sigungu')?.value?.trim(),
      note: container.querySelector('#zn-note')?.value?.trim()
    });
    await renderServiceZonesView(container);
  });
}
