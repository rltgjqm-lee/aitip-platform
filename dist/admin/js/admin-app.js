/**
 * ============================================================================
 * AITIP Enterprise Platform Master Admin Controller (ESM)
 * Design Standard: DOC-18 Enterprise Specifications & 5-Tier Operations
 * 100% ESM, Zero Inline Hardcoded Data (API Service Layer 일원화)
 * ============================================================================
 */

import { adminApi, ROLE_ALLOWED_VIEWS } from './admin-api.js';
import { setupAuth } from './modules/auth.js';
import { renderMasterDashboard } from './modules/dashboard.js';
import { renderMerchantsView } from './modules/merchants.js';
import { renderOnboardingView } from './modules/onboarding.js';
import { renderOrganizationTreeView } from './modules/organization-tree.js';
import { renderHardwareMdmView } from './modules/hardware-mdm.js';
import { renderRidersDispatchView } from './modules/riders-dispatch.js';
import { renderPaymentsControlView } from './modules/payments-control.js';
import { renderTaxSettlement } from './modules/settlement-taxes.js';
import { renderPartnerIntegrationsView } from './modules/partner-integrations.js';
import { renderIamAuditView } from './modules/iam-audit.js';
import { renderCsRefundsView, setCsSearchQuery } from './modules/cs-refunds.js';
import { renderPointsLedgerView } from './modules/points-ledger.js';
import { renderPromotionsView } from './modules/promotions.js';
import { renderServiceZonesView } from './modules/service-zones.js';
import { renderSystemPoliciesView } from './modules/system-policies.js';
import { initErpFilter, renderFilterBarHtml, bindFilterBarEvents } from './modules/erp-filter.js';
import { paginateItems, renderPaginationHtml, bindPaginationEvents } from './modules/pagination.js';

let liveOrdersPage = 1;
let liveOrdersPageSize = 10;
let hideUidColumn = true;

// 마스터 상태 저장소
const state = {
  currentView: 'view-dashboard',
  dashboardData: null,
  authController: null,
  currentTenant: 'hq',
  currentFilter: {
    period: 'TODAY',
    sido: 'ALL',
    sigungu: 'ALL',
    distributor: 'ALL',
    agency: 'ALL',
    targetCategory: 'DASHBOARD'
  }
};

// 1. 앱 초기화
document.addEventListener('DOMContentLoaded', async () => {
  // A. 인증 및 세션 초기화
  state.authController = setupAuth((user) => {
    loadCurrentView(true);
  });

  // B. 상단 버튼식 필터 바 초기화 & 뷰 직결 바인딩
  initErpFilter((filterState) => {
    state.currentFilter = { ...state.currentFilter, ...filterState };

    // 상단 대상 버튼 클릭 시 하단 화면 즉시 직결 전환
    if (filterState.targetCategory) {
      if (filterState.targetCategory === 'DASHBOARD') {
        state.currentView = 'view-dashboard';
      } else if (filterState.targetCategory === 'STORES') {
        state.currentView = 'view-merchants';
      } else if (filterState.targetCategory === 'MARTS') {
        state.currentView = 'view-marts';
      } else if (filterState.targetCategory === 'DEVICES') {
        state.currentView = 'view-hardware';
      } else if (filterState.targetCategory === 'RIDERS') {
        state.currentView = 'view-riders';
      } else if (filterState.targetCategory === 'ORDERS') {
        state.currentView = 'view-orders';
      }
      syncSidebarActive(state.currentView);
    }

    loadCurrentView(true);
  });

  // C. 테넌트 컨텍스트 스위처
  setupTenantSwitcher();

  // D. 사이드바 및 네비게이션
  setupNavigation();
  setupGlobalEvents();
  await loadCurrentView();
});

