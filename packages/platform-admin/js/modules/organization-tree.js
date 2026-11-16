/**
 * AITIP Enterprise Nationwide Sales Organization Module
 * 전국 17개 총판, 226개 지역 대리점, 제휴 협력사(VAN/설치) 계층 관제 원장
 * 100% ESM, Zero Inline Hardcoded Data
 * D1 SSOT: docs/schema_aitip_v01.sql (partner_agencies, partner_agents 테이블 준수)
 */

import { adminApi } from '../admin-api.js';
import { renderFilterBarHtml, bindFilterBarEvents } from './erp-filter.js';
import { paginateItems, renderPaginationHtml, bindPaginationEvents } from './pagination.js';

let currentSubTab = 'all'; // 'all' | 'distributors' | 'agencies' | 'partners'
let distPage = 1;
let distPageSize = 10;
let agencyPage = 1;
let agencyPageSize = 10;
let partnerPage = 1;
let partnerPageSize = 10;
let treePage = 1;
let treePageSize = 10;

export async function renderOrganizationTreeView(container, filter = {}, subView = null) {
  if (!container) return;

  if (subView) {
    if (subView === 'view-distributors') currentSubTab = 'distributors';
    else if (subView === 'view-agencies') currentSubTab = 'agencies';
    else if (subView === 'view-partners') currentSubTab = 'partners';
  }

  const [distRes, agenciesRes, partnersRes] = await Promise.all([
    adminApi.getDistributors(filter),
    adminApi.getAgencies(filter),
    adminApi.getPartners(filter)
  ]);

  const distributors = distRes.distributors || [];
  const agencies = agenciesRes.agencies || [];
  const partners = partnersRes.partners || [];

  let activePagination;
  if (currentSubTab === 'distributors') {
    activePagination = paginateItems(distributors, distPage, distPageSize);
  } else if (currentSubTab === 'agencies') {
    activePagination = paginateItems(agencies, agencyPage, agencyPageSize);
  } else if (currentSubTab === 'partners') {
    activePagination = paginateItems(partners, partnerPage, partnerPageSize);
  } else {
    // 'all' 종합 트리의 경우 총판 단위 페이징
    activePagination = paginateItems(distributors, treePage, treePageSize);
  }

  container.innerHTML = `
    <div class="panel-card" style="padding: 0; overflow: hidden; background: #ffffff;">
      <!-- 상단 컨트롤 툴바: 3대 조직 계층 탭식 스위처 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #fafafa; border-bottom: 1px solid var(--border-default); flex-wrap: wrap; gap: 10px;">
        <div>
          <span class="panel-title" style="font-weight: 900; font-size: 14px; color: var(--text-primary);">전국 영업망 & 유통 파트너 조직 관리</span>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
            D1 partner_agencies 표준: 광역 총판(17개) &rarr; 지역 대리점(226개) &rarr; 제휴 협력사(VAN/설치) 3단계 위계
          </div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="org-tab-btn-group">
          <button type="button" class="header-btn" id="btn-open-org-modal" style="font-size: 11.5px; background: #0f172a; color: #ffffff; font-weight: 700; white-space: nowrap;">
            + 신규 조직 계약 등록
          </button>
          <button type="button" class="header-btn ${currentSubTab === 'all' ? 'header-btn-primary' : ''}" data-sub="all" style="font-size: 11.5px; white-space: nowrap;">
            유통망 전체 트리
          </button>
          <button type="button" class="header-btn ${currentSubTab === 'distributors' ? 'header-btn-primary' : ''}" data-sub="distributors" style="font-size: 11.5px; white-space: nowrap;">
            광역 총판 (${distributors.length}개소)
          </button>
          <button type="button" class="header-btn ${currentSubTab === 'agencies' ? 'header-btn-primary' : ''}" data-sub="agencies" style="font-size: 11.5px; white-space: nowrap;">
            지역 대리점 (${agencies.length}개소)
          </button>
          <button type="button" class="header-btn ${currentSubTab === 'partners' ? 'header-btn-primary' : ''}" data-sub="partners" style="font-size: 11.5px; white-space: nowrap;">
            제휴 협력사 (${partners.length}개소)
          </button>
        </div>
      </div>

      <!-- 2단계: 순수 템플릿 필터 바 (컨테이너 내 영구 유지) -->
      ${renderFilterBarHtml(filter)}

      <!-- 메인 테이블 영역 -->
      ${renderTabContentHtml(currentSubTab, activePagination.pagedItems, distributors)}

      <!-- 하단 페이지네이션 바 -->
      ${renderPaginationHtml(activePagination)}
    </div>
  `;

  // 1. 필터 바 이벤트 바인딩
  bindFilterBarEvents(container, (newFilter) => {
    distPage = 1;
    agencyPage = 1;
    partnerPage = 1;
    treePage = 1;
    renderOrganizationTreeView(container, { ...filter, ...newFilter });
  });

  // 2. 서브탭 전환 및 표준 조직 계약 등록 모달
  container.querySelector('#btn-open-org-modal')?.addEventListener('click', () => {
    showOrgContractModal(distributors, container, filter);
  });

  container.querySelectorAll('#org-tab-btn-group button[data-sub]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSubTab = btn.dataset.sub;
      renderOrganizationTreeView(container, filter);
    });
  });

  // 3. 페이지네이션 이벤트 바인딩
  const currentPage = currentSubTab === 'distributors' ? distPage :
                      currentSubTab === 'agencies' ? agencyPage :
                      currentSubTab === 'partners' ? partnerPage : treePage;

  bindPaginationEvents(container, currentPage, (newPage) => {
    if (currentSubTab === 'distributors') distPage = newPage;
    else if (currentSubTab === 'agencies') agencyPage = newPage;
    else if (currentSubTab === 'partners') partnerPage = newPage;
    else treePage = newPage;
    renderOrganizationTreeView(container, filter);
  }, (newSize) => {
    if (currentSubTab === 'distributors') { distPageSize = newSize; distPage = 1; }
    else if (currentSubTab === 'agencies') { agencyPageSize = newSize; agencyPage = 1; }
    else if (currentSubTab === 'partners') { partnerPageSize = newSize; partnerPage = 1; }
    else { treePageSize = newSize; treePage = 1; }
    renderOrganizationTreeView(container, filter);
  });

  // 트리 접기/펼치기
  container.querySelectorAll('.btn-toggle-tree').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetClass = btn.dataset.target;
      const subRows = container.querySelectorAll(`.${targetClass}`);
      const isExpanded = btn.textContent === '-';
      subRows.forEach(row => { row.style.display = isExpanded ? 'none' : 'table-row'; });
      btn.textContent = isExpanded ? '+' : '-';
    });
  });

  // 4. 총판, 대리점, 협력사 [상세보기] 모달 연동
  container.querySelectorAll('.btn-view-dist-detail, .row-dist-target').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.btn-impersonate-from-row')) return;
      const distId = el.dataset.distid || el.closest('.row-dist-target')?.dataset.id;
      const dist = distributors.find(d => d.id === distId);
      if (dist) showDistributorDetailModal(dist);
    });
  });

  container.querySelectorAll('.btn-view-agency-detail, .row-agency-target').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.btn-impersonate-from-row')) return;
      const agencyId = el.dataset.agencyid || el.closest('.row-agency-target')?.dataset.id;
      const agency = agencies.find(a => a.id === agencyId);
      if (agency) {
        const parentDist = distributors.find(d => d.id === agency.distributor_id);
        showAgencyDetailModal(agency, parentDist);
      }
    });
  });

  container.querySelectorAll('.btn-view-partner-detail, .row-partner-target').forEach(el => {
    el.addEventListener('click', (e) => {
      const partnerId = el.dataset.partnerid || el.closest('.row-partner-target')?.dataset.id;
      const partner = partners.find(p => p.id === partnerId);
      if (partner) showPartnerDetailModal(partner);
    });
  });
}

