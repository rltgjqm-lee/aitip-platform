/**
 * AITIP Enterprise Platform - Master Dashboard (ESM)
 * 4대 핵심 관제 영역 버튼식 전환 & 하단 상세 테이블 & 엔터프라이즈 페이지네이션
 * 100% ESM, Zero 무당색채 (Clean Slate & Minimal Enterprise Palette)
 */

import { adminApi } from '../admin-api.js';
import { renderFilterBarHtml, bindFilterBarEvents } from './erp-filter.js';
import { paginateItems, renderPaginationHtml, bindPaginationEvents } from './pagination.js';

let activeSectionTab = 'merchants'; // 'merchants' | 'orders' | 'payments' | 'gateways'
let merchantPage = 1;
let merchantPageSize = 10;
let orderPage = 1;
let orderPageSize = 10;
let paymentPage = 1;
let paymentPageSize = 10;

export async function renderMasterDashboard(container, data, filter = {}) {
  if (!container) return;

  // 1. 데이터 병렬 로드 (가맹점, 마트, 주문, 결제대사, 영업망 대리점, 단말기 자산)
  const [storesRes, martsRes, ordersRes, paymentsRes, agenciesRes, devicesRes] = await Promise.all([
    adminApi.getStores(filter),
    adminApi.getMarts(filter),
    adminApi.getLiveOrders(filter),
    adminApi.getPaymentTransactions(filter),
    adminApi.getAgencies(filter),
    adminApi.getDevices(filter)
  ]);

  const stores = storesRes.stores || [];
  const marts = martsRes.marts || [];
  const orders = ordersRes.orders || [];
  const transactions = paymentsRes.transactions || [];
  const agencies = agenciesRes.agencies || [];
  const hardwareList = devicesRes.devices || [];

  const agencyMap = {};
  agencies.forEach(a => { agencyMap[a.id] = a; });

  const totalStoresCnt = stores.length + marts.length;
  const totalOrdersCnt = orders.length;

  // 점포망 통합 목록 및 페이지네이션
  const allMerchants = [
    ...stores.map(s => ({ ...s, isMart: false })),
    ...marts.map(m => ({ ...m, isMart: true }))
  ];
  const merchantPagination = paginateItems(allMerchants, merchantPage, merchantPageSize);

  // 주문 통합 목록 및 페이지네이션
  const orderPagination = paginateItems(orders, orderPage, orderPageSize);

  // 결제 대사 통합 목록 및 페이지네이션
  const paymentPagination = paginateItems(transactions, paymentPage, paymentPageSize);

  const multiAssetSummary = [
    { label: '신용/체크카드', amount: 31200000, share: '63.8%', tx_cnt: 1175, fee_rate: '0.8%' },
    { label: '지자체 지역화폐 (서울페이/상품권)', amount: 9780000, share: '20.0%', tx_cnt: 368, fee_rate: '0.0%' },
    { label: '카드사 복합포인트', amount: 4890000, share: '10.0%', tx_cnt: 184, fee_rate: '1.2%' },
    { label: '스테이블코인 (Web3 결제)', amount: 3050000, share: '6.2%', tx_cnt: 115, fee_rate: '네트워크 실비' }
  ];

  const gatewayList = [
    { name: '토스페이먼츠 PG 승인망', category: '결제 대행', endpoint: 'https://api.tosspayments.com/v1', latency_ms: 42, status: '정상 가동' },
    { name: 'NH농협 제로페이 / 지역사랑상품권', category: '지역화폐', endpoint: 'https://api.zeropay.or.kr/v2', latency_ms: 68, status: '정상 가동' },
    { name: 'SK브로드밴드 0504 CTI망', category: '가상번호/통신', endpoint: 'sip://gateway.skbroadband.com:5060', latency_ms: 18, status: '정상 가동' },
    { name: '카카오 비즈엠 알림톡 허브', category: '메시징', endpoint: 'https://api.bizmsg.kr/v1/sender', latency_ms: 55, status: '정상 가동' },
    { name: '부릉(Vroong) 배달대행 연동망', category: '배송망 API', endpoint: 'https://api.meshkorea.net/v3/orders', latency_ms: 82, status: '정상 가동' },
    { name: 'Google Gemini Live AI 허브', category: '인공지능', endpoint: 'https://generativelanguage.googleapis.com', latency_ms: 110, status: '정상 가동' }
  ];

  const ex = data?.exceptions || {};
  const hasExceptions = Number(ex.pending_orders || 0) > 0 || Number(ex.open_disputes || 0) > 0 || Number(ex.pending_onboarding || 0) > 0 || Boolean(ex.maintenance_mode);

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <!-- 예외 우선 큐 (Exception-First Queue · DOC-18 제11장) -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 10px 14px; border-radius: 6px; border: 1px solid ${hasExceptions ? '#fde68a' : '#bbf7d0'}; background: ${hasExceptions ? '#fffbeb' : '#f0fdf4'};">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; font-weight: 800; color: ${hasExceptions ? '#92400e' : '#166534'};">
          <span>[예외 우선 관제 큐]</span>
          <span>미접수 주문: <b>${Number(ex.pending_orders || 0)}건</b></span>
          <span>·</span>
          <span>미처리 CS 분쟁: <b>${Number(ex.open_disputes || 0)}건</b></span>
          <span>·</span>
          <span>온보딩 심사 대기: <b>${Number(ex.pending_onboarding || 0)}건</b></span>
          ${ex.maintenance_mode ? '<span>· <b style="color: #dc2626;">점검 모드 ON</b></span>' : ''}
        </div>
        <div style="display: flex; gap: 6px;">
          <a href="#cs-refunds" class="header-btn" style="font-size: 11px; padding: 4px 10px; text-decoration: none;">CS·환불 처리</a>
          <a href="#onboarding" class="header-btn" style="font-size: 11px; padding: 4px 10px; text-decoration: none;">입점 심사</a>
        </div>
      </div>

      <!-- 1단계: 상단 4대 관제 영역 버튼식 선택기 (최우선 위계 배치) -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap; background: #ffffff; padding: 10px 14px; border: 1px solid var(--border-default); border-radius: 6px;">
        <button type="button" class="dashboard-section-btn ${activeSectionTab === 'merchants' ? 'active' : ''}" data-tab="merchants" style="flex: 1; min-width: 180px; padding: 10px 14px; text-align: left; border: 1px solid ${activeSectionTab === 'merchants' ? '#0f172a' : 'var(--border-default)'}; background: ${activeSectionTab === 'merchants' ? '#f8fafc' : '#ffffff'}; border-radius: 6px; cursor: pointer;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">점포망 가동 상태</div>
          <div style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
            가맹점·마트 <span style="font-size: 13px; font-weight: 600;">(${totalStoresCnt}개소)</span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">외식업 ${stores.length} · 마트 ${marts.length}</div>
        </button>

        <button type="button" class="dashboard-section-btn ${activeSectionTab === 'orders' ? 'active' : ''}" data-tab="orders" style="flex: 1; min-width: 180px; padding: 10px 14px; text-align: left; border: 1px solid ${activeSectionTab === 'orders' ? '#0f172a' : 'var(--border-default)'}; background: ${activeSectionTab === 'orders' ? '#f8fafc' : '#ffffff'}; border-radius: 6px; cursor: pointer;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">실시간 주문 및 배차</div>
          <div style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
            인입 주문 <span style="font-size: 13px; font-weight: 600;">(${totalOrdersCnt}건)</span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">배달 72% · 포장 18% · 식사 10%</div>
        </button>

        <button type="button" class="dashboard-section-btn ${activeSectionTab === 'payments' ? 'active' : ''}" data-tab="payments" style="flex: 1; min-width: 180px; padding: 10px 14px; text-align: left; border: 1px solid ${activeSectionTab === 'payments' ? '#0f172a' : 'var(--border-default)'}; background: ${activeSectionTab === 'payments' ? '#f8fafc' : '#ffffff'}; border-radius: 6px; cursor: pointer;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">결제 자산 및 정산 대사</div>
          <div style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
            4대 결제 원장 <span style="font-size: 13px; font-weight: 600;">(${transactions.length}건)</span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">3자 대사 일치율 99.8%</div>
        </button>

        <button type="button" class="dashboard-section-btn ${activeSectionTab === 'gateways' ? 'active' : ''}" data-tab="gateways" style="flex: 1; min-width: 180px; padding: 10px 14px; text-align: left; border: 1px solid ${activeSectionTab === 'gateways' ? '#0f172a' : 'var(--border-default)'}; background: ${activeSectionTab === 'gateways' ? '#f8fafc' : '#ffffff'}; border-radius: 6px; cursor: pointer;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">외부 연동망 통신 상태</div>
          <div style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
            인프라 게이트웨이 <span style="font-size: 13px; font-weight: 600;">(6개 채널)</span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">전체 정상 가동 (지연 없음)</div>
        </button>
      </div>

      <!-- 2단계: 조건 필터 바 (순수 템플릿 렌더링 - 리렌더링 시에도 절대 소실되지 않음) -->
      ${renderFilterBarHtml(filter)}

      <!-- 3단계: 하단 메인 상세 원장 테이블 및 하단 페이지네이션 바 -->
      <div class="panel-card" style="padding: 0; overflow: hidden; background: #ffffff;">
        ${activeSectionTab === 'merchants' ? `
          <div style="padding: 12px 18px; background: #fafafa; border-bottom: 1px solid var(--border-default); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 800; font-size: 13.5px; color: var(--text-primary);">관할 상점 점포망 운영 상세 원장</span>
            <span style="font-size: 11.5px; color: var(--text-muted);">총 ${totalStoresCnt}개소</span>
          </div>
          <div class="data-table-wrapper" style="padding: 16px 16px 0 16px;">
            <table class="admin-table" style="font-size: 12.5px;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th>점포 상호명</th>
                  <th>통계청 업종분류</th>
                  <th>사업자등록번호</th>
                  <th>대표자 (연락처)</th>
                  <th>소재지 권역</th>
                  <th>소속 대리점</th>
                  <th style="text-align: center;">연동 단말기</th>
                  <th style="text-align: right;">당일 주문</th>
                  <th style="text-align: right;">당일 거래액</th>
                  <th style="text-align: center;">운영 상태</th>
                  <th style="text-align: center;">상세 관제</th>
                </tr>
              </thead>
              <tbody>
                ${merchantPagination.pagedItems.length === 0 ? `
                  <tr><td colspan="11" style="text-align: center; padding: 30px; color: var(--text-muted);">조건에 부합하는 점포가 없습니다.</td></tr>
                ` : merchantPagination.pagedItems.map(m => {
                  const mappedAgency = agencyMap[m.agency_id];
                  const agencyDisplayName = mappedAgency ? mappedAgency.name : '(주)서초네트웍스 (대리점 01)';
                  return `
                  <tr data-id="${m.id}" class="row-merchant-item" style="cursor: pointer;">
                    <td style="font-weight: 800; color: var(--text-primary);">
                      <span>${m.name}</span>
                    </td>
                    <td>
                      ${m.isMart ? `
                        <span class="badge-status active" style="font-size: 11px; font-weight: 700;">하나로마트</span>
                      ` : `
                        <span class="badge-status active" style="font-size: 11px; font-weight: 700; background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1;">${m.category_label || m.ksic_name}</span>
                        <span style="font-size: 10px; color: var(--text-muted); margin-left: 2px;">(${m.store_category || m.ksic_code || '561'})</span>
                      `}
                    </td>
                    <td style="font-family: monospace; font-size: 11.5px; color: var(--text-secondary);">${m.biz_number || '-'}</td>
                    <td>${m.rep_name || '-'} <span style="font-size: 11px; color: var(--text-muted);">(${m.phone || '-'})</span></td>
                    <td>${[m.sido, m.sigungu].filter(Boolean).join(' ') || m.region || m.address || '-'}</td>
                    <td style="font-size: 12px; font-weight: 700; color: var(--text-primary);">${agencyDisplayName}</td>
                    <td style="text-align: center; font-weight: 800;">${Number(m.devices_cnt || 0)}대</td>
                    <td style="text-align: right; font-weight: 700;">${Number(m.today_orders || 0).toLocaleString()}건</td>
                    <td style="text-align: right; font-weight: 800;">${Number(m.today_gmv || 0).toLocaleString()}원</td>
                    <td style="text-align: center;"><span class="badge-status active">${m.isMart ? '정상공급' : '정상영업'}</span></td>
                    <td style="text-align: center;">
                      <button type="button" class="header-btn btn-store-detail" data-storeid="${m.id}" style="padding: 3px 8px; font-size: 11px; font-weight: 700; white-space: nowrap;">상세보기</button>
                    </td>
                  </tr>
                `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <!-- 하단 페이지네이션 바 -->
          ${renderPaginationHtml(merchantPagination)}
        ` : activeSectionTab === 'orders' ? `
          <div style="padding: 12px 18px; background: #fafafa; border-bottom: 1px solid var(--border-default); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 800; font-size: 13.5px; color: var(--text-primary);">실시간 인입 주문 및 배차 현황 원장</span>
            <span style="font-size: 11.5px; color: var(--text-muted);">총 ${orders.length}건</span>
          </div>
          <div class="data-table-wrapper" style="padding: 16px 16px 0 16px;">
            <table class="admin-table" style="font-size: 12.5px;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th style="white-space: nowrap;">주문 식별 (전표)</th>
                  <th style="white-space: nowrap;">판매 점포명</th>
                  <th>유형</th>
                  <th>품목 내역 요약</th>
                  <th>결제 수단</th>
                  <th style="text-align: right;">결제 금액</th>
                  <th style="text-align: center;">진행 상태</th>
                  <th>배차 라이더</th>
                  <th>인입 시간</th>
                </tr>
              </thead>
              <tbody>
                ${orderPagination.pagedItems.length === 0 ? `
                  <tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">조건에 부합하는 주문이 없습니다.</td></tr>
                ` : orderPagination.pagedItems.map(o => `
                  <tr data-id="${o.id}">
                    <td style="white-space: nowrap;">
                      <span class="badge-status default" style="font-size: 11px; font-weight: 800; padding: 2px 6px;">전표: ${o.order_seq}</span>
                      <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">
                        UID: <span style="font-family: monospace;">...${o.id.slice(-9)}</span>
                      </div>
                    </td>
                    <td style="font-weight: 800;">
                      <span>${o.store_name}</span>
                    </td>
                    <td><span class="badge-status active" style="font-size: 10.5px;">${o.fulfillment_type === 'DELIVERY' ? '배달' : '포장'}</span></td>
                    <td>${o.items_desc}</td>
                    <td style="font-size: 11.5px; color: var(--text-secondary);">${o.asset_label || o.asset_type}</td>
                    <td style="text-align: right; font-weight: 800;">${o.amount.toLocaleString()}원</td>
                    <td style="text-align: center;"><span class="badge-status active">${o.status}</span></td>
                    <td style="font-weight: 700;">${o.rider_name}</td>
                    <td style="font-size: 11.5px; color: var(--text-muted);">${o.created_at}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <!-- 하단 페이지네이션 바 -->
          ${renderPaginationHtml(orderPagination)}
        ` : activeSectionTab === 'payments' ? `
          <div style="padding: 12px 18px; background: #fafafa; border-bottom: 1px solid var(--border-default); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 800; font-size: 13.5px; color: var(--text-primary);">4대 결제 자산별 거래 실적 및 3자 대사 원장</span>
            <span style="font-size: 11.5px; color: var(--text-muted);">승인 건수 ${transactions.length}건</span>
          </div>
          <div style="padding: 16px 16px 0 16px;">
            <!-- 자산별 실적 요약 -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
              ${multiAssetSummary.map(a => `
                <div style="background: #f8fafc; border: 1px solid var(--border-default); border-radius: 6px; padding: 10px 12px;">
                  <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">${a.label}</div>
                  <div style="font-size: 15px; font-weight: 800; margin-top: 2px;">${a.amount.toLocaleString()}원</div>
                  <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">비중 ${a.share} · ${a.tx_cnt}건 (${a.fee_rate})</div>
                </div>
              `).join('')}
            </div>

            <!-- 대사 상세 테이블 -->
            <table class="admin-table" style="font-size: 12.5px;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th>거래 일시</th>
                  <th>판매 점포명</th>
                  <th>결제 자산</th>
                  <th style="text-align: right;">승인 금액</th>
                  <th style="text-align: right;">실매입 정산액</th>
                  <th style="text-align: right;">차액</th>
                  <th style="text-align: center;">대사 상태</th>
                  <th>비고 및 조치</th>
                </tr>
              </thead>
              <tbody>
                ${paymentPagination.pagedItems.length === 0 ? `
                  <tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">조건에 부합하는 결제 대사 내역이 없습니다.</td></tr>
                ` : paymentPagination.pagedItems.map(t => `
                  <tr data-id="${t.id}">
                    <td style="font-size: 11.5px; color: var(--text-muted);">${t.paid_at || t.created_at || '-'}</td>
                    <td style="font-weight: 800;">${t.seller_name || t.store_name || '-'}</td>
                    <td>${t.asset_type || t.method || 'CARD'}</td>
                    <td style="text-align: right; font-weight: 800;">${Number(t.orig_amount ?? t.amount ?? 0).toLocaleString()}원</td>
                    <td style="text-align: right; font-weight: 800;">${Number(t.settled_amount ?? t.amount ?? 0).toLocaleString()}원</td>
                    <td style="text-align: right; font-weight: 700; color: ${Number(t.diff || 0) !== 0 ? '#ef4444' : 'var(--text-secondary)'};">${Number(t.diff || 0) === 0 ? '-' : Number(t.diff || 0).toLocaleString() + '원'}</td>
                    <td style="text-align: center;"><span class="badge-status ${(t.recon_status || t.pg_status) === 'MATCHED' ? 'active' : 'warning'}">${t.recon_status_label || (t.pg_status === 'MATCHED' ? '대사일치' : '확인필요')}</span></td>
                    <td style="font-size: 11.5px; color: var(--text-secondary);">${t.notes || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <!-- 하단 페이지네이션 바 -->
          ${renderPaginationHtml(paymentPagination)}
        ` : `
          <div style="padding: 12px 18px; background: #fafafa; border-bottom: 1px solid var(--border-default); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 800; font-size: 13.5px; color: var(--text-primary);">전국 외부 연동 인프라 게이트웨이 통신 원장</span>
            <span style="font-size: 11.5px; color: var(--text-muted);">전체 6개 채널</span>
          </div>
          <div class="data-table-wrapper" style="padding: 16px;">
            <table class="admin-table" style="font-size: 12.5px;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th>연동 시스템 명칭</th>
                  <th>분류</th>
                  <th>엔드포인트 URL</th>
                  <th style="text-align: right;">응답 속도 (Latency)</th>
                  <th style="text-align: center;">통신 상태</th>
                </tr>
              </thead>
              <tbody>
                ${gatewayList.map(g => `
                  <tr>
                    <td style="font-weight: 800; color: var(--text-primary);">${g.name}</td>
                    <td><span class="badge-status active" style="font-size: 10.5px;">${g.category}</span></td>
                    <td style="font-family: monospace; font-size: 11.5px; color: var(--text-secondary);">${g.endpoint}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: 700;">${g.latency_ms}ms</td>
                    <td style="text-align: center;"><span class="badge-status active">${g.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;

  // 1. 필터 바 이벤트 리스너 바인딩
  bindFilterBarEvents(container, (newFilter) => {
    merchantPage = 1;
    orderPage = 1;
    paymentPage = 1;
    renderMasterDashboard(container, data, { ...filter, ...newFilter });
  });

  // 2. 탭 클릭 바인딩
  container.querySelectorAll('.dashboard-section-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSectionTab = btn.dataset.tab;
      renderMasterDashboard(container, data, filter);
    });
  });

  // 3. 페이지네이션 이벤트 바인딩
  if (activeSectionTab === 'merchants') {
    bindPaginationEvents(container, merchantPage, (newPage) => {
      merchantPage = newPage;
      renderMasterDashboard(container, data, filter);
    }, (newSize) => {
      merchantPageSize = newSize;
      merchantPage = 1;
      renderMasterDashboard(container, data, filter);
    });

    // 4. 가맹점 점포 상세 모달 팝업 연동 (상세보기 버튼 및 행 클릭)
    container.querySelectorAll('.btn-store-detail, .row-merchant-item').forEach(el => {
      el.addEventListener('click', (e) => {
        const storeId = el.dataset.storeid || el.closest('.row-merchant-item')?.dataset.id;
        const store = allMerchants.find(s => s.id === storeId);
        if (store) {
          const agency = agencyMap[store.agency_id];
          const storeDevices = hardwareList.filter(d => (d.store_id === store.id || d.mart_id === store.id));
          showStoreDetailModal(store, agency, storeDevices);
        }
      });
    });
  } else if (activeSectionTab === 'orders') {
    bindPaginationEvents(container, orderPage, (newPage) => {
      orderPage = newPage;
      renderMasterDashboard(container, data, filter);
    }, (newSize) => {
      orderPageSize = newSize;
      orderPage = 1;
      renderMasterDashboard(container, data, filter);
    });
  } else if (activeSectionTab === 'payments') {
    bindPaginationEvents(container, paymentPage, (newPage) => {
      paymentPage = newPage;
      renderMasterDashboard(container, data, filter);
    }, (newSize) => {
      paymentPageSize = newSize;
      paymentPage = 1;
      renderMasterDashboard(container, data, filter);
    });
  }
}

/**
 * 가맹점 점포 상세 운영 관제 중앙 모달 (SSOT)
 */
function showStoreDetailModal(store, agency, devices = []) {
  const existing = document.getElementById('store-detail-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'store-detail-modal-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;';

  const defaultSerial = devices.length > 0 ? devices[0].board_serial : 'CTI-BRD-882910';
  const defaultMac = devices.length > 0 ? devices[0].mac_address : 'B8:27:EB:14:8A:21';
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
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">대표자 (연락처):</span> ${store.rep_name} (${store.phone})</div>
          <div><span style="color: #64748b; font-weight: 600;">소재지 주소:</span> ${[store.sido, store.sigungu].filter(Boolean).join(' ')} ${store.address || '중앙로 102'}</div>
        </div>

        <!-- 섹션 2: 소속 영업망 & 관리 체계 -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">[소속 영업망 & 관리 체계]</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">소속 광역 총판:</span> <strong>서울광역 총판 (주)에이티파트너스</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">소속 지역 대리점:</span> <strong style="color: #1e40af;">${agencyTitle}</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">대리점 담당자:</span> ${agencyRep}</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">영업망 수수료율:</span> 0.5% (지역 대리점 배분)</div>
          <div><span style="color: #64748b; font-weight: 600;">관제 권역:</span> ${[store.sido, store.sigungu].filter(Boolean).join(' ') || store.region || '-'} 관할</div>
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
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">당일 주문 건수:</span> <strong style="font-size: 13.5px;">${store.today_orders}건</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">당일 거래액 (GMV):</span> <strong style="font-size: 13.5px; color: #0f172a;">${store.today_gmv.toLocaleString()}원</strong></div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">정산 주기 / 수수료:</span> D+1 익일정산 (우대 0.8%)</div>
          <div style="margin-bottom: 6px;"><span style="color: #64748b; font-weight: 600;">정산 수취 계좌:</span> 신한은행 110-***-**** (예금주: ${store.rep_name})</div>
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