// 사이드바 활성 메뉴 동기화
function syncSidebarActive(viewKey) {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    const target = item.getAttribute('data-view');
    if (target === viewKey || (viewKey === 'view-marts' && target === 'view-merchants')) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const titleEl = document.getElementById('page-title');
  if (titleEl) {
    const titleMap = {
      'view-dashboard': '통합 경영 대시보드',
      'view-merchants': '가맹점 통합 관리',
      'view-onboarding': '신규 입점 온보딩 심사',
      'view-marts': '단위농협 하나로마트 관리',
      'view-hardware': '스마트 단말기 자산 & MDM',
      'view-riders': '전국 배송망 쿼드러플 관제',
      'view-orders': '실시간 주문 스트림 관제',
      'view-cs-refunds': '주문 분쟁·환불 & 고객 UID 관제 (Zero-PII)',
      'view-zones': '플랫폼 오픈 · 긴급제어',
      'view-promotions': '배너·공지 & 플랫폼 쿠폰',
      'view-points': '포인트 원장 & 어뷰징 관제 (Zero-PII)',
      'view-distribution': '영업망 & 파트너 통합 관리',
      'view-distributors': '광역 총판 관리 (Master Distributors)',
      'view-agencies': '지역 대리점 관리 (Regional Agencies)',
      'view-partners': '제휴 협력사 관리 (Partners & VAN)',
      'view-settlement-merchants': '결제 & 3자 대사 정산 관제',
      'view-settlement-taxes': '유통망 세무 정산 센터',
      'view-integrations': '제휴사 API & 서킷 브레이커',
      'view-accounts': '임직원 RBAC & 감사 로그',
      'view-policies': '시스템 정책 & API 연동'
    };
    titleEl.textContent = titleMap[viewKey] || '마스터 관리자';
  }
}

// 상단 필터 바 대상 버튼 활성화 동기화
function syncTopTargetButton(viewKey) {
  const targetBtns = document.querySelectorAll('#top-btn-group-target .filter-toggle-btn');
  const targetMap = {
    'view-dashboard': 'DASHBOARD',
    'view-merchants': 'STORES',
    'view-marts': 'MARTS',
    'view-hardware': 'DEVICES',
    'view-riders': 'RIDERS',
    'view-orders': 'ORDERS'
  };
  const activeTarget = targetMap[viewKey] || '';
  targetBtns.forEach(btn => {
    if (btn.dataset.target === activeTarget) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// RBAC 동적 메뉴 게이팅 (DOC-18 제11장)
function applyRbacMenuGating(role) {
  const allowed = ROLE_ALLOWED_VIEWS[role] || null; // null이면 전체 허용
  const navGroups = document.querySelectorAll('.nav-group');
  navGroups.forEach(group => {
    let visibleCount = 0;
    group.querySelectorAll('.nav-item').forEach(item => {
      const view = item.getAttribute('data-view');
      const ok = !allowed || allowed.includes(view);
      item.style.display = ok ? '' : 'none';
      if (ok) visibleCount++;
    });
    group.style.display = visibleCount > 0 ? '' : 'none';
  });

  if (allowed && !allowed.includes(state.currentView)) {
    state.currentView = allowed[0] || 'view-dashboard';
    syncSidebarActive(state.currentView);
    syncTopTargetButton(state.currentView);
  }
}

// 테넌트 빙의 및 RBAC 역할 스위처 바인딩
function setupTenantSwitcher() {
  const switcher = document.getElementById('tenant-switcher');
  const banner = document.getElementById('tenant-impersonate-banner');
  const nameEl = document.getElementById('impersonate-tenant-name');
  const revertBtn = document.getElementById('btn-revert-tenant');

  if (switcher) {
    switcher.addEventListener('change', () => {
      const opt = switcher.options[switcher.selectedIndex];
      const val = switcher.value;
      const role = opt?.dataset?.role || 'HQ_SUPER';
      state.currentTenant = val;
      adminApi.setAuthContext(role, val);
      applyRbacMenuGating(role);

      if (val !== 'hq') {
        const text = opt?.text.replace(/^└ \[(?:빙의|역할|제휴)\] /, '');
        if (nameEl) nameEl.textContent = `[${text} · ${role}]`;
        if (banner) banner.style.display = 'flex';
      } else {
        if (banner) banner.style.display = 'none';
      }
      loadCurrentView(true);
    });
  }

  if (revertBtn && switcher) {
    revertBtn.addEventListener('click', () => {
      switcher.value = 'hq';
      state.currentTenant = 'hq';
      adminApi.setAuthContext('HQ_SUPER', 'hq');
      applyRbacMenuGating('HQ_SUPER');
      if (banner) banner.style.display = 'none';
      loadCurrentView(true);
    });
  }
}

// 사이드바 네비게이션 및 아코디언 바인딩
function setupNavigation() {
  const groupHeaders = document.querySelectorAll('.nav-group-header');
  groupHeaders.forEach(header => {
    header.addEventListener('click', (e) => {
      e.preventDefault();
      const group = header.closest('.nav-group');
      if (group) {
        const isCollapsed = group.classList.toggle('collapsed');
        header.setAttribute('aria-expanded', !isCollapsed);
      }
    });
  });

  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      if (targetView && targetView !== state.currentView) {
        state.currentView = targetView;
        syncSidebarActive(targetView);
        syncTopTargetButton(targetView);
        loadCurrentView();
      }
    });
  });

  window.addEventListener('hashchange', () => {
    const raw = (window.location.hash || '').replace(/^#/, '');
    if (!raw) return;
    const targetView = raw === 'onboarding-new' ? 'view-onboarding' : `view-${raw}`;
    const exists = document.querySelector(`.nav-item[data-view="${targetView}"]`);
    if (exists && (targetView !== state.currentView || raw === 'onboarding-new')) {
      state.currentView = targetView;
      syncSidebarActive(targetView);
      syncTopTargetButton(targetView);
      loadCurrentView();
    }
  });
}