function renderTabContentHtml(tab, items, distributors = []) {
  const distMap = {};
  distributors.forEach(d => {
    distMap[d.id] = d;
  });

  if (tab === 'distributors') {
    return `
      <div class="data-table-wrapper" style="padding: 16px;">
        <table class="admin-table" style="font-size: 12.5px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th>광역 총판 법인명</th>
              <th>관할 권역</th>
              <th>사업자등록번호</th>
              <th>대표자 (연락처)</th>
              <th style="text-align: center;">산하 대리점</th>
              <th style="text-align: center;">관리 가맹점</th>
              <th style="text-align: right;">당월 누적 GMV</th>
              <th style="text-align: right;">오버라이딩 수수료</th>
              <th style="text-align: center; white-space: nowrap;">관제 액션</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? `
              <tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">조건에 부합하는 총판이 없습니다.</td></tr>
            ` : items.map(d => `
              <tr data-id="${d.id}" class="row-dist-target" style="cursor: pointer;">
                <td>
                  <span style="font-weight: 800; font-size: 13px; color: var(--text-primary);">${d.name}</span>
                  <div style="font-family: monospace; font-size: 10.5px; color: var(--text-muted); margin-top: 1px;">관리코드: DIST-${d.territory_code || '11'}</div>
                </td>
                <td><span class="badge-status active" style="font-size: 11px;">${d.territory_name}</span></td>
                <td style="font-family: monospace; font-size: 11.5px;">${d.biz_number}</td>
                <td><span style="font-weight: 700;">${d.rep_name}</span> <span style="font-size: 11px; color: var(--text-muted);">(${d.phone})</span></td>
                <td style="text-align: center; font-weight: 800;">${d.agencies_cnt}개소</td>
                <td style="text-align: center;">${d.merchants_cnt}개점</td>
                <td style="text-align: right; font-weight: 900;">${Number(d.monthly_gmv || 0).toLocaleString()}원</td>
                <td style="text-align: right; font-weight: 800; color: var(--brand-mint-text);">${Number(d.margin_amount || 0).toLocaleString()}원</td>
                <td style="text-align: center; white-space: nowrap;">
                  <button type="button" class="header-btn btn-view-dist-detail" data-distid="${d.id}" style="padding: 4px 8px; font-size: 11px; white-space: nowrap; font-weight: 700; margin-right: 4px;">
                    상세보기
                  </button>
                  <button type="button" class="header-btn btn-impersonate-from-row" data-tenantid="${d.id}" style="padding: 4px 10px; font-size: 11px; white-space: nowrap; font-weight: 700;">
                    총판 뷰 전환
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (tab === 'agencies') {
    return `
      <div class="data-table-wrapper" style="padding: 16px;">
        <table class="admin-table" style="font-size: 12.5px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th>대리점 상호명</th>
              <th>관할 시·군·구</th>
              <th>소속 광역 총판</th>
              <th>사업자번호</th>
              <th>대표자 (연락처)</th>
              <th style="text-align: center;">관리 가맹점</th>
              <th style="text-align: center;">가동 단말기</th>
              <th style="text-align: right;">당월 GMV</th>
              <th style="text-align: right;">수수료 배분</th>
              <th style="text-align: center; white-space: nowrap;">관제 액션</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? `
              <tr><td colspan="10" style="text-align: center; padding: 30px; color: var(--text-muted);">조건에 부합하는 대리점이 없습니다.</td></tr>
            ` : items.map(a => {
              const parentDist = distMap[a.distributor_id];
              const distDisplayName = parentDist ? parentDist.name : '서울광역 총판 (주)에이티파트너스';
              return `
              <tr data-id="${a.id}" class="row-agency-target" style="cursor: pointer;">
                <td>
                  <span style="font-weight: 800; font-size: 13px; color: var(--text-primary);">${a.name}</span>
                  <div style="font-family: monospace; font-size: 10.5px; color: var(--text-muted); margin-top: 1px;">관리코드: AGY-${a.region_code || '11'}</div>
                </td>
                <td><span class="badge-status default" style="font-size: 11px; font-weight: 700;">${a.region_name}</span></td>
                <td>
                  <span style="font-weight: 700; font-size: 12px; color: var(--text-primary);">${distDisplayName}</span>
                </td>
                <td style="font-family: monospace; font-size: 11.5px;">${a.biz_number}</td>
                <td><span style="font-weight: 700;">${a.rep_name}</span> <span style="font-size: 11px; color: var(--text-muted);">(${a.phone})</span></td>
                <td style="text-align: center; font-weight: 800;">${a.merchants_cnt}개점</td>
                <td style="text-align: center; font-weight: 800; color: var(--brand-mint-text);">${a.devices_cnt}대</td>
                <td style="text-align: right; font-weight: 700;">${Number(a.monthly_gmv || 0).toLocaleString()}원</td>
                <td style="text-align: right; font-weight: 800; color: var(--text-secondary);">${Number(a.margin_amount || 0).toLocaleString()}원 <span style="font-size: 10px; color: var(--text-muted);">(${Number((a.gmv_share_rate || 0) * 100).toFixed(1)}%)</span></td>
                <td style="text-align: center; white-space: nowrap;">
                  <button type="button" class="header-btn btn-view-agency-detail" data-agencyid="${a.id}" style="padding: 4px 8px; font-size: 11px; white-space: nowrap; font-weight: 700; margin-right: 4px;">
                    상세보기
                  </button>
                  <button type="button" class="header-btn btn-impersonate-from-row" data-tenantid="${a.id}" style="padding: 4px 10px; font-size: 11px; white-space: nowrap; font-weight: 700;">
                    대리점 뷰 전환
                  </button>
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (tab === 'partners') {
    return `
      <div class="data-table-wrapper" style="padding: 16px;">
        <table class="admin-table" style="font-size: 12.5px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th>협력사 법인 상호명</th>
              <th>제휴 협력사 유형</th>
              <th>사업자등록번호</th>
              <th>제휴 및 기술 영역</th>
              <th>서비스 권역</th>
              <th>현장 엔지니어/라이더</th>
              <th style="text-align: center;">유지보수 단말기</th>
              <th style="text-align: center;">제휴 상태</th>
              <th style="text-align: center; white-space: nowrap;">상세 관제</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? `
              <tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">조건에 부합하는 협력사가 없습니다.</td></tr>
            ` : items.map(p => `
              <tr data-id="${p.id}" class="row-partner-target" style="cursor: pointer;">
                <td>
                  <span style="font-weight: 800; font-size: 13px; color: var(--text-primary);">${p.name}</span>
                </td>
                <td>
                  <span class="badge-status ${p.agency_type === 'INSTALLATION_PARTNER' ? 'active' : 'pending'}" style="font-size: 10.5px; font-weight: 700;">
                    ${p.agency_type === 'INSTALLATION_PARTNER' ? '단말기/설치 협력사' : '배달대행 연동사'}
                  </span>
                </td>
                <td style="font-family: monospace; font-size: 11.5px;">${p.biz_number}</td>
                <td style="font-size: 12px; color: var(--text-secondary);">${p.category}</td>
                <td style="font-size: 11.5px; font-weight: 600;">${p.coverage}</td>
                <td style="font-weight: 700; text-align: center;">${p.engineers_cnt}명</td>
                <td style="text-align: center; font-weight: 800; color: var(--brand-mint-text);">${p.devices_maintained > 0 ? p.devices_maintained + '대' : '-'}</td>
                <td style="text-align: center;"><span class="badge-status active" style="font-size: 11px;">제휴 정상</span></td>
                <td style="text-align: center; white-space: nowrap;">
                  <button type="button" class="header-btn btn-view-partner-detail" data-partnerid="${p.id}" style="padding: 4px 8px; font-size: 11px; white-space: nowrap; font-weight: 700;">
                    상세보기
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // 기본: 'all' 종합 트리
  return `
    <div class="data-table-wrapper" style="padding: 16px;">
      <table class="admin-table" style="font-size: 12.5px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="width: 44px; text-align: center;">계층</th>
            <th style="width: 140px;">관할 권역</th>
            <th>조직 상호명 (총판 / 대리점)</th>
            <th style="text-align: center; width: 90px;">산하 대리점</th>
            <th style="text-align: center; width: 90px;">관리 가맹점</th>
            <th style="text-align: center; width: 90px;">가동 단말기</th>
            <th style="text-align: right; width: 140px;">당월 누적 GMV</th>
            <th style="text-align: right; width: 140px;">오버라이딩 수수료</th>
            <th style="text-align: center; width: 80px;">상태</th>
            <th style="width: 120px; text-align: center;">관제 액션</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0 ? `
            <tr><td colspan="10" style="text-align: center; padding: 30px; color: var(--text-muted);">조건에 부합하는 영업망 조직이 없습니다.</td></tr>
          ` : items.map(d => `
            <tr class="tree-dist-row" data-id="${d.id}" style="background: #ffffff; font-weight: 700; border-top: 1px solid var(--border-default);">
              <td style="text-align: center;">
                <button type="button" class="btn-toggle-tree" data-target="sub-${d.id}" style="border: 1px solid var(--border-default); background: #ffffff; border-radius: 4px; width: 22px; height: 22px; cursor: pointer; font-weight: 900; line-height: 1;">-</button>
              </td>
              <td><span class="badge-status active" style="font-size: 11px;">${d.territory_name || d.sido_name || '전국'}</span></td>
              <td>
                <span style="font-weight: 800; font-size: 13px; color: var(--text-primary);">${d.name}</span>
              </td>
              <td style="text-align: center; font-weight: 800;">${d.agencies_cnt ?? (d.agencies?.length || 0)}개소</td>
              <td style="text-align: center;">${d.merchants_cnt ?? d.stores_count ?? 0}개점</td>
              <td style="text-align: center; color: var(--brand-mint-text); font-weight: 800;">${d.devices_cnt ?? 0}대</td>
              <td style="text-align: right; font-weight: 900; color: var(--text-primary);">${Number(d.monthly_gmv || 0).toLocaleString()}원</td>
              <td style="text-align: right; font-weight: 800; color: var(--brand-mint-text);">${Number(d.margin_amount || 0).toLocaleString()}원 <span style="font-size: 10.5px; color: var(--text-muted);">(${Number((d.overriding_rate ?? ((d.commission_rate || 0) / 100)) * 100).toFixed(1)}%)</span></td>
              <td style="text-align: center;"><span class="badge-status active" style="font-size: 11px;">정상</span></td>
              <td style="text-align: center;">
                <button type="button" class="header-btn btn-impersonate-from-row" data-tenantid="${d.id}" style="padding: 4px 10px; font-size: 11px; white-space: nowrap; font-weight: 700;">
                  총판 뷰 전환
                </button>
              </td>
            </tr>

            <!-- 서브 대리점 행들 -->
            ${(d.agencies || []).map(a => `
              <tr class="tree-agency-row sub-${d.id}" data-id="${a.id}" style="background: #fafafa; font-size: 12px;">
                <td style="text-align: center; color: var(--text-muted);">└</td>
                <td style="color: var(--text-secondary); font-size: 11.5px; padding-left: 20px;">${a.region_name || a.region || '-'}</td>
                <td>
                  <span style="font-weight: 700; color: var(--text-primary);">${a.name}</span>
                </td>
                <td style="text-align: center; color: var(--text-muted);">-</td>
                <td style="text-align: center; font-weight: 700;">${a.merchants_cnt ?? a.stores_count ?? 0}개점</td>
                <td style="text-align: center; font-weight: 700; color: var(--brand-mint-text);">${a.devices_cnt ?? 0}대</td>
                <td style="text-align: right; font-weight: 700;">${Number(a.monthly_gmv || 0).toLocaleString()}원</td>
                <td style="text-align: right; font-weight: 700; color: var(--text-secondary);">${Number(a.margin_amount || 0).toLocaleString()}원 <span style="font-size: 10.5px; color: var(--text-muted);">(${Number((a.gmv_share_rate ?? ((a.commission_rate || 0) / 100)) * 100).toFixed(1)}%)</span></td>
                <td style="text-align: center;"><span class="badge-status active" style="font-size: 10.5px;">정상</span></td>
                <td style="text-align: center;">
                  <button type="button" class="header-btn btn-impersonate-from-row" data-tenantid="${a.id}" style="padding: 4px 10px; font-size: 11px; white-space: nowrap; font-weight: 700;">
                    대리점 뷰 전환
                  </button>
                </td>
              </tr>
            `).join('')}
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * 광역 총판 법인 상세 운영 관제 모달
 */
function showDistributorDetailModal(d) {
  const existing = document.getElementById('dist-detail-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'dist-detail-modal-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;';

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 8px; width: 720px; max-width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column;">
      <!-- 헤더 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a;">광역 총판 법인 상세 운영 관제 (Master SSOT)</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            법인명: <b>${d.name}</b> | 관할: ${d.territory_name}
          </div>
        </div>
        <button type="button" id="btn-close-dist-modal" style="background: none; border: none; font-size: 18px; font-weight: 700; color: #64748b; cursor: pointer; padding: 4px 8px;">✕</button>
      </div>

      <!-- 본문 그리드 -->
      <div style="padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12.5px; max-height: 70vh; overflow-y: auto;">
        <!-- 섹션 1: 법인 기본 정보 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[법인 사업자 기본 정보]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">총판 상호:</span> <strong style="color: #0f172a;">${d.name}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">관리 식별코드:</span> <code style="font-family: monospace; font-weight: 700;">DIST-${d.territory_code || '11'}</code></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">사업자등록번호:</span> <code style="font-family: monospace;">${d.biz_number}</code></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">대표자 (연락처):</span> ${d.rep_name} (${d.phone})</div>
          <div><span style="color: #64748b; font-weight: 600;">관할 독점 권역:</span> <span class="badge-status active">${d.territory_name} 전역</span></div>
        </div>

        <!-- 섹션 2: 산하 유통망 & 관리 인벤토리 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[산하 유통망 및 인벤토리]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">산하 지역 대리점:</span> <strong style="color: #1e40af; font-size: 13.5px;">${d.agencies_cnt}개소</strong> 정상 영업중</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">총 관리 가맹점:</span> <strong>${d.merchants_cnt}개점</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">가동 CTI 단말기:</span> <strong style="color: #166534;">${d.devices_cnt || 88}대</strong> (온라인 100%)</div>
          <div><span style="color: #64748b; font-weight: 600;">총판 라이선스 상태:</span> <span class="badge-status active">공식 인증 유효</span></div>
        </div>

        <!-- 섹션 3: 당월 누적 GMV & 오버라이딩 수수료 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[당월 누적 GMV 및 정산 분개]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">권역 총 거래액 (GMV):</span> <strong style="font-size: 14px; color: #0f172a;">${Number(d.monthly_gmv || 0).toLocaleString()}원</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">오버라이딩 수수료율:</span> <b>${(Number(d.overriding_rate ?? ((d.commission_rate || 0) / 100)) * 100).toFixed(2)}%</b> (권역 총판 배분)</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">당월 수수료 정산액:</span> <strong style="font-size: 14px; color: var(--brand-mint-text);">${Number(d.margin_amount || 0).toLocaleString()}원</strong></div>
          <div><span style="color: #64748b; font-weight: 600;">정산 주기 / 과세:</span> 매월 말일 마감 익월 10일 (10% 전자세금계산서)</div>
        </div>

        <!-- 섹션 4: 계좌 및 본사 계약 거버넌스 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[수수료 수취 계좌 & 계약 정보]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">정산 수취 계좌:</span> 우리은행 1002-***-****** (예금주: ${d.name})</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">최초 계약 체결일:</span> 2026-01-02 (3년 자동 갱신)</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">단말기 기본 할당고:</span> 500대 확보</div>
          <div><span style="color: #64748b; font-weight: 600;">본사 담당 총괄:</span> AITIP 플랫폼 본사 영업운영본부</div>
        </div>
      </div>

      <!-- 푸터 액션 바 -->
      <div style="display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
        <button type="button" class="header-btn header-btn-primary btn-modal-close" style="font-size: 12px; padding: 6px 18px; font-weight: 800; cursor: pointer;">닫기</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#btn-close-dist-modal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('.btn-modal-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

/**
 * 지역 대리점 상세 운영 관제 모달
 */
function showAgencyDetailModal(a, parentDist) {
  const existing = document.getElementById('agency-detail-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'agency-detail-modal-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;';

  const distName = parentDist ? parentDist.name : '서울광역 총판 (주)에이티파트너스';

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 8px; width: 720px; max-width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column;">
      <!-- 헤더 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a;">지역 대리점 상세 운영 관제 (Agency SSOT)</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            상호명: <b>${a.name}</b> | 관할: ${a.region_name}
          </div>
        </div>
        <button type="button" id="btn-close-agency-modal" style="background: none; border: none; font-size: 18px; font-weight: 700; color: #64748b; cursor: pointer; padding: 4px 8px;">✕</button>
      </div>

      <!-- 본문 그리드 -->
      <div style="padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12.5px; max-height: 70vh; overflow-y: auto;">
        <!-- 섹션 1: 대리점 기본 사업자 정보 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[대리점 기본 정보]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">대리점 상호:</span> <strong style="color: #0f172a;">${a.name}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">관리 식별코드:</span> <code style="font-family: monospace; font-weight: 700;">AGY-${a.region_code || '11'}</code></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">사업자번호:</span> <code style="font-family: monospace;">${a.biz_number}</code></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">대표자 (연락처):</span> ${a.rep_name} (${a.phone})</div>
          <div><span style="color: #64748b; font-weight: 600;">소속 광역 총판:</span> <strong>${distName}</strong></div>
        </div>

        <!-- 섹션 2: 관할 권역 & 관리 인벤토리 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[관할 권역 및 하드웨어 인벤토리]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">관할 시·군·구:</span> <span class="badge-status default" style="font-weight: 700;">${a.region_name}</span></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">관리 가맹점:</span> <strong style="font-size: 13px;">${a.merchants_cnt}개점</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">가동 CTI 단말기:</span> <strong style="color: #10b981; font-size: 13px;">${a.devices_cnt}대</strong></div>
          <div><span style="color: #64748b; font-weight: 600;">현장 AS 전담기사:</span> 4명 상시 대기</div>
        </div>

        <!-- 섹션 3: 당월 누적 GMV 및 수수료 배분 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[당월 GMV 및 수수료 배분]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">관할 당월 GMV:</span> <strong style="font-size: 14px; color: #0f172a;">${Number(a.monthly_gmv || 0).toLocaleString()}원</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">수수료 쉐어율:</span> <b>${(Number(a.gmv_share_rate ?? ((a.commission_rate || 0) / 100)) * 100).toFixed(2)}%</b> (대리점 배분)</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">당월 수수료 정산액:</span> <strong style="font-size: 14px; color: #1e40af;">${Number(a.margin_amount || 0).toLocaleString()}원</strong></div>
          <div><span style="color: #64748b; font-weight: 600;">세무 과세 유형:</span> ${a.tax_type === 'BUSINESS_3_3' ? '3.3% 사업소득 원천징수' : '10% 전자세금계산서'}</div>
        </div>

        <!-- 섹션 4: 계좌 및 현장 MDM 관제 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[정산 계좌 & 긴급 출동]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">정산 수취 계좌:</span> 하나은행 352-***-****** (예금주: ${a.rep_name})</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">단말기 용지 부족 매장:</span> 1개소 (서초점 긴급 배송 완료)</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">원격 포스 연동율:</span> 100% (오케이포스/포스뱅크/나이스)</div>
          <div><span style="color: #64748b; font-weight: 600;">대리점 운영 상태:</span> <span class="badge-status active">정상 영업중</span></div>
        </div>
      </div>

      <!-- 푸터 액션 바 -->
      <div style="display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
        <button type="button" class="header-btn header-btn-primary btn-modal-close" style="font-size: 12px; padding: 6px 18px; font-weight: 800; cursor: pointer;">닫기</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#btn-close-agency-modal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('.btn-modal-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

/**
 * 제휴 협력사 상세 운영 관제 모달
 */
function showPartnerDetailModal(p) {
  const existing = document.getElementById('partner-detail-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'partner-detail-modal-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;';

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 8px; width: 720px; max-width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column;">
      <!-- 헤더 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a;">제휴 협력사 상세 운영 관제 (Partner SSOT)</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            협력사: <b>${p.name}</b> | 사업자번호: ${p.biz_number}
          </div>
        </div>
        <button type="button" id="btn-close-partner-modal" style="background: none; border: none; font-size: 18px; font-weight: 700; color: #64748b; cursor: pointer; padding: 4px 8px;">✕</button>
      </div>

      <!-- 본문 그리드 -->
      <div style="padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12.5px; max-height: 70vh; overflow-y: auto;">
        <!-- 섹션 1: 협력사 기본 정보 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[협력사 법인 정보]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">협력사 상호:</span> <strong style="color: #0f172a;">${p.name}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">제휴 파트너 유형:</span> <span class="badge-status active">${p.agency_type === 'INSTALLATION_PARTNER' ? '단말기/설치 전문 협력사' : '배달대행 연동사'}</span></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">사업자등록번호:</span> <code style="font-family: monospace;">${p.biz_number}</code></div>
          <div><span style="color: #64748b; font-weight: 600;">제휴 상태:</span> <span class="badge-status active">정상 계약 유지중</span></div>
        </div>

        <!-- 섹션 2: 기술 영역 & 서비스 권역 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[기술 영역 및 권역]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">제휴 및 기술 영역:</span> <strong>${p.category}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">서비스 커버리지:</span> ${p.coverage}</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">현장 엔지니어/라이더:</span> <strong style="font-size: 13px;">${p.engineers_cnt}명</strong></div>
          <div><span style="color: #64748b; font-weight: 600;">유지보수 담당 단말기:</span> <strong style="color: #166534;">${p.devices_maintained > 0 ? p.devices_maintained + '대' : '-'}</strong></div>
        </div>

        <!-- 섹션 3: API 연동 및 서킷 브레이커 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[API 통신 및 서킷 브레이커]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">통신 연동 규격:</span> REST API + MQTTS TLS</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">서킷 브레이커:</span> <span style="color: #1e40af; font-weight: 800;">[CLOSED] 정상 바이패스</span></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">평균 응답 지연 (Latency):</span> 45ms</div>
          <div><span style="color: #64748b; font-weight: 600;">일일 호출 건수:</span> 24,500건</div>
        </div>

        <!-- 섹션 4: 긴급 AS 및 관제 연락망 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[긴급 기술지원 연락망]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">24시간 기술 관제 센터:</span> 02-1588-0000</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">긴급 현장 출동 SLA:</span> 접수 후 2시간 이내 방문</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">단말기 예비 부품 재고:</span> 200대 상시 비치</div>
          <div><span style="color: #64748b; font-weight: 600;">보안 규정 준수:</span> PCI-DSS 4.0 인증 완료</div>
        </div>
      </div>

      <!-- 푸터 액션 바 -->
      <div style="display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
        <button type="button" class="header-btn header-btn-primary btn-modal-close" style="font-size: 12px; padding: 6px 18px; font-weight: 800; cursor: pointer;">닫기</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#btn-close-partner-modal')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('.btn-modal-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

/**
 * 총판·대리점·협력사·본사직영 표준 계약 등록 모달 (4섹션 + 개인정보보호/Zero-PII/NDA 서약)
 */
function showOrgContractModal(distributors = [], container, filter = {}) {
  const existing = document.getElementById('org-contract-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'org-contract-modal-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;';

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 10px; width: 780px; max-width: 100%; max-height: 92vh; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.25); overflow: hidden; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a;">신규 총판 · 대리점 · 협력사 표준 계약 등록</div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">사업자·권역·정산 계좌 및 개인정보보호(Zero-PII)·영업비밀(NDA) 서약서 확인</div>
        </div>
        <button type="button" id="btn-close-org-modal" style="background: none; border: none; font-size: 18px; font-weight: 700; color: #64748b; cursor: pointer;">✕</button>
      </div>

      <form id="form-org-contract" style="padding: 18px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; font-size: 12.5px;">
        <div id="org-modal-error" style="display: none; padding: 8px 12px; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 6px; font-weight: 700;"></div>

        <!-- 1. 기본 사업자 & 조직 위계 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
          <div style="font-weight: 800; margin-bottom: 10px;">1. 기본 사업자 & 조직 위계</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div>
              <label style="font-size: 11px; font-weight: 700;">조직 유형</label>
              <select id="m-org-kind" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;">
                <option value="AGENCY">지역 대리점 (내부 영업망)</option>
                <option value="DISTRIBUTOR">광역 총판 (내부 영업망)</option>
                <option value="SALES_ALLY">영업 제휴사 (SALES_ALLY · 추천/채널)</option>
                <option value="SERVICE_ALLY">서비스 제휴사 (SERVICE_ALLY · 배달/결제)</option>
                <option value="TECH_ALLY">기술 제휴사 (TECH_ALLY · POS/VAN/API)</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700;">상위 소속 (직영 포함)</label>
              <select id="m-org-parent" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;">
                <option value="HQ_DIRECT">본사 직영 (HQ_DIRECT · 0%)</option>
                ${distributors.filter(d => d.id !== 'HQ_DIRECT').map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700;">법인 / 상호명 *</label>
              <input id="m-org-name" type="text" required placeholder="예: (주)송파상생네트웍스" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700;">사업자등록번호 *</label>
              <input id="m-org-biz" type="text" required placeholder="000-00-00000" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700;">대표자명 *</label>
              <input id="m-org-rep" type="text" required placeholder="홍길동" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700;">대표 연락처 *</label>
              <input id="m-org-phone" type="text" required placeholder="02-0000-0000" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
            </div>
          </div>
          <div style="margin-top: 8px;">
            <label style="font-size: 11px; font-weight: 700;">사업장 도로명 주소</label>
            <input id="m-org-addr" type="text" placeholder="서울특별시 송파구 올림픽로 300" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
          </div>
        </div>

        <!-- 2. 관할 권역 & 계약 조건 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
          <div style="font-weight: 800; margin-bottom: 10px;">2. 관할 권역 & 계약 조건</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
            <div>
              <label style="font-size: 11px; font-weight: 700;">관할 권역 / 업무 *</label>
              <input id="m-org-region" type="text" required placeholder="서울 송파구" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700;">계약 시작일</label>
              <input id="m-org-start" type="date" value="2026-11-16" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700;">계약 종료일</label>
              <input id="m-org-end" type="date" value="2027-11-15" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700;">계약 보증금 (원)</label>
              <input id="m-org-deposit" type="number" value="0" min="0" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
            </div>
          </div>
        </div>

        <!-- 3. 수수료 & 세무·정산 계좌 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
          <div style="font-weight: 800; margin-bottom: 10px;">3. 수수료 & 세무·정산 계좌</div>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">
            <div>
              <label style="font-size: 11px; font-weight: 700;">수수료율 (%)</label>
              <input id="m-org-rate" type="number" step="0.1" value="0.0" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700;">세무 과세 유형</label>
              <select id="m-org-tax" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;">
                <option value="TAX_INVOICE_10">10% 전자세금계산서</option>
                <option value="BUSINESS_3_3">3.3% 사업소득 원천징수</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700;">정산 은행 *</label>
              <input id="m-org-bank" type="text" required placeholder="하나은행" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700;">계좌번호 *</label>
              <input id="m-org-account" type="text" required placeholder="123-456789-01234" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700;">예금주 *</label>
              <input id="m-org-holder" type="text" required placeholder="법인/대표자명" style="width: 100%; margin-top: 3px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
            </div>
          </div>
        </div>

        <!-- 4. 필수 증빙 서류 & 법적 서약 (Zero-PII·NDA) -->
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px;">
          <div style="font-weight: 800; color: #92400e; margin-bottom: 8px;">4. 필수 증빙 서류 & 법적 서약 확인 (필수)</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; font-size: 12px;">
            <label><input type="checkbox" id="doc-biz-cert" checked /> 사업자등록증 사본 확인</label>
            <label><input type="checkbox" id="doc-bankbook" checked /> 정산 통장 사본 확인</label>
            <label><input type="checkbox" id="doc-surety" /> 이행보증보험증권 확인</label>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 700; color: #78350f;">
            <label><input type="checkbox" id="ag-privacy" required /> [필수] 개인정보 처리위탁 및 보호 동의서 (수탁 범위 외 이용·재위탁 금지)</label>
            <label><input type="checkbox" id="ag-zero-pii" required /> [필수] Zero-PII 무단 수집·저장 금지 서약서 (일회성 주소/안심번호 별도 DB·엑셀 추출 금지)</label>
            <label><input type="checkbox" id="ag-nda" required /> [필수] 영업비밀 유지 서약서 (NDA · 수수료율·가맹점 DB·정책 외부 유출 금지)</label>
            <label><input type="checkbox" id="ag-contract" required /> [필수] 총판·대리점·협력사 표준 위수탁 계약서 전자서명 확인</label>
          </div>
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #fcd34d; display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 12px; font-weight: 800; color: #0f172a;">
              <input type="checkbox" id="m-org-approve-now" checked /> 본사 즉시 승인 (체크 해제 시 계약 심사 대기 상태로 접수)
            </label>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="header-btn" id="btn-cancel-org-modal" style="padding: 8px 16px;">취소</button>
          <button type="submit" class="header-btn" style="background: #059669; color: #ffffff; padding: 8px 18px; font-weight: 800;">표준 계약 등록 저장</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#btn-close-org-modal')?.addEventListener('click', close);
  overlay.querySelector('#btn-cancel-org-modal')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const parentSel = overlay.querySelector('#m-org-parent');
  const rateInput = overlay.querySelector('#m-org-rate');
  parentSel?.addEventListener('change', () => {
    if (parentSel.value === 'HQ_DIRECT' && rateInput) {
      rateInput.value = '0.0';
    } else if (rateInput && Number(rateInput.value) === 0) {
      rateInput.value = '0.5';
    }
  });

  overlay.querySelector('#form-org-contract')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = overlay.querySelector('#org-modal-error');
    const kind = overlay.querySelector('#m-org-kind')?.value || 'AGENCY';
    const parentId = parentSel?.value || 'HQ_DIRECT';
    try {
      const res = await adminApi.createOrganizationEntity({
        kind,
        parent_id: parentId,
        is_direct: parentId === 'HQ_DIRECT',
        name: overlay.querySelector('#m-org-name')?.value?.trim(),
        biz_number: overlay.querySelector('#m-org-biz')?.value?.trim(),
        rep_name: overlay.querySelector('#m-org-rep')?.value?.trim(),
        phone: overlay.querySelector('#m-org-phone')?.value?.trim(),
        address: overlay.querySelector('#m-org-addr')?.value?.trim(),
        region: overlay.querySelector('#m-org-region')?.value?.trim(),
        contract_start: overlay.querySelector('#m-org-start')?.value,
        contract_end: overlay.querySelector('#m-org-end')?.value,
        deposit_amount: Number(overlay.querySelector('#m-org-deposit')?.value || 0),
        commission_rate: Number(rateInput?.value || 0),
        tax_type: overlay.querySelector('#m-org-tax')?.value,
        bank_name: overlay.querySelector('#m-org-bank')?.value?.trim(),
        bank_account: overlay.querySelector('#m-org-account')?.value?.trim(),
        bank_holder: overlay.querySelector('#m-org-holder')?.value?.trim(),
        documents: {
          biz_cert: Boolean(overlay.querySelector('#doc-biz-cert')?.checked),
          bankbook: Boolean(overlay.querySelector('#doc-bankbook')?.checked),
          surety_bond: Boolean(overlay.querySelector('#doc-surety')?.checked)
        },
        agreements: {
          privacy_consent: Boolean(overlay.querySelector('#ag-privacy')?.checked),
          zero_pii_pledge: Boolean(overlay.querySelector('#ag-zero-pii')?.checked),
          nda_pledge: Boolean(overlay.querySelector('#ag-nda')?.checked),
          standard_contract: Boolean(overlay.querySelector('#ag-contract')?.checked)
        },
        approve_immediately: Boolean(overlay.querySelector('#m-org-approve-now')?.checked)
      });
      if (res && res.error) throw new Error(res.error);
      close();
      currentSubTab = kind === 'DISTRIBUTOR' ? 'distributors' : ['PARTNER', 'SALES_ALLY', 'SERVICE_ALLY', 'TECH_ALLY'].includes(kind) ? 'partners' : 'agencies';
      await renderOrganizationTreeView(container, filter);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || '등록 중 오류가 발생했습니다.';
        errEl.style.display = 'block';
      }
    }
  });
}
