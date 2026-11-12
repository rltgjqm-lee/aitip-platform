/**
 * AITIP 가맹점 운영 포털 - 홀·테이블 예약 관리 모듈 (dinein.js)
 * 역할:
 * 1. 실시간 매장 테이블 배치 현황판 (Table Status Board)
 * 2. 시간대별 홀 예약 타임라인 및 예약 승인/착석/완료 라이프사이클 통제
 * 3. 점포 유형(홀 중심 vs 배달 전문)에 따른 최적화 워크스페이스
 */

import { merchantApi } from '../api.js';
import { generateQrSvg } from '../vendor/barcode-generator.js';

let activeReservationFilter = 'ALL'; // 'ALL' | 'WAITING' | 'CONFIRMED' | 'COMPLETED'

export function renderDineInWorkspace(state) {
  const container = document.getElementById('view-dinein-workspace');
  if (!container) return;

  const tables = state.tables || [];
  const reservations = state.dineInReservations || [];

  // 1. 상단 통계 매트릭스 계산
  const totalTables = tables.length;
  const vacantCount = tables.filter(t => t.status === 'VACANT').length;
  const occupiedCount = tables.filter(t => t.status === 'OCCUPIED').length;
  const reservedCount = tables.filter(t => t.status === 'RESERVED' || t.status === 'WAITING_CONFIRM').length;
  const occupancyRate = totalTables > 0 ? Math.round((occupiedCount / totalTables) * 100) : 0;

  const waitingResCount = reservations.filter(r => r.status === 'WAITING').length;
  const confirmedResCount = reservations.filter(r => r.status === 'CONFIRMED').length;

  container.innerHTML = `
    <div class="workspace-header">
      <div>
        <h2 style="font-size: 20px; font-weight: 800; color: #191f28; margin-bottom: 4px;">실시간 홀·테이블 예약 관리</h2>
        <p style="font-size: 13.5px; color: #4e5968;">매장 테이블 점유 현황을 실시간으로 확인하고, 시간대별 방문 예약 승인 및 고객 착석을 관리합니다.</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary" id="btn-refresh-dinein">새로고침</button>
        <button class="btn btn-outline" id="btn-open-qr-manager" style="font-weight: 700;">매장·테이블 QR 인쇄</button>
        <button class="btn btn-primary" id="btn-open-walkin-modal">현장 방문 손님 등록</button>
      </div>
    </div>

    <!-- 1. 홀 요약 통계 바 -->
    <div class="dinein-metrics-bar">
      <div class="dinein-metric-item">
        <span class="label">총 테이블</span>
        <span class="val">${totalTables}개</span>
      </div>
      <div class="dinein-metric-item">
        <span class="label">빈 테이블 (즉시 착석)</span>
        <span class="val color-vacant">${vacantCount}개</span>
      </div>
      <div class="dinein-metric-item">
        <span class="label">현재 식사 중</span>
        <span class="val color-occupied">${occupiedCount}개</span>
      </div>
      <div class="dinein-metric-item">
        <span class="label">예약 배정</span>
        <span class="val color-reserved">${reservedCount}개</span>
      </div>
      <div class="dinein-metric-item">
        <span class="label">테이블 가동률</span>
        <span class="val">${occupancyRate}%</span>
      </div>
      <div class="dinein-metric-item" style="border-left: 2px solid #e5e8eb; padding-left: 16px;">
        <span class="label">승인 대기 예약</span>
        <span class="val color-waiting">${waitingResCount}건</span>
      </div>
    </div>

    <!-- 2. 메인 2단 분할 레이아웃 (좌: 테이블 맵 / 우: 예약 타임라인 피드) -->
    <div class="dinein-layout-grid">
      
      <!-- 좌측: 실시간 테이블 배치 현황판 -->
      <div class="dinein-left-col">
        <div class="dinein-section-header">
          <div style="font-weight: 800; font-size: 15px; color: #191f28;">매장 테이블 현황판 (Table Map)</div>
          <div style="font-size: 12px; color: #8b95a1;">실시간 점유 및 예약 상태</div>
        </div>

        <div class="table-card-grid" id="table-card-grid">
          ${renderTableCardsHtml(tables)}
        </div>
      </div>

      <!-- 우측: 시간대별 홀 예약 타임라인 피드 -->
      <div class="dinein-right-col">
        <div class="dinein-section-header" style="flex-direction: column; align-items: flex-start; gap: 10px;">
          <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
            <div style="font-weight: 800; font-size: 15px; color: #191f28;">오늘의 홀 방문 예약 (${reservations.length}건)</div>
            ${waitingResCount > 0 ? `<span class="badge-waiting-pill">신규 승인대기 ${waitingResCount}건</span>` : ''}
          </div>

          <!-- 필터 탭 -->
          <div class="dinein-res-tabs">
            <button class="res-tab-btn ${activeReservationFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">전체 (${reservations.length})</button>
            <button class="res-tab-btn ${activeReservationFilter === 'WAITING' ? 'active' : ''}" data-filter="WAITING">승인 대기 (${waitingResCount})</button>
            <button class="res-tab-btn ${activeReservationFilter === 'CONFIRMED' ? 'active' : ''}" data-filter="CONFIRMED">예약 확정 (${confirmedResCount})</button>
            <button class="res-tab-btn ${activeReservationFilter === 'COMPLETED' ? 'active' : ''}" data-filter="COMPLETED">식사 완료</button>
          </div>
        </div>

        <div class="res-card-list" id="res-card-list">
          ${renderReservationCardsHtml(reservations, activeReservationFilter)}
        </div>
      </div>

    </div>
  `;

  bindDineInEvents(state);
}

