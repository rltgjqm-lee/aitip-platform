/**
 * ============================================================================
 * AITIP Merchant Portal - 가맹점 매장 정보 및 영업시간/휴무 관리 모듈 (ESM)
 * 준수 규격: DOC-02, DOC-08, D1 SQLite store_hours CHECK 제약조건
 * ============================================================================
 */
import { merchantApi } from '../api.js';

/**
 * 상단 헤더 매장 메타 정보 렌더링
 * @param {Object} store
 */
export function renderStoreMeta(store) {
  if (!store) return;
  const storeNameElem = document.getElementById('header-store-name');
  if (storeNameElem) storeNameElem.textContent = store.store_name;

  const bizMetaElem = document.getElementById('header-biz-meta');
  if (bizMetaElem) {
    bizMetaElem.innerHTML = `사업자번호: ${store.biz_number}<br>대표자: ${store.owner_name}`;
  }
}

/**
 * 매장 정보 입력 폼 초기값 바인딩
 * @param {Object} store
 */
export function renderStoreInfoForm(store) {
  if (!store) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  setVal('form-store-name', store.store_name);
  setVal('form-biz-number', store.biz_number);
  setVal('form-owner-name', store.owner_name);
  setVal('form-phone', store.phone);
  setVal('form-address', store.address);
  setVal('form-hours', store.operating_hours);
  setVal('form-origin-info', store.origin_info || '닭고기: 국내산 신선 냉장육, 쌀: 국내산, 고춧가루: 국내산+중국산, 소금: 국내산 천일염');

  const opType = store.store_operation_type || 'HYBRID';
  if (opType === 'DELIVERY_ONLY') {
    const el = document.getElementById('op-type-delivery');
    if (el) el.checked = true;
  } else if (opType === 'DINE_IN_CENTRIC') {
    const el = document.getElementById('op-type-dinein');
    if (el) el.checked = true;
  } else {
    const el = document.getElementById('op-type-hybrid');
    if (el) el.checked = true;
  }
}

/**
 * 긴급 일시중지 바 제어 (30분 / 60분 / 즉시 재개)
 * @param {Object} state
 * @param {number} minutes
 */
export function startQuickPause(state, minutes) {
  stopQuickPause(state);
  state.pauseSecondsRemaining = minutes * 60;
  const statusElem = document.getElementById('pause-status-text');

  const updateDisplay = () => {
    const mins = Math.floor(state.pauseSecondsRemaining / 60);
    const secs = state.pauseSecondsRemaining % 60;
    if (statusElem) {
      statusElem.textContent = `현재 주문 접수 일시중지 중 (${mins}분 ${secs < 10 ? '0' : ''}${secs}초 남음)`;
      statusElem.style.color = '#e11d48';
      statusElem.style.fontWeight = '700';
    }
    if (state.pauseSecondsRemaining <= 0) {
      stopQuickPause(state);
      alert('일시중지 시간이 종료되어 주문 접수를 자동으로 재개합니다.');
    }
    state.pauseSecondsRemaining--;
  };

  updateDisplay();
  state.pauseTimer = setInterval(updateDisplay, 1000);
}

export function stopQuickPause(state) {
  if (state.pauseTimer) {
    clearInterval(state.pauseTimer);
    state.pauseTimer = null;
  }
  state.pauseSecondsRemaining = 0;
  const statusElem = document.getElementById('pause-status-text');
  if (statusElem) {
    statusElem.textContent = '현재 정상 영업 중 (주문 자동 접수 대기)';
    statusElem.style.color = '#007aff';
    statusElem.style.fontWeight = '600';
  }
}

/**
 * 요일명 조회 (0=일요일, 1=월요일...)
 * @param {number} day
 * @returns {string}
 */
export function getDayName(day) {
  const names = { 0: '일요일', 1: '월요일', 2: '화요일', 3: '수요일', 4: '목요일', 5: '금요일', 6: '토요일' };
  return names[day] || `${day}요일`;
}

