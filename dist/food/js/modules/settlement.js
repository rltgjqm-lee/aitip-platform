/**
 * ============================================================================
 * AITIP Merchant Portal - 정산 관리 및 홈택스 표준 부가세 증빙 모듈 (ESM)
 * 준수 규격: DOC-02, DOC-14 (배민외식업광장 규격 캘린더 / 건별 원장 / 국세청 표준 CSV)
 * ============================================================================
 */
import { merchantApi } from '../api.js';

/**
 * 정산 관리 3단 서브탭 및 기간 필터, 엑셀/CSV 다운로드 바인딩
 */
export function setupSettlementTabs() {
  const tabCal = document.getElementById('tab-settle-cal');
  const tabOrders = document.getElementById('tab-settle-orders');
  const tabTax = document.getElementById('tab-settle-tax');

  const panelCal = document.getElementById('panel-settle-cal');
  const panelOrders = document.getElementById('panel-settle-orders');
  const panelTax = document.getElementById('panel-settle-tax');

  if (tabCal && tabOrders && tabTax && panelCal && panelOrders && panelTax) {
    const tabs = [tabCal, tabOrders, tabTax];
    const panels = [panelCal, panelOrders, panelTax];

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.style.display = 'none');
        tab.classList.add('active');
        panels[i].style.display = 'block';
      });
    });
  }

  // 기간 필터 버튼 이벤트
  const btnToday = document.getElementById('btn-filter-today');
  const btn7Days = document.getElementById('btn-filter-7days');
  const btn30Days = document.getElementById('btn-filter-30days');
  const startDateInp = document.getElementById('settle-start-date');
  const endDateInp = document.getElementById('settle-end-date');

  const setFilterActive = (btn) => {
    [btnToday, btn7Days, btn30Days].forEach(b => b?.classList.remove('active'));
    btn?.classList.add('active');
  };

  if (btnToday) {
    btnToday.addEventListener('click', () => {
      setFilterActive(btnToday);
      if (startDateInp && endDateInp) {
        startDateInp.value = '2026-11-09';
        endDateInp.value = '2026-11-09';
      }
    });
  }

  if (btn7Days) {
    btn7Days.addEventListener('click', () => {
      setFilterActive(btn7Days);
      if (startDateInp && endDateInp) {
        startDateInp.value = '2026-11-02';
        endDateInp.value = '2026-11-09';
      }
    });
  }

  if (btn30Days) {
    btn30Days.addEventListener('click', () => {
      setFilterActive(btn30Days);
      if (startDateInp && endDateInp) {
        startDateInp.value = '2026-10-10';
        endDateInp.value = '2026-11-09';
      }
    });
  }

  // 홈택스 신고자료 엑셀 다운로드 (실물 국세청 표준 CSV 다운로드 트리거)
  const btnExport = document.getElementById('btn-export-settlement-excel');
  if (btnExport && !btnExport.dataset.bound) {
    btnExport.dataset.bound = 'true';
    btnExport.addEventListener('click', () => {
      const csvUrl = merchantApi.getTaxCsvUrl(2026, 11);
      const a = document.createElement('a');
      a.href = csvUrl;
      a.download = 'hometax_vat_report_2026_11.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }
}

/**
 * 2026년 11월 정산 캘린더 동적 렌더링 (D1 실측 데이터 연동)
 * @param {Object} settlementOverview
 */
export function renderSettlementCalendar(settlementOverview) {
  const grid = document.getElementById('settlement-calendar-grid');
  if (!grid) return;

  const headers = Array.from(grid.querySelectorAll('.calendar-header-cell'));
  grid.innerHTML = '';
  headers.forEach(h => grid.appendChild(h));

  const records = settlementOverview?.daily_records || [];
  const recordsMap = new Map();
  for (const r of records) {
    recordsMap.set(r.business_date, r);
  }

  const daysInNov = 30;
  for (let day = 1; day <= daysInNov; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateKey = `2026-11-${dayStr}`;
    const record = recordsMap.get(dateKey);

    const dateObj = new Date(2026, 10, day);
    const dayOfWeek = dateObj.getDay(); // 0:일, 6:토
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;
    const isToday = (day === 9);

    const cell = document.createElement('div');
    cell.className = `calendar-day-cell ${isSunday ? 'sunday' : isSaturday ? 'saturday' : ''} ${isToday ? 'today' : ''}`;

    let payoutHtml = '';
    if (isSunday || isSaturday) {
      payoutHtml = `<span class="calendar-payout-badge holiday">주말(영업일 합산)</span>`;
    } else if (record && record.net_payout > 0) {
      const formattedAmt = record.net_payout.toLocaleString() + '원';
      if (record.payout_status === 'COMPLETED') {
        payoutHtml = `<span class="calendar-payout-badge completed">입금완료 ${formattedAmt}</span>`;
      } else {
        payoutHtml = `<span class="calendar-payout-badge pending">입금예정 ${formattedAmt}</span>`;
      }
    } else {
      payoutHtml = `<span style="font-size: 11px; color: #cbd5e1;">-</span>`;
    }

    cell.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="calendar-day-num">${day}</span>
        ${isToday ? '<span class="tag tag-mint" style="font-size: 10px; padding: 1px 4px;">오늘</span>' : ''}
      </div>
      <div>${payoutHtml}</div>
    `;
    grid.appendChild(cell);
  }
}