function renderTableCardsHtml(tables) {
  if (!tables || tables.length === 0) {
    return `<div style="padding: 40px; text-align: center; color: #8b95a1;">등록된 테이블이 없습니다.</div>`;
  }

  return tables.map(tbl => {
    let statusClass = 'status-vacant';
    let statusText = '빈자리';
    let detailHtml = '<div class="table-empty-hint">즉시 손님 착석 가능</div>';
    let actionBtnHtml = `<button class="btn-table-action btn-seat-direct" data-table-id="${tbl.id}" data-table-no="${tbl.table_no}">손님 착석</button>`;

    if (tbl.status === 'OCCUPIED') {
      statusClass = 'status-occupied';
      statusText = '식사 중';
      detailHtml = `
        <div class="table-detail-info">
          <div class="table-guest-line">착석 시간: <strong>${tbl.seated_at || '확인중'}</strong> (${tbl.guest_count || 2}인)</div>
          <div class="table-memo-line">${tbl.memo || '현장 식사 진행 중'}</div>
        </div>
      `;
      actionBtnHtml = `<button class="btn-table-action btn-complete-table" data-table-id="${tbl.id}" data-table-no="${tbl.table_no}">식사 완료 / 퇴장</button>`;
    } else if (tbl.status === 'RESERVED') {
      statusClass = 'status-reserved';
      statusText = '예약 확정';
      detailHtml = `
        <div class="table-detail-info">
          <div class="table-res-time">★ ${tbl.reservation_time} 도착 예정</div>
          <div class="table-guest-line">예약자: <strong>${tbl.reserved_by || '고객'}</strong> (${tbl.guest_count || 4}인)</div>
          <div class="table-memo-line">${tbl.memo || '선주문 조리 대기'}</div>
        </div>
      `;
      actionBtnHtml = `<button class="btn-table-action btn-confirm-seat" data-res-id="${tbl.current_reservation_id || ''}" data-table-no="${tbl.table_no}">손님 도착 (착석)</button>`;
    } else if (tbl.status === 'WAITING_CONFIRM') {
      statusClass = 'status-waiting';
      statusText = '승인 대기';
      detailHtml = `
        <div class="table-detail-info">
          <div class="table-res-time" style="color: #c25e00;">★ ${tbl.reservation_time} 예약 신청</div>
          <div class="table-guest-line">예약자: <strong>${tbl.reserved_by || '고객'}</strong> (${tbl.guest_count || 4}인)</div>
          <div class="table-memo-line">${tbl.memo || '점주 승인 대기 중'}</div>
        </div>
      `;
      actionBtnHtml = `<button class="btn-table-action btn-quick-confirm" data-res-id="${tbl.current_reservation_id || ''}">예약 승인</button>`;
    }

    return `
      <div class="table-box ${statusClass}">
        <div class="table-box-header">
          <div>
            <div class="table-title">${tbl.table_no}</div>
            <div class="table-subinfo">${tbl.section} · ${tbl.capacity}인석</div>
          </div>
          <span class="table-status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="table-box-body">
          ${detailHtml}
        </div>
        <div class="table-box-footer">
          ${actionBtnHtml}
        </div>
      </div>
    `;
  }).join('');
}