/**
 * 7일 요일별 운영시간 테이블 렌더링 (월~일 순서)
 * @param {Array} storeHours
 */
export function renderStoreHoursTable(storeHours) {
  const tbody = document.getElementById('tbody-store-hours');
  if (!tbody) return;

  const defaultHours = [
    { day_of_week: 1, day_name: '월요일', open_time: '15:00', close_time: '24:00', break_start: '', break_end: '', is_closed: 0 },
    { day_of_week: 2, day_name: '화요일', open_time: '15:00', close_time: '24:00', break_start: '', break_end: '', is_closed: 0 },
    { day_of_week: 3, day_name: '수요일', open_time: '15:00', close_time: '24:00', break_start: '', break_end: '', is_closed: 0 },
    { day_of_week: 4, day_name: '목요일', open_time: '15:00', close_time: '24:00', break_start: '', break_end: '', is_closed: 0 },
    { day_of_week: 5, day_name: '금요일', open_time: '15:00', close_time: '24:00', break_start: '', break_end: '', is_closed: 0 },
    { day_of_week: 6, day_name: '토요일', open_time: '12:00', close_time: '24:00', break_start: '', break_end: '', is_closed: 0 },
    { day_of_week: 0, day_name: '일요일', open_time: '12:00', close_time: '24:00', break_start: '', break_end: '', is_closed: 0 }
  ];

  const sourceHours = (storeHours && storeHours.length === 7) ? storeHours : defaultHours;
  const orderMap = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };
  const sorted = [...sourceHours].sort((a, b) => orderMap[a.day_of_week] - orderMap[b.day_of_week]);

  tbody.innerHTML = '';
  sorted.forEach(h => {
    const tr = document.createElement('tr');
    tr.id = `row-day-${h.day_of_week}`;
    const isClosed = h.is_closed === 1;

    tr.innerHTML = `
      <td style="text-align: center; font-weight: 700; color: ${h.day_of_week === 0 ? '#ef4444' : h.day_of_week === 6 ? '#2563eb' : '#191f28'};">
        ${getDayName(h.day_of_week)}
      </td>
      <td style="text-align: center;">
        <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer;">
          <input type="checkbox" class="chk-day-closed" data-day="${h.day_of_week}" ${isClosed ? 'checked' : ''}>
          <span>${isClosed ? '정기휴무' : '영업'}</span>
        </label>
      </td>
      <td>
        <div class="input-unit-group">
          <input type="time" class="form-control input-open" data-day="${h.day_of_week}" value="${h.open_time || '15:00'}" ${isClosed ? 'disabled' : ''} style="width: 110px;">
          <span class="unit-label">~</span>
          <input type="time" class="form-control input-close" data-day="${h.day_of_week}" value="${h.close_time || '24:00'}" ${isClosed ? 'disabled' : ''} style="width: 110px;">
        </div>
      </td>
      <td>
        <div class="input-unit-group">
          <input type="time" class="form-control input-break-start" data-day="${h.day_of_week}" value="${h.break_start || ''}" ${isClosed ? 'disabled' : ''} style="width: 110px;" placeholder="시작">
          <span class="unit-label">~</span>
          <input type="time" class="form-control input-break-end" data-day="${h.day_of_week}" value="${h.break_end || ''}" ${isClosed ? 'disabled' : ''} style="width: 110px;" placeholder="종료">
          <span class="unit-label" style="font-size: 11px; color: #8b95a1;">(선택)</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    const chk = tr.querySelector('.chk-day-closed');
    chk.addEventListener('change', (e) => {
      const closed = e.target.checked;
      tr.querySelectorAll('input[type="time"]').forEach(inp => inp.disabled = closed);
      chk.nextElementSibling.textContent = closed ? '정기휴무' : '영업';
    });
  });
}

/**
 * UI로부터 7일 요일별 운영시간 데이터 수집
 * @returns {Array}
 */
export function collectStoreHours() {
  const isDailyMode = document.getElementById('radio-hours-daily')?.checked ?? true;

  if (isDailyMode) {
    const openTime = document.getElementById('daily-open-time')?.value || '15:00';
    const closeTime = document.getElementById('daily-close-time')?.value || '24:00';
    const hasBreak = document.getElementById('check-daily-break')?.checked || false;
    const breakStart = hasBreak ? (document.getElementById('daily-break-start')?.value || null) : null;
    const breakEnd = hasBreak ? (document.getElementById('daily-break-end')?.value || null) : null;

    const isWeeklyClosed = document.getElementById('radio-closed-weekly')?.checked || false;
    const closedDays = new Set();
    if (isWeeklyClosed) {
      document.querySelectorAll('#regular-closed-day-chips .schedule-day-chip.active').forEach(c => {
        closedDays.add(Number(c.getAttribute('data-day')));
      });
    }

    const result = [];
    for (let day = 0; day <= 6; day++) {
      const isClosed = closedDays.has(day) ? 1 : 0;
      result.push({
        day_of_week: day,
        day_name: getDayName(day),
        open_time: isClosed ? null : openTime,
        close_time: isClosed ? null : closeTime,
        break_start: isClosed ? null : breakStart,
        break_end: isClosed ? null : breakEnd,
        is_closed: isClosed
      });
    }
    return result;
  }

  // 요일별로 달라요 모드: 7개 행 개별 수집
  const result = [];
  for (let day = 0; day <= 6; day++) {
    const tr = document.getElementById(`row-day-${day}`);
    if (!tr) continue;
    const isClosed = tr.querySelector('.chk-day-closed')?.checked ? 1 : 0;
    const openTime = tr.querySelector('.input-open')?.value || '15:00';
    const closeTime = tr.querySelector('.input-close')?.value || '24:00';
    const breakStart = tr.querySelector('.input-break-start')?.value || null;
    const breakEnd = tr.querySelector('.input-break-end')?.value || null;

    result.push({
      day_of_week: day,
      day_name: getDayName(day),
      open_time: isClosed ? null : openTime,
      close_time: isClosed ? null : closeTime,
      break_start: isClosed ? null : (breakStart && breakEnd ? breakStart : null),
      break_end: isClosed ? null : (breakStart && breakEnd ? breakEnd : null),
      is_closed: isClosed
    });
  }
  return result;
}

/**
 * 공휴일 및 임시휴무 UI 렌더링
 * @param {Object} holidaySettings
 */
export function renderHolidaySettings(holidaySettings) {
  const checkHolidayOpen = document.getElementById('check-holiday-open');
  if (checkHolidayOpen && holidaySettings) {
    checkHolidayOpen.checked = !holidaySettings.auto_holiday_closed;
  }
  renderCustomClosuresTable(holidaySettings);
}

/**
 * 개인사정 임시휴무 목록 테이블 렌더링
 * @param {Object} holidaySettings
 */
export function renderCustomClosuresTable(holidaySettings) {
  const tbody = document.getElementById('tbody-custom-closures');
  const boxList = document.getElementById('box-custom-closures-list');
  if (!tbody || !boxList) return;

  const closures = holidaySettings?.custom_closures || [];
  if (closures.length === 0) {
    boxList.style.display = 'none';
    tbody.innerHTML = '';
    return;
  }

  boxList.style.display = 'block';
  tbody.innerHTML = '';
  closures.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.title}</strong></td>
      <td style="color: #4e5968;">${c.start_date} ~ ${c.end_date}</td>
      <td style="color: #64748b;">${c.reason || '안내 문구 없음'}</td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-sm" data-del-closure="${c.id}">삭제</button>
      </td>
    `;
    tbody.appendChild(tr);

    tr.querySelector(`[data-del-closure="${c.id}"]`).addEventListener('click', async () => {
      if (confirm(`'${c.title}' 임시휴무를 삭제하시겠습니까?`)) {
        try {
          await merchantApi.deleteCustomClosure(c.id);
          holidaySettings.custom_closures = holidaySettings.custom_closures.filter(item => item.id !== c.id);
          renderCustomClosuresTable(holidaySettings);
        } catch (err) {
          alert('삭제 실패: ' + err.message);
        }
      }
    });
  });
}

