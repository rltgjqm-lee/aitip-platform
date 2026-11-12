/**
 * ============================================================================
 * AITIP Enterprise Platform Master Admin Controller (ESM)
 * Design Standard: DOC-18 Chapter 10
 * ============================================================================
 */

import { adminApi } from './admin-api.js';
import { renderMasterDashboard } from './modules/dashboard.js';

// 마스터 상태 저장소
const state = {
  currentView: 'view-dashboard',
  dashboardData: null,
  distributorsData: null
};

// 1. 앱 초기화
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupGlobalEvents();
  await loadCurrentView();
});

// 2. 10대 메뉴 사이드바 네비게이션 및 아코디언 접기/펴기 바인딩
function setupNavigation() {
  // A. 대항목 아코디언 토글 바인딩
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

  // B. 세부 메뉴 클릭 및 라우팅
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      if (targetView && targetView !== state.currentView) {
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        state.currentView = targetView;
        
        // 클릭된 항목이 속한 아코디언 그룹은 항상 펼침 유지
        const parentGroup = item.closest('.nav-group');
        if (parentGroup && parentGroup.classList.contains('collapsed')) {
          parentGroup.classList.remove('collapsed');
          parentGroup.querySelector('.nav-group-header')?.setAttribute('aria-expanded', 'true');
        }

        // 페이지 타이틀 동기화
        const titleEl = document.getElementById('page-title');
        const viewName = item.querySelector('.nav-label')?.textContent || '마스터 관리자';
        if (titleEl) titleEl.textContent = viewName;
        
        loadCurrentView();
      }
    });
  });
}

// 3. 글로벌 이벤트 바인딩
function setupGlobalEvents() {
  const btnRefresh = document.getElementById('btn-global-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadCurrentView(true);
    });
  }
}

// 4. 현재 뷰 데이터 로드 및 모듈 렌더링
async function loadCurrentView(forceRefresh = false) {
  const contentContainer = document.getElementById('admin-content-container');
  if (!contentContainer) return;

  if (state.currentView === 'view-dashboard') {
    if (!state.dashboardData || forceRefresh) {
      contentContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px; font-weight: 700;">
          전국 실시간 데이터를 집계하는 중입니다...
        </div>
      `;
      state.dashboardData = await adminApi.getDashboardMetrics();
    }
    renderMasterDashboard(contentContainer, state.dashboardData);
    
    // 새로고침 내부 버튼 바인딩
    contentContainer.querySelector('#btn-refresh-orders')?.addEventListener('click', () => {
      loadCurrentView(true);
    });
  } else if (state.currentView === 'view-distribution') {
    renderDistributionPlaceholder(contentContainer);
  } else if (state.currentView === 'view-settlement') {
    renderSettlementPlaceholder(contentContainer);
  } else {
    renderGenericPlaceholder(contentContainer, state.currentView);
  }
}

// 영업 유통 관리 화면 프리뷰
async function renderDistributionPlaceholder(container) {
  const data = await adminApi.getDistributors();
  const list = data.distributors || [];

  container.innerHTML = `
    <div class="panel-card" style="margin-bottom: 24px;">
      <div class="panel-header">
        <div>
          <span class="panel-title">전국 17개 광역 총판(Master Distributor) 조직망</span>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Clover ISO 및 Meituan 도시 대리상 표준 규격 (DOC-18 제 2 장)</div>
        </div>
        <button class="header-btn header-btn-primary" style="font-size: 12px;">+ 신규 광역 총판 등록</button>
      </div>
      <div class="data-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>총판 식별자</th>
              <th>총판 상호명</th>
              <th>관할 권역 (시/도)</th>
              <th>산하 대리점</th>
              <th>관리 가맹점</th>
              <th>활성 단말기</th>
              <th>당월 총 거래액 (GMV)</th>
              <th>오버라이딩 마진 (0.1%)</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(d => `
              <tr>
                <td style="font-family: monospace; font-weight: 700; color: var(--brand-mint-text);">${d.id}</td>
                <td style="font-weight: 800;">${d.name}</td>
                <td><span class="badge-status active">${d.territory}</span></td>
                <td style="font-weight: 700;">${d.agencies_cnt}개소</td>
                <td>${d.merchants_cnt}개점</td>
                <td><span style="color: var(--brand-mint-text); font-weight: 800;">${d.terminals_active}대</span></td>
                <td style="font-weight: 800;">${d.monthly_gmv.toLocaleString()}원</td>
                <td style="font-weight: 900; color: var(--brand-mint-text);">${d.overriding_margin.toLocaleString()}원</td>
                <td>
                  <button class="header-btn" style="padding: 4px 8px; font-size: 11px;">상세 관제</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 다중 자산 정산 화면 프리뷰
function renderSettlementPlaceholder(container) {
  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header">
        <div>
          <span class="panel-title">다중 자산 통합 정산 & 세무 통제 센터 (DOC-18 제 4, 5 장)</span>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">신용카드 · 카드사 포인트 · 지자체 지역화폐 · 스테이블코인 통합 대사</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="header-btn" style="font-size: 12px;">국세청 홈택스 표준 CSV 다운로드</button>
          <button class="header-btn header-btn-primary" style="font-size: 12px;">3자 대사 배치 수동 검증</button>
        </div>
      </div>
      <div class="panel-body">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
          <div style="background: var(--slate-bg); border-radius: var(--radius-sm); padding: 16px; border-left: 4px solid var(--brand-mint);">
            <div style="font-size: 12px; font-weight: 700; color: var(--text-muted);">가맹점 정산 실지급액 (오늘)</div>
            <div style="font-size: 22px; font-weight: 900; margin: 4px 0;">46,842,000원</div>
            <div style="font-size: 11.5px; color: var(--brand-mint-text); font-weight: 700;">PG 수수료 실비 1.1% 분리 완료</div>
          </div>
          <div style="background: var(--slate-bg); border-radius: var(--radius-sm); padding: 16px; border-left: 4px solid #f59e0b;">
            <div style="font-size: 12px; font-weight: 700; color: var(--text-muted);">대리점 발생 수당 (3.3% 원천징수 대상)</div>
            <div style="font-size: 22px; font-weight: 900; margin: 4px 0;">9,784,000원</div>
            <div style="font-size: 11.5px; color: #b45309; font-weight: 700;">원천징수 영수증 자동 생성 대기</div>
          </div>
          <div style="background: var(--slate-bg); border-radius: var(--radius-sm); padding: 16px; border-left: 4px solid #3b82f6;">
            <div style="font-size: 12px; font-weight: 700; color: var(--text-muted);">총판 오버라이딩 마진 (세금계산서 발행)</div>
            <div style="font-size: 22px; font-weight: 900; margin: 4px 0;">4,892,000원</div>
            <div style="font-size: 11.5px; color: #1e40af; font-weight: 700;">전자세금계산서 청구 완료</div>
          </div>
        </div>
        <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
          선택된 정산 기간의 1원 단위 3자 대사(Reconciliation) 상세 원장이 아래 테이블에 렌더링됩니다.
        </div>
      </div>
    </div>
  `;
}

function renderGenericPlaceholder(container, viewKey) {
  container.innerHTML = `
    <div class="panel-card" style="padding: 40px; text-align: center;">
      <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 8px;">${viewKey}</h3>
      <p style="font-size: 13px; color: var(--text-muted);">DOC-18 표준 명세에 따라 해당 모듈의 상세 관제 화면이 연결 준비 중입니다.</p>
    </div>
  `;
}
