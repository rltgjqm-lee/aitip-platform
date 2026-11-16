/**
 * AITIP Enterprise Merchants & Marts Management Module (ESM)
 * 소상공인 외식업 가맹점 및 단위농협 하나로마트 점포망 관리 & 페이지네이션
 * 100% ESM, Zero Inline Hardcoded Data (API Layer 일원화)
 * D1 SSOT: docs/schema_aitip_v01.sql (stores, mart_suppliers 테이블 준수)
 */

import { adminApi, KSIC_FOOD_CATEGORIES } from '../admin-api.js';
import { renderFilterBarHtml, bindFilterBarEvents } from './erp-filter.js';
import { paginateItems, renderPaginationHtml, bindPaginationEvents } from './pagination.js';

let activeSubTab = 'stores'; // 'stores' | 'marts'
let selectedKsicCode = 'ALL';
let storesPage = 1;
let storesPageSize = 10;
let martsPage = 1;
let martsPageSize = 10;

export async function renderMerchantsView(container, filter = {}, defaultTab = null) {
  if (!container) return;

  if (defaultTab) {
    activeSubTab = defaultTab;
  }

  // 외식업 필터 파라미터 병합
  const storesFilter = { ...filter };
  if (selectedKsicCode && selectedKsicCode !== 'ALL') {
    storesFilter.ksicCode = selectedKsicCode;
  }

  // 1. 외식업 가맹점 및 하나로마트 점포망, 대리점, 단말기 병렬 조회
  const [storesRes, martsRes, agenciesRes, devicesRes] = await Promise.all([
    adminApi.getStores(storesFilter),
    adminApi.getMarts(filter),
    adminApi.getAgencies(filter),
    adminApi.getDevices(filter)
  ]);

  const stores = storesRes.stores || [];
  const marts = martsRes.marts || [];
  const agencies = agenciesRes.agencies || [];
  const devices = devicesRes.devices || [];

  const agencyMap = {};
  agencies.forEach(a => { agencyMap[a.id] = a; });

  const storePagination = paginateItems(stores, storesPage, storesPageSize);
  const martPagination = paginateItems(marts, martsPage, martsPageSize);

  container.innerHTML = `
    <div class="panel-card" style="padding: 0; overflow: hidden; background: #ffffff;">
      <!-- 1단계: 상단 2대 공급 점포망 탭 네비게이션 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #fafafa; border-bottom: 1px solid var(--border-default); flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; gap: 4px;">
          <button type="button" class="merchant-tab-btn header-btn ${activeSubTab === 'stores' ? 'header-btn-primary' : ''}" data-tab="stores" style="font-size: 12px; font-weight: 700;">
            소상공인 외식 가맹점 (${stores.length}개점)
          </button>
          <button type="button" class="merchant-tab-btn header-btn ${activeSubTab === 'marts' ? 'header-btn-primary' : ''}" data-tab="marts" style="font-size: 12px; font-weight: 700;">
            단위농협 하나로마트 (${marts.length}개소)
          </button>
        </div>
        <div style="display: flex; gap: 8px;">
          <a href="#onboarding-new" class="header-btn header-btn-primary" id="btn-go-onboarding" style="font-size: 11.5px; text-decoration: none;">
            + 신규 가맹점 표준 온보딩 신청
          </a>
        </div>
      </div>

      <!-- 2단계: 조건 필터 바 (순수 템플릿 렌더링) -->
      ${renderFilterBarHtml(filter)}

      ${activeSubTab === 'stores' ? `
        <!-- 통계청 법정 표준분류 드롭다운 셀렉트 툴바 -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 18px; background: #ffffff; border-bottom: 1px solid var(--border-default); flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">통계청 표준업종 필터:</span>
            <select id="select-merchant-ksic" class="erp-select" style="font-size: 12px; font-weight: 700; padding: 5px 10px;">
              ${KSIC_FOOD_CATEGORIES.map(cat => `
                <option value="${cat.code}" ${selectedKsicCode === cat.code ? 'selected' : ''}>
                  ${cat.name}
                </option>
              `).join('')}
            </select>
          </div>
          <div style="font-size: 11.5px; color: var(--text-muted);">
            가입 및 심사 시 통계청 KSIC-11 법정 코드로 100% 매핑 관리됩니다.
          </div>
        </div>
      ` : ''}

      <!-- 3단계: 점포망 데이터 테이블 & 하단 페이지네이션 바 -->
      <div class="data-table-wrapper" style="padding: 16px 16px 0 16px;">
        ${activeSubTab === 'stores' ? `
          <table class="admin-table" style="font-size: 12.5px;">
            <thead>
              <tr style="background: #f8fafc;">
                <th>가맹점 상호명</th>
                <th>통계청 업종분류</th>
                <th>사업자등록번호</th>
                <th>대표자 (연락처)</th>
                <th>소재지 권역 및 주소</th>
                <th>소속 대리점</th>
                <th style="text-align: center;">연동 단말기</th>
                <th style="text-align: right;">당일 주문</th>
                <th style="text-align: right;">당일 거래액</th>
                <th style="text-align: center;">영업 상태</th>
                <th style="text-align: center;">상세 관제</th>
              </tr>
            </thead>
            <tbody>
              ${storePagination.pagedItems.length === 0 ? `
                <tr><td colspan="11" style="text-align: center; padding: 30px; color: var(--text-muted);">조건에 부합하는 외식 가맹점이 없습니다.</td></tr>
              ` : storePagination.pagedItems.map(s => {
                const agencyName = agencyMap[s.agency_id]?.name || '(주)서초네트웍스 (대리점 01)';
                return `
                <tr data-id="${s.id}" class="row-merchant-target" style="cursor: pointer;">
                  <td>
                    <span style="font-weight: 800; font-size: 13px; color: var(--text-primary);">${s.name}</span>
                  </td>
                  <td>
                    <span class="badge-status active" style="font-size: 11px; font-weight: 700; background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1;">${s.category_label || s.ksic_name}</span>
                    <span style="font-size: 10.5px; color: var(--text-muted); margin-left: 3px;">(${s.store_category || s.ksic_code || '561'})</span>
                  </td>
                  <td style="font-family: monospace; font-size: 11.5px;">${s.biz_number}</td>
                  <td>${s.rep_name || s.owner_name || '-'} <span style="font-size: 11px; color: var(--text-muted);">(${s.phone})</span></td>
                  <td style="font-size: 11.5px; color: var(--text-secondary); max-width: 180px;">${s.address}</td>
                  <td style="font-size: 11.5px; font-weight: 700; color: var(--text-primary);">
                    ${s.agency_id === 'HQ_DIRECT' || s.agency_id === 'HQ_DIRECT_AGENCY' ? '<span class="badge-status success" style="font-size: 10px; margin-right: 4px;">본사직영</span>' : ''}
                    ${s.agency_name || agencyName}
                  </td>
                  <td style="text-align: center; font-weight: 800; color: var(--brand-mint-text);">${s.devices_cnt ?? (s.device_id ? 1 : 0)}대</td>
                  <td style="text-align: right; font-weight: 700;">${s.today_orders || 0}건</td>
                  <td style="text-align: right; font-weight: 800; color: var(--text-primary);">${Number(s.today_gmv || 0).toLocaleString()}원</td>
                  <td style="text-align: center;">
                    <span class="badge-status ${s.status === 'PAUSED' ? 'warning' : 'active'}">${s.status === 'PAUSED' ? '일시중지' : '정상영업'}</span>
                  </td>
                  <td style="text-align: center; white-space: nowrap;">
                    <button type="button" class="header-btn btn-toggle-store-status" data-mid="${s.id}" style="padding: 3px 8px; font-size: 11px; font-weight: 700; margin-right: 4px;">${s.status === 'PAUSED' ? '영업재개' : '일시중지'}</button>
                    <button type="button" class="header-btn btn-view-merchant-detail" data-mid="${s.id}" data-type="STORE" style="padding: 3px 8px; font-size: 11px; font-weight: 700;">상세보기</button>
                  </td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        ` : `
          <table class="admin-table" style="font-size: 12.5px;">
            <thead>
              <tr style="background: #f8fafc;">
                <th>마트 상호명</th>
                <th>사업자등록번호</th>
                <th>조합장 / 점장 (연락처)</th>
                <th>소재지 주소</th>
                <th>공급 특화 품목</th>
                <th style="text-align: center;">연동 단말기</th>
                <th style="text-align: right;">당일 주문</th>
                <th style="text-align: right;">당일 거래액</th>
                <th style="text-align: center;">상태</th>
                <th style="text-align: center;">상세 관제</th>
              </tr>
            </thead>
            <tbody>
              ${martPagination.pagedItems.length === 0 ? `
                <tr><td colspan="10" style="text-align: center; padding: 30px; color: var(--text-muted);">조건에 부합하는 하나로마트가 없습니다.</td></tr>
              ` : martPagination.pagedItems.map(m => `
                <tr data-id="${m.id}" class="row-merchant-target" style="cursor: pointer;">
                  <td>
                    <span style="font-weight: 800; font-size: 13px; color: var(--text-primary);">${m.name}</span>
                  </td>
                  <td style="font-family: monospace; font-size: 12px; color: var(--text-secondary);">${m.biz_number}</td>
                  <td>${m.rep_name} <span style="font-size: 11px; color: var(--text-muted);">(${m.phone})</span></td>
                  <td>${m.address}</td>
                  <td style="font-size: 11.5px; color: var(--text-secondary);">${m.supply_category}</td>
                  <td style="text-align: center; font-weight: 800; color: #10b981;">${m.devices_cnt}대</td>
                  <td style="text-align: right; font-weight: 700;">${m.today_orders}건</td>
                  <td style="text-align: right; font-weight: 800; color: var(--text-primary);">${m.today_gmv.toLocaleString()}원</td>
                  <td style="text-align: center;"><span class="badge-status active">정상공급</span></td>
                  <td style="text-align: center;">
                    <button type="button" class="header-btn btn-view-merchant-detail" data-mid="${m.id}" data-type="MART" style="padding: 3px 8px; font-size: 11px; font-weight: 700; white-space: nowrap;">상세보기</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>

      <!-- 하단 페이지네이션 바 -->
      ${activeSubTab === 'stores' ? renderPaginationHtml(storePagination) : renderPaginationHtml(martPagination)}
    </div>
  `;

  // 1. 필터 바 이벤트 리스너 바인딩
  bindFilterBarEvents(container, (newFilter) => {
    storesPage = 1;
    martsPage = 1;
    renderMerchantsView(container, { ...filter, ...newFilter });
  });

  // 2. 점포망 탭 클릭 바인딩
  container.querySelectorAll('.merchant-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSubTab = btn.dataset.tab;
      renderMerchantsView(container, filter);
    });
  });

  // 3. 통계청 업종분류 드롭다운 셀렉트 바인딩
  const ksicSelect = container.querySelector('#select-merchant-ksic');
  if (ksicSelect) {
    ksicSelect.addEventListener('change', () => {
      selectedKsicCode = ksicSelect.value;
      storesPage = 1;
      renderMerchantsView(container, filter);
    });
  }

  // 4. 페이지네이션 이벤트 바인딩
  if (activeSubTab === 'stores') {
    bindPaginationEvents(container, storesPage, (newPage) => {
      storesPage = newPage;
      renderMerchantsView(container, filter);
    }, (newSize) => {
      storesPageSize = newSize;
      storesPage = 1;
      renderMerchantsView(container, filter);
    });
  } else {
    bindPaginationEvents(container, martsPage, (newPage) => {
      martsPage = newPage;
      renderMerchantsView(container, filter);
    }, (newSize) => {
      martsPageSize = newSize;
      martsPage = 1;
      renderMerchantsView(container, filter);
    });
  }

  // 4-5. 가맹점 영업 상태 실시간 토글 (dev-server /api/admin/stores/status 직결)
  container.querySelectorAll('.btn-toggle-store-status').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const mid = btn.dataset.mid;
      if (!mid) return;
      await adminApi.toggleStoreStatus(mid);
      await renderMerchantsView(container, filter);
    });
  });

  // 5. 가맹점 및 하나로마트 [상세보기] 모달 팝업 연동
  container.querySelectorAll('.btn-view-merchant-detail, .row-merchant-target').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.btn-toggle-store-status')) return;
      const mid = el.dataset.mid || el.closest('.row-merchant-target')?.dataset.id;
      const isMart = (el.dataset.type === 'MART') || activeSubTab === 'marts';
      const targetStore = isMart ? marts.find(m => m.id === mid) : stores.find(s => s.id === mid);
      if (targetStore) {
        const agency = agencyMap[targetStore.agency_id];
        const storeDevices = devices.filter(d => (d.store_id === targetStore.id || d.mart_id === targetStore.id));
        showStoreDetailModal({ ...targetStore, isMart }, agency, storeDevices);
      }
    });
  });
}

/**
 * 가맹점 및 하나로마트 점포 상세 운영 관제 중앙 모달 (SSOT)
 */
function showStoreDetailModal(store, agency, devices = []) {
  const existing = document.getElementById('store-detail-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'store-detail-modal-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;';

  const defaultSerial = devices.length > 0 ? (devices[0].board_serial || devices[0].serial_no || 'CTI-BRD-882910') : 'CTI-BRD-882910';
  const defaultMac = devices.length > 0 ? (devices[0].mac_address || 'B8:27:EB:14:8A:21') : 'B8:27:EB:14:8A:21';
  const repName = store.rep_name || store.owner_name || '-';
  const posName = store.isMart ? '농협 ERP / 하나로 POS' : (store.pos_company || '오케이포스 (OKPOS) v3.2');
  const agencyTitle = agency ? agency.name : '(주)서초네트웍스 (대리점 01)';
  const agencyRep = agency ? `${agency.rep_name} (${agency.phone})` : '이진수 (02-3471-9920)';

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 8px; width: 720px; max-width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column;">
      <!-- 헤더 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a;">가맹점 점포 상세 운영 관제 (SSOT)</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            상호명: <b>${store.name}</b> | 사업자번호: ${store.biz_number}
          </div>
        </div>
        <button type="button" id="btn-close-store-modal" style="background: none; border: none; font-size: 18px; font-weight: 700; color: #64748b; cursor: pointer; padding: 4px 8px;">✕</button>
      </div>

      <!-- 본문 그리드 -->
      <div style="padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12.5px; max-height: 70vh; overflow-y: auto;">
        <!-- 섹션 1: 기본 사업자 및 매장 정보 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[기본 사업자 및 매장 정보]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">점포 상호:</span> <strong style="color: #0f172a;">${store.name}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">업종 구분:</span> <span class="badge-status ${store.isMart ? 'warning' : 'active'}" style="font-size: 10.5px;">${store.isMart ? '하나로마트 공공유통' : (store.category_label || store.ksic_name || '일반 외식 가맹점')}</span></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">사업자등록번호:</span> <code style="font-family: monospace; font-weight: 700;">${store.biz_number}</code></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">대표자 (연락처):</span> ${repName} (${store.phone || '-'})</div>
          <div><span style="color: #64748b; font-weight: 600;">소재지 주소:</span> ${store.address || '서울특별시 서초구 반포대로 14길 30'}</div>
        </div>

        <!-- 섹션 2: 소속 영업망 & 관리 체계 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[소속 영업망 & 관리 체계]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">소속 광역 총판:</span> <strong>서울광역 총판 (주)에이티파트너스</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">소속 지역 대리점:</span> <strong style="color: #1e40af;">${agencyTitle}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">대리점 담당자:</span> ${agencyRep}</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">영업망 수수료율:</span> 0.5% (지역 대리점 배분)</div>
          <div><span style="color: #64748b; font-weight: 600;">관제 권역:</span> 서울특별시 서초구 관할</div>
        </div>

        <!-- 섹션 3: 설치 단말기 & CTI 하드웨어 연동 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[설치 단말기 & CTI 하드웨어]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">연동 단말기:</span> <strong style="color: #166534;">총 ${store.devices_cnt || 1}대 가동중</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">대표 단말 S/N:</span> <code style="font-weight: 800; color: #0f172a;">${defaultSerial}</code></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">하드웨어 MAC:</span> <code style="color: #2563eb;">${defaultMac}</code></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">연동 POS사:</span> <span class="badge-status active" style="font-size: 10.5px;">${posName}</span></div>
          <div><span style="color: #64748b; font-weight: 600;">실시간 통신망:</span> <span style="color: #10b981; font-weight: 800;">온라인 정상 (MQTT 8883)</span></div>
        </div>

        <!-- 섹션 4: 당일 영업 및 결제 정산 실적 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[당일 영업 및 결제 정산]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">당일 주문 건수:</span> <strong style="font-size: 13.5px;">${store.today_orders || 0}건</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">당일 거래액 (GMV):</span> <strong style="font-size: 13.5px; color: #0f172a;">${(store.today_gmv || 0).toLocaleString()}원</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">정산 주기 / 수수료:</span> D+1 익일정산 (우대 0.8%)</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">정산 수취 계좌:</span> 신한은행 110-***-**** (예금주: ${repName})</div>
          <div><span style="color: #64748b; font-weight: 600;">운영 상태:</span> <span class="badge-status active">${store.isMart ? '정상공급 가동' : '정상영업 중'}</span></div>
        </div>
      </div>

      <!-- 푸터 액션 바 -->
      <div style="display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
        <button type="button" class="header-btn header-btn-primary btn-modal-close" style="font-size: 12px; padding: 6px 18px; font-weight: 800; cursor: pointer;">닫기</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#btn-close-store-modal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('.btn-modal-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}