/**
 * 개인사정 임시휴무 신규 등록 처리
 * @param {Object} holidaySettings
 */
export async function handleCreateCustomClosure(holidaySettings) {
  const title = document.getElementById('custom-closure-title')?.value.trim();
  const startDate = document.getElementById('custom-closure-start')?.value;
  const endDate = document.getElementById('custom-closure-end')?.value;
  const reason = document.getElementById('custom-closure-reason')?.value.trim();

  if (!title || !startDate || !endDate) {
    alert('휴무 사유명과 시작일, 종료일을 모두 입력해 주세요.');
    return;
  }
  if (startDate > endDate) {
    alert('시작일은 종료일보다 이전이어야 합니다.');
    return;
  }

  try {
    const res = await merchantApi.addCustomClosure({
      title,
      start_date: startDate,
      end_date: endDate,
      reason
    });

    if (!holidaySettings.custom_closures) {
      holidaySettings.custom_closures = [];
    }
    holidaySettings.custom_closures.push(res.closure);
    renderCustomClosuresTable(holidaySettings);

    document.getElementById('custom-closure-title').value = '';
    document.getElementById('custom-closure-start').value = '';
    document.getElementById('custom-closure-end').value = '';
    document.getElementById('custom-closure-reason').value = '';
    document.getElementById('box-create-custom-closure').style.display = 'none';

    alert('개인 사정 임시휴무가 등록되었습니다.');
  } catch (err) {
    alert('임시휴무 등록 실패: ' + err.message);
  }
}