function renderReservationCardsHtml(reservations, filter) {
  let filtered = reservations;
  if (filter === 'WAITING') {
    filtered = reservations.filter(r => r.status === 'WAITING');
  } else if (filter === 'CONFIRMED') {
    filtered = reservations.filter(r => r.status === 'CONFIRMED' || r.status === 'SEATED');
  } else if (filter === 'COMPLETED') {
    filtered = reservations.filter(r => r.status === 'COMPLETED');
  }

  if (filtered.length === 0) {
    return `<div style="padding: 40px; text-align: center; color: #8b95a1; background: #ffffff; border-radius: 8px; border: 1px solid #e5e8eb;">해당 상태의 예약 건이 없습니다.</div>`;
  }

  return filtered.map(res => {
    let statusBadge = '';
    let actionButtons = '';

    if (res.status === 'WAITING') {
      statusBadge = '<span class="res-badge res-badge-waiting">승인 대기</span>';
      actionButtons = `
        <button class="btn-action-res btn-res-confirm" data-res-id="${res.id}">예약 승인</button>
        <button class="btn-action-res btn-res-cancel" data-res-id="${res.id}">거절</button>
      `;
    } else if (res.status === 'CONFIRMED') {
      statusBadge = '<span class="res-badge res-badge-confirmed">예약 확정</span>';
      actionButtons = `
        <button class="btn-action-res btn-res-seat" data-res-id="${res.id}" data-table-no="${res.table_no}">고객 도착 (착석)</button>
        <button class="btn-action-res btn-res-cancel" data-res-id="${res.id}">취소</button>
      `;
    } else if (res.status === 'SEATED') {
      statusBadge = '<span class="res-badge res-badge-seated">식사 중</span>';
      actionButtons = `
        <button class="btn-action-res btn-res-complete" data-res-id="${res.id}" data-table-no="${res.table_no}">식사 완료 / 퇴장</button>
      `;
    } else if (res.status === 'COMPLETED') {
      statusBadge = '<span class="res-badge res-badge-completed">이용 완료</span>';
      actionButtons = `<span style="font-size: 12px; color: #8b95a1;">정상 퇴장 완료</span>`;
    } else if (res.status === 'CANCELED') {
      statusBadge = '<span class="res-badge res-badge-canceled">취소됨</span>';
      actionButtons = `<span style="font-size: 12px; color: #e53e3e;">${res.cancel_reason || '취소'}</span>`;
    }

    return `
      <div class="res-item-card">
        <div class="res-item-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="res-seq-tag">${res.display_seq || '예약'}</span>
            <span class="res-time-text">★ ${res.reserved_time}</span>
            <span class="res-table-tag">${res.table_no}</span>
          </div>
          ${statusBadge}
        </div>

        <div class="res-item-body">
          <div class="res-guest-row">
            <span class="guest-name"><strong>${res.customer_name}</strong> 님</span>
            <span class="guest-count">방문 인원: 성인 ${res.guest_count}명</span>
            <span class="guest-phone">${res.customer_phone}</span>
          </div>

          ${res.pre_ordered ? `
            <div class="res-menu-box">
              <div class="menu-label">선주문 메뉴:</div>
              <div class="menu-content">${res.menu_summary}</div>
              <div class="menu-price">${Number(res.total_amount).toLocaleString()}원 (선결제 완료)</div>
            </div>
          ` : `
            <div class="res-menu-box no-preorder">
              <div class="menu-label">메뉴 선택:</div>
              <div class="menu-content">방문 후 현장 주문</div>
            </div>
          `}

          ${res.special_request ? `
            <div class="res-request-box">
              <span class="request-label">고객 요청:</span> ${res.special_request}
            </div>
          ` : ''}
        </div>

        <div class="res-item-footer">
          <div class="res-created-at">신청 시각: ${new Date(res.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
          <div class="res-actions-wrap">
            ${actionButtons}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function bindDineInEvents(state) {
  const container = document.getElementById('view-dinein-workspace');
  if (!container) return;

  // 새로고침 버튼
  const btnRefresh = container.querySelector('#btn-refresh-dinein');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      try {
        const [tables, reservations] = await Promise.all([
          merchantApi.getDineInTables(),
          merchantApi.getDineInReservations()
        ]);
        state.tables = tables;
        state.dineInReservations = reservations;
        renderDineInWorkspace(state);
      } catch (err) {
        alert('홀 정보 동기화 실패: ' + err.message);
      }
    });
  }

  // 필터 탭 클릭
  container.querySelectorAll('.res-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeReservationFilter = btn.getAttribute('data-filter') || 'ALL';
      renderDineInWorkspace(state);
    });
  });

  // 예약 승인 버튼
  container.querySelectorAll('.btn-res-confirm, .btn-quick-confirm').forEach(btn => {
    btn.addEventListener('click', async () => {
      const resId = btn.getAttribute('data-res-id');
      if (!resId) return;
      try {
        const result = await merchantApi.confirmDineInReservation(resId);
        // 로컬 state 갱신
        if (result.tables) state.tables = result.tables;
        const res = state.dineInReservations.find(r => r.id === resId);
        if (res) res.status = 'CONFIRMED';
        renderDineInWorkspace(state);
      } catch (err) {
        alert('예약 승인 처리 실패: ' + err.message);
      }
    });
  });

  // 고객 착석 확인 버튼
  container.querySelectorAll('.btn-res-seat, .btn-confirm-seat').forEach(btn => {
    btn.addEventListener('click', async () => {
      const resId = btn.getAttribute('data-res-id');
      const tableNo = btn.getAttribute('data-table-no');
      try {
        const result = await merchantApi.seatDineInReservation(resId, tableNo);
        if (result.tables) state.tables = result.tables;
        const res = state.dineInReservations.find(r => r.id === resId);
        if (res) res.status = 'SEATED';
        renderDineInWorkspace(state);
      } catch (err) {
        alert('고객 착석 처리 실패: ' + err.message);
      }
    });
  });

  // 식사 완료 및 퇴장 처리 버튼
  container.querySelectorAll('.btn-res-complete, .btn-complete-table').forEach(btn => {
    btn.addEventListener('click', async () => {
      const resId = btn.getAttribute('data-res-id');
      const tableNo = btn.getAttribute('data-table-no');
      if (!confirm(`${tableNo || '해당 테이블'}의 식사를 완료하고 테이블 정리를 완료하시겠습니까?`)) return;
      try {
        const result = await merchantApi.completeDineInReservation(resId || 'res_mock', tableNo);
        if (result.tables) state.tables = result.tables;
        if (resId) {
          const res = state.dineInReservations.find(r => r.id === resId);
          if (res) res.status = 'COMPLETED';
        }
        renderDineInWorkspace(state);
      } catch (err) {
        alert('식사 완료 처리 실패: ' + err.message);
      }
    });
  });

  // 예약 거절/취소 버튼
  container.querySelectorAll('.btn-res-cancel').forEach(btn => {
    btn.addEventListener('click', async () => {
      const resId = btn.getAttribute('data-res-id');
      const reason = prompt('예약 거절 또는 취소 사유를 입력하세요 (예: 피크타임 만석):', '만석으로 인한 예약 불가');
      if (!reason) return;
      try {
        const result = await merchantApi.cancelDineInReservation(resId, reason);
        if (result.tables) state.tables = result.tables;
        const res = state.dineInReservations.find(r => r.id === resId);
        if (res) {
          res.status = 'CANCELED';
          res.cancel_reason = reason;
        }
        renderDineInWorkspace(state);
      } catch (err) {
        alert('예약 취소 실패: ' + err.message);
      }
    });
  });

  // 매장·테이블 QR 인쇄 모달 오픈
  container.querySelector('#btn-open-qr-manager')?.addEventListener('click', () => {
    openQrManagerModal(state);
  });
}

/**
 * 매장 대표 및 테이블별 QR 코드 관리 및 인쇄 모달
 */
function openQrManagerModal(state) {
  let modal = document.getElementById('modal-qr-manager');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-qr-manager';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const host = window.location.host;
  const storeUrl = `http://${host}/food/pwa/`;
  const storeName = state.store?.store_name || '바른치킨 서초본점';
  const tables = state.tables || [];

  // 매장 대표 QR SVG 생성
  const storeQrSvg = generateQrSvg(storeUrl, { cellSize: 6 });

  // 테이블별 QR SVG 생성
  const tableQrs = tables.map(t => {
    const tableNumOnly = t.table_no.replace(/[^0-9]/g, '') || t.id.replace('tbl_', '');
    const tableUrl = `http://${host}/food/pwa/?table=${encodeURIComponent(tableNumOnly)}`;
    return {
      table_no: t.table_no,
      section: t.section,
      capacity: t.capacity,
      url: tableUrl,
      svg: generateQrSvg(tableUrl, { cellSize: 4.5 })
    };
  });

  let activeTab = 'STORE'; // 'STORE' | 'TABLES'

  function renderModalContent() {
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 720px; width: 90%;">
        <div class="modal-header">
          <div class="modal-title">매장·테이블 QR 인쇄 관리자</div>
          <button class="modal-close" id="btn-close-qr-modal">×</button>
        </div>
        <div class="modal-body" style="max-height: 75vh; overflow-y: auto;">
          <!-- 탭 전환 -->
          <div class="qr-modal-tabs">
            <button class="qr-tab-btn ${activeTab === 'STORE' ? 'active' : ''}" data-qr-tab="STORE">
              매장 대표 종합 QR (출입구/카운터/포장용)
            </button>
            <button class="qr-tab-btn ${activeTab === 'TABLES' ? 'active' : ''}" data-qr-tab="TABLES">
              테이블별 착석 주문 QR 스티커 (${tables.length}개)
            </button>
          </div>

          <!-- 탭 1: 매장 대표 QR -->
          ${activeTab === 'STORE' ? `
            <div id="print-area-store">
              <div class="qr-store-stand-card">
                <div style="font-size: 11.5px; font-weight: 800; color: #0f766e; background: #e6f7f6; display: inline-block; padding: 3px 10px; border-radius: 20px; margin-bottom: 8px;">
                  AITIP 비대면 스마트 주문
                </div>
                <h3 style="font-size: 18px; font-weight: 900; color: #1e293b; margin-bottom: 4px;">${storeName}</h3>
                <p style="font-size: 12px; color: #64748b; margin-bottom: 14px;">카메라로 비추면 메뉴판/포장/예약으로 즉시 연결됩니다</p>

                <div style="padding: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; display: inline-block; margin-bottom: 12px;">
                  ${storeQrSvg}
                </div>

                <div style="font-size: 11px; font-family: monospace; color: #475569; word-break: break-all; margin-bottom: 8px;">
                  ${storeUrl}
                </div>
                <div style="font-size: 11px; color: #94a3b8;">
                  [출입구 배너 / 카운터 아크릴 스탠드 / 포장 픽업대 비치용]
                </div>
              </div>
            </div>
            <div style="text-align: center; margin-top: 18px;">
              <button class="btn btn-primary" id="btn-print-store-qr" style="padding: 10px 24px; font-size: 14px; font-weight: 800;">
                매장 대표 QR 스탠드 인쇄하기
              </button>
            </div>
          ` : `
            <!-- 탭 2: 테이블별 QR 스티커 그리드 -->
            <div id="print-area-tables">
              <div class="qr-table-grid-sheet">
                ${tableQrs.map(t => `
                  <div class="qr-table-sticker-card">
                    <div style="font-size: 10.5px; font-weight: 800; color: #7c3aed; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 4px; padding: 2px 6px; display: inline-block; margin-bottom: 4px;">
                      ${t.section} (${t.capacity}인석)
                    </div>
                    <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-bottom: 6px;">
                      ${t.table_no}
                    </div>
                    <div style="padding: 6px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; display: inline-block; margin-bottom: 6px;">
                      ${t.svg}
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: #0f766e; line-height: 1.3;">
                      직원 호출 없이<br>자리에서 바로 주문하세요
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            <div style="text-align: center; margin-top: 18px;">
              <button class="btn btn-primary" id="btn-print-tables-qr" style="padding: 10px 24px; font-size: 14px; font-weight: 800;">
                테이블 라벨지 (${tables.length}구) 일괄 인쇄하기
              </button>
            </div>
          `}
        </div>
      </div>
    `;

    // 탭 클릭
    modal.querySelectorAll('[data-qr-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-qr-tab');
        renderModalContent();
      });
    });

    // 닫기
    modal.querySelector('#btn-close-qr-modal')?.addEventListener('click', () => {
      modal.classList.remove('show');
    });

    // 인쇄 실행
    modal.querySelector('#btn-print-store-qr')?.addEventListener('click', () => {
      triggerPrintArea('print-area-store');
    });
    modal.querySelector('#btn-print-tables-qr')?.addEventListener('click', () => {
      triggerPrintArea('print-area-tables');
    });
  }

  function triggerPrintArea(targetElementId) {
    const targetEl = modal.querySelector(`#${targetElementId}`);
    if (!targetEl) return;

    const printContainer = document.createElement('div');
    printContainer.className = 'printable-qr-area';
    printContainer.innerHTML = targetEl.innerHTML;
    document.body.appendChild(printContainer);

    window.print();

    setTimeout(() => {
      printContainer.remove();
    }, 500);
  }

  renderModalContent();
  modal.classList.add('show');
}