// 글로벌 이벤트
function setupGlobalEvents() {
  const globalSearchInput = document.getElementById('global-admin-search');
  const globalSearchBtn = document.getElementById('btn-global-admin-search');
  const runGlobalSearch = () => {
    const q = globalSearchInput?.value?.trim();
    if (!q) return;
    const isOrderOrCustomer = q.startsWith('ord_') || q.startsWith('cust_') || /^[A-Z]-\d+$/i.test(q);
    if (isOrderOrCustomer) {
      setCsSearchQuery(q);
      state.currentView = 'view-cs-refunds';
    } else {
      state.currentView = 'view-merchants';
    }
    syncSidebarActive(state.currentView);
    syncTopTargetButton(state.currentView);
    loadCurrentView(true);
  };
  globalSearchBtn?.addEventListener('click', runGlobalSearch);
  globalSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runGlobalSearch();
    }
  });

  const btnRefresh = document.getElementById('btn-global-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadCurrentView(true);
    });
  }
}

// 현재 뷰 데이터 로드 및 모듈 렌더링
async function loadCurrentView(forceRefresh = false) {
  const contentContainer = document.getElementById('admin-content-container');
  if (!contentContainer) return;

  const filter = {
    ...state.currentFilter,
    distId: state.currentFilter.distributor !== 'ALL' ? state.currentFilter.distributor : '',
    agencyId: state.currentFilter.agency !== 'ALL' ? state.currentFilter.agency : '',
    sido: state.currentFilter.sido,
    sigungu: state.currentFilter.sigungu
  };

  if (state.currentView === 'view-dashboard') {
    if (!state.dashboardData || forceRefresh) {
      contentContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px; font-weight: 700;">
          전국 실시간 데이터를 집계하는 중입니다...
        </div>
      `;
      state.dashboardData = await adminApi.getDashboardMetrics(filter);
    }
    await renderMasterDashboard(contentContainer, state.dashboardData);
  } else if (state.currentView === 'view-merchants') {
    // 소상공인 외식 가맹점 탭 기본 활성화
    await renderMerchantsView(contentContainer, filter, 'stores');
  } else if (state.currentView === 'view-onboarding') {
    // 신규 입점 온보딩 심사 (표준 5대 가입 항목 & 심사 큐)
    await renderOnboardingView(contentContainer, filter);
  } else if (state.currentView === 'view-marts') {
    // 단위농협 하나로마트 탭 기본 활성화
    await renderMerchantsView(contentContainer, filter, 'marts');
  } else if (state.currentView === 'view-distribution' || state.currentView === 'view-distributors' || state.currentView === 'view-agencies' || state.currentView === 'view-partners') {
    // 전국 영업망 & 유통 파트너 (총판 / 대리점 / 협력사)
    await renderOrganizationTreeView(contentContainer, filter, state.currentView);
  } else if (state.currentView === 'view-hardware') {
    // 스마트 단말기 MDM 관제
    await renderHardwareMdmView(contentContainer, filter);
  } else if (state.currentView === 'view-riders') {
    // 전국 배송망 관제
    await renderRidersDispatchView(contentContainer, filter);
  } else if (state.currentView === 'view-orders') {
    // 실시간 주문 스트림
    await renderLiveOrdersView(contentContainer, filter);
  } else if (state.currentView === 'view-cs-refunds') {
    // Zero-PII 주문 분쟁·환불 & 고객 UID 관제
    await renderCsRefundsView(contentContainer);
  } else if (state.currentView === 'view-zones') {
    // 배달 권역 & 5대 업종 서비스 관리
    await renderServiceZonesView(contentContainer);
  } else if (state.currentView === 'view-promotions') {
    // 배너·공지 & 플랫폼 쿠폰
    await renderPromotionsView(contentContainer);
  } else if (state.currentView === 'view-points') {
    // Zero-PII 포인트 원장 & 어뷰징 관제
    await renderPointsLedgerView(contentContainer);
  } else if (state.currentView === 'view-policies') {
    // 시스템 정책 & 점검 모드
    await renderSystemPoliciesView(contentContainer);
  } else if (state.currentView === 'view-settlement-merchants') {
    // 결제 관제: 거래 및 3자 대사 정산 원장
    await renderPaymentsControlView(contentContainer, filter);
  } else if (state.currentView === 'view-settlement-taxes') {
    // 유통망 세무 정산
    await renderTaxSettlement(contentContainer);
  } else if (state.currentView === 'view-integrations') {
    // 제휴사 API 연동 & 서킷 브레이커
    await renderPartnerIntegrationsView(contentContainer);
  } else if (state.currentView === 'view-accounts') {
    // 내부 임직원 RBAC & 감사 로그
    await renderIamAuditView(contentContainer);
  } else {
    renderGenericView(contentContainer, state.currentView);
  }
}

// 실시간 주문 스트림 관제 (사족 및 내부 키 노출 100% 제거 & 표준 페이지네이션)
async function renderLiveOrdersView(container, filter = {}) {
  const data = await adminApi.getLiveOrders(filter);
  const orders = data.orders || [];
  const pagination = paginateItems(orders, liveOrdersPage, liveOrdersPageSize);

  container.innerHTML = `
    <div class="panel-card" style="padding: 0; overflow: hidden; background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #fafafa; border-bottom: 1px solid var(--border-default); flex-wrap: wrap; gap: 10px;">
        <div>
          <span class="panel-title" style="font-weight: 900; font-size: 14px; color: var(--text-primary);">전국 실시간 주문 관제 스트림</span>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
            골목상권 소상공인 외식업 주문 및 단위농협 하나로마트 당일 배송 실시간 현황
          </div>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-secondary); cursor: pointer; user-select: none;">
            <input type="checkbox" id="chkHideUid" ${hideUidColumn ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #0f172a;" />
            <span style="font-weight: 700;">UID 숨김</span>
          </label>
          <button class="header-btn" id="btn-refresh-live-orders" style="font-size: 12px;">실시간 새로고침</button>
        </div>
      </div>

      <!-- 2단계: 순수 템플릿 필터 바 (컨테이너 내 영구 유지) -->
      ${renderFilterBarHtml(filter)}

      <div class="data-table-wrapper" style="padding: 16px;">
        <table class="admin-table" style="font-size: 12.5px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="width: 75px; text-align: center; white-space: nowrap;">전표번호</th>
              <th class="col-order-uid" style="width: 320px; white-space: nowrap; ${hideUidColumn ? 'display: none;' : ''}">주문 식별자 (UID)</th>
              <th style="white-space: nowrap;">판매 매장 (가맹점 / 마트)</th>
              <th>주문 유형</th>
              <th>주문 품목 요약</th>
              <th>결제 수단</th>
              <th style="text-align: right;">결제 금액</th>
              <th style="text-align: center;">진행 상태</th>
              <th>배차 라이더</th>
              <th>인입 시간</th>
              <th style="text-align: center; white-space: nowrap;">상세 관제</th>
            </tr>
          </thead>
          <tbody>
            ${pagination.pagedItems.length === 0 ? `
              <tr><td colspan="${hideUidColumn ? 10 : 11}" style="text-align: center; padding: 30px; color: var(--text-muted);">조건에 부합하는 주문이 없습니다.</td></tr>
            ` : pagination.pagedItems.map(o => `
              <tr data-id="${o.id}" class="row-order-target" style="cursor: pointer;">
                <td style="text-align: center; white-space: nowrap;">
                  <span class="badge-status default" style="font-size: 11.5px; font-weight: 800; padding: 2px 7px; color: #0f172a; background: #f1f5f9; border: 1px solid #cbd5e1;">${o.order_seq}</span>
                </td>
                <td class="col-order-uid" style="white-space: nowrap; ${hideUidColumn ? 'display: none;' : ''}">
                  <code>${o.id}</code>
                </td>
                <td style="white-space: nowrap;">
                  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                    <span class="badge-status ${o.seller_type === 'MART' ? 'warning' : 'active'}" style="font-size: 10px; padding: 2px 6px; white-space: nowrap; flex-shrink: 0;">
                      ${o.seller_type === 'MART' ? '하나로마트' : '외식업'}
                    </span>
                    <span style="font-weight: 800; font-size: 13px; color: var(--text-primary);">${o.store_name}</span>
                  </div>
                  ${o.buyer_facility_id ? `<div style="font-size: 11px; color: #0284c7; margin-top: 1px; font-weight: 600;" title="수령처 UID: ${o.buyer_facility_id}">수령: 서초구 양재1동 복지센터</div>` : ''}
                </td>
                <td><span class="badge-status ${o.fulfillment_type === 'DELIVERY' ? 'active' : 'pending'}">${o.fulfillment_type === 'DELIVERY' ? '배달' : o.fulfillment_type === 'TAKEOUT' ? '포장' : '직배송'}</span></td>
                <td style="font-size: 12.5px;">${o.items_desc}</td>
                <td style="font-size: 11.5px; color: var(--text-secondary);">${o.asset_label || o.asset_type}</td>
                <td style="font-weight: 800; text-align: right; color: var(--text-primary);">${o.amount.toLocaleString()}원</td>
                <td style="text-align: center;"><span class="badge-status active">${o.status === 'ACCEPTED' ? '접수완료' : o.status === 'COOKING' ? '준비중' : o.status === 'READY' ? '준비완료' : '배달중'}</span></td>
                <td style="font-weight: 700; color: var(--text-secondary);">${o.rider_name}</td>
                <td style="color: var(--text-muted); font-size: 11.5px;">${o.created_at}</td>
                <td style="text-align: center; white-space: nowrap;">
                  <button type="button" class="header-btn btn-view-order-detail" data-orderid="${o.id}" style="padding: 3px 8px; font-size: 11px; font-weight: 700; white-space: nowrap;">상세보기</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- 하단 페이지네이션 바 -->
      ${renderPaginationHtml(pagination)}
    </div>
  `;

  // 1. 필터 바 이벤트 리스너 바인딩
  bindFilterBarEvents(container, (newFilter) => {
    liveOrdersPage = 1;
    renderLiveOrdersView(container, { ...filter, ...newFilter });
  });

  // 2. 페이지네이션 이벤트 바인딩
  bindPaginationEvents(container, liveOrdersPage, (newPage) => {
    liveOrdersPage = newPage;
    renderLiveOrdersView(container, filter);
  }, (newSize) => {
    liveOrdersPageSize = newSize;
    liveOrdersPage = 1;
    renderLiveOrdersView(container, filter);
  });

  container.querySelector('#btn-refresh-live-orders')?.addEventListener('click', () => {
    renderLiveOrdersView(container, filter);
  });

  // 3. 금연 프로젝트 규격 UID 컬럼 숨김 체크박스 이벤트 바인딩
  const chkHideUid = container.querySelector('#chkHideUid');
  if (chkHideUid) {
    chkHideUid.addEventListener('change', (e) => {
      hideUidColumn = e.target.checked;
      renderLiveOrdersView(container, filter);
    });
  }

  // 4. 주문 전표 상세 모달 연동 (행 클릭 및 버튼 클릭)
  container.querySelectorAll('.btn-view-order-detail, .row-order-target').forEach(el => {
    el.addEventListener('click', (e) => {
      const orderId = el.dataset.orderid || el.closest('.row-order-target')?.dataset.id;
      const order = orders.find(o => o.id === orderId);
      if (order) {
        showOrderDetailModal(order);
      }
    });
  });
}

/**
 * 실시간 주문 전표 및 4자 정산 분개 상세 관제 모달 (Order SSOT)
 */
function showOrderDetailModal(o) {
  const existing = document.getElementById('order-detail-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'order-detail-modal-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;';

  const pgFee = Math.round(o.amount * 0.008);
  const merchantPayout = Math.round(o.amount * 0.88);
  const riderFee = 3500;
  const platformFee = Math.max(0, o.amount - merchantPayout - pgFee - riderFee);

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 8px; width: 720px; max-width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column;">
      <!-- 헤더 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a;">실시간 주문 전표 및 4자 정산 분개 관제 (SSOT)</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            전표번호: <b>${o.order_seq}</b> | 판매 점포: <b>${o.store_name}</b>
          </div>
        </div>
        <button type="button" id="btn-close-order-modal" style="background: none; border: none; font-size: 18px; font-weight: 700; color: #64748b; cursor: pointer; padding: 4px 8px;">✕</button>
      </div>

      <!-- 본문 그리드 -->
      <div style="padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12.5px; max-height: 70vh; overflow-y: auto;">
        <!-- 섹션 1: 주문 및 가맹점 식별 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[주문 및 가맹점 식별]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">계층형 UID:</span> <code style="font-family: monospace; font-size: 11px; word-break: break-all;">${o.id}</code></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">판매 매장:</span> <strong style="color: #0f172a;">${o.store_name}</strong> <span class="badge-status ${o.seller_type === 'MART' ? 'warning' : 'active'}" style="font-size: 10px;">${o.seller_type === 'MART' ? '하나로마트' : '외식업'}</span></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">매장 UID:</span> <code style="font-family: monospace;">${o.seller_id}</code></div>
          <div><span style="color: #64748b; font-weight: 600;">수령처 구분:</span> ${o.buyer_facility_id ? '<span style="color: #0284c7; font-weight: 700;">서초구 양재1동 복지센터 (경로당 영양급식)</span>' : '일반 고객 가택 배송'}</div>
        </div>

        <!-- 섹션 2: 주문 품목 상세 명세 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[주문 품목 및 처리 상태]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">주문 품목:</span> <strong style="color: #0f172a;">${o.items_desc}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">주문 유형:</span> <span class="badge-status ${o.fulfillment_type === 'DELIVERY' ? 'active' : 'pending'}" style="font-size: 10.5px;">${o.fulfillment_type === 'DELIVERY' ? '배달 주문' : '포장 주문'}</span></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">주문 인입:</span> ${o.created_at}</div>
          <div><span style="color: #64748b; font-weight: 600;">진행 상태:</span> <span class="badge-status active">${o.status === 'ACCEPTED' ? '가맹점 수락완료' : o.status === 'COOKING' ? '조리 진행중' : o.status === 'READY' ? '조리완료 (배차대기)' : '라이더 배달중'}</span></div>
        </div>

        <!-- 섹션 3: 4대 결제자산 & 4자 분개 원장 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[결제 승인 및 4자 분개]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">결제 수단:</span> <strong style="color: #1e40af;">${o.asset_label || o.asset_type}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">승인 총액:</span> <strong style="font-size: 13.5px; color: #0f172a;">${o.amount.toLocaleString()}원</strong></div>
          <div style="margin-bottom: 4px; font-size: 11.5px; color: var(--text-secondary);">├ PG 원천사 수수료 (0.8%): <b>${pgFee.toLocaleString()}원</b></div>
          <div style="margin-bottom: 4px; font-size: 11.5px; color: var(--text-secondary);">├ 가맹점 실입금액 (D+1): <b style="color: #166534;">${merchantPayout.toLocaleString()}원</b></div>
          <div style="margin-bottom: 4px; font-size: 11.5px; color: var(--text-secondary);">├ 라이더 배달료: <b>${riderFee.toLocaleString()}원</b></div>
          <div style="font-size: 11.5px; color: var(--text-secondary);">└ 플랫폼 상생 중개료: <b>${platformFee.toLocaleString()}원</b></div>
        </div>

        <!-- 섹션 4: 쿼드러플 배송망 배차 관제 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[쿼드러플 배송망 관제]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">배차 라이더:</span> <strong style="color: #0f172a;">${o.rider_name}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">배송 네트워크:</span> ${o.seller_type === 'MART' ? '시니어 2인1조 안심도보 배송망' : '지역 대리점 전담 이륜차 라이더망'}</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">배송 현황:</span> <span style="color: #10b981; font-weight: 800;">정상 배송 수행중</span></div>
          <div><span style="color: #64748b; font-weight: 600;">PoD 완료 증적:</span> R2 암호화 사진 보관소 대기</div>
        </div>
      </div>

      <!-- 푸터 액션 바 -->
      <div style="display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
        <button type="button" class="header-btn header-btn-primary btn-modal-close" style="font-size: 12px; padding: 6px 18px; font-weight: 800; cursor: pointer;">닫기</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#btn-close-order-modal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('.btn-modal-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function renderGenericView(container, viewKey) {
  container.innerHTML = `
    <div class="panel-card" style="padding: 40px; text-align: center;">
      <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 8px;">${viewKey}</h3>
      <p style="font-size: 13px; color: var(--text-muted);">표준 명세에 따라 해당 모듈의 데이터가 연결 준비 중입니다.</p>
    </div>
  `;
}