/**
 * 매장 정보 전체 저장 핸들러
 * @param {Object} state
 * @param {Function} onSavedCallbacks
 */
export async function handleSaveStoreInfo(state, onSavedCallbacks = {}) {
  const getVal = (id) => document.getElementById(id)?.value?.trim();

  const updates = {
    store_name: getVal('form-store-name'),
    biz_number: getVal('form-biz-number'),
    owner_name: getVal('form-owner-name'),
    phone: getVal('form-phone'),
    address: getVal('form-address'),
    operating_hours: getVal('form-hours'),
    origin_info: getVal('form-origin-info')
  };

  const collectedHours = collectStoreHours();

  const opTypeRadio = document.querySelector('input[name="radio-store-op-type"]:checked');
  const storeOpType = opTypeRadio ? opTypeRadio.value : 'HYBRID';

  try {
    const [resStore, resHours, resRules] = await Promise.all([
      merchantApi.updateStoreInfo(updates),
      merchantApi.updateStoreType(storeOpType).catch(err => {
        console.warn('매장 운영형태 저장 실패:', err);
        return null;
      }),
      merchantApi.updateStoreHours(collectedHours).catch(err => {
        console.warn('운영시간 저장 실패:', err);
        return null;
      }),
      merchantApi.updateDeliveryRules({
        regions: state.deliveryRegions,
        tip_rules: state.deliveryTipRules
      }).catch(err => {
        console.warn('배달규칙 저장 실패:', err);
        return null;
      })
    ]);

    state.store = resStore.store;
    if (resHours && resHours.hours) {
      state.storeHours = resHours.hours;
    }
    if (resRules) {
      if (Array.isArray(resRules.regions)) state.deliveryRegions = resRules.regions;
      if (Array.isArray(resRules.tip_rules)) state.deliveryTipRules = resRules.tip_rules;
    }
    renderStoreMeta(state.store);
    if (onSavedCallbacks.onDeliverySaved) onSavedCallbacks.onDeliverySaved();
    alert('가게 운영 정보, 요일별 스케줄 및 배달구역/배달팁이 성공적으로 저장되었습니다.');
  } catch (err) {
    alert('저장 실패: ' + err.message);
  }
}
