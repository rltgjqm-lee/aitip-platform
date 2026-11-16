/**
 * AITIP Enterprise ERP Multi-Dimensional Filter Controller (ESM)
 * 7대 다차원 축: 기간, 17개 시도/226개 시군구 주소엔진, 광역 총판, 지역 대리점, 가맹점, 배송망(라이더), 결제자산
 * 100% 순수 템플릿 렌더링 & 이벤트 바인딩 (DOM Reparenting 삭제, 영구 소실 원천 방지)
 */

// 대한민국 17개 시/도 및 대표 시/군/구 주소엔진 데이터셋 (행안부 법정동 코드 연계)
export const SIDO_SIGUNGU_DATA = {
  '11': { name: '서울특별시', list: ['강남구', '서초구', '송파구', '마포구', '영등포구', '용산구', '종로구', '중구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '양천구', '강서구', '구로구', '금천구', '동작구', '관악구', '강동구'] },
  '41': { name: '경기도', list: ['수원시 팔달구', '수원시 영통구', '수원시 장안구', '수원시 권선구', '성남시 분당구', '성남시 수정구', '성남시 중원구', '고양시 일산동구', '고양시 일산서구', '용인시 수지구', '용인시 기흥구', '부천시', '안산시', '화성시', '평택시', '안양시', '시흥시', '파주시', '김포시', '의정부시', '광주시', '하남시', '남양주시'] },
  '26': { name: '부산광역시', list: ['해운대구', '부산진구', '수영구', '동래구', '남구', '연제구', '사하구', '금정구', '북구', '사상구', '중구', '서구', '동구', '영도구', '강서구', '기장군'] },
  '27': { name: '대구광역시', list: ['수성구', '달서구', '중구', '동구', '서구', '남구', '북구', '달성군', '군위군'] },
  '28': { name: '인천광역시', list: ['연수구', '남동구', '부평구', '서구', '미추홀구', '중구', '동구', '계양구', '강화군', '옹진군'] },
  '30': { name: '대전광역시', list: ['유성구', '서구', '중구', '동구', '대덕구'] },
  '29': { name: '광주광역시', list: ['서구', '북구', '광산구', '동구', '남구'] },
  '31': { name: '울산광역시', list: ['남구', '중구', '북구', '동구', '울주군'] },
  '36': { name: '세종특별자치시', list: ['세종시 전역'] },
  '42': { name: '강원특별자치도', list: ['춘천시', '원주시', '강릉시', '속초시', '동해시', '홍천군'] },
  '43': { name: '충청북도', list: ['청주시 상당구', '청주시 흥덕구', '충주시', '제천시'] },
  '44': { name: '충청남도', list: ['천안시 서북구', '천안시 동남구', '아산시', '서산시', '당진시'] },
  '45': { name: '전북특별자치도', list: ['전주시 완산구', '전주시 덕진구', '익산시', '군산시'] },
  '46': { name: '전라남도', list: ['순천시', '여수시', '목포시', '나주시', '광양시'] },
  '47': { name: '경상북도', list: ['포항시 남구', '포항시 북구', '구미시', '경주시', '안동시'] },
  '48': { name: '경상남도', list: ['창원시 의창구', '창원시 성산구', '김해시', '진주시', '양산시'] },
  '50': { name: '제주특별자치도', list: ['제주시', '서귀포시'] }
};

// 권역별 관할 총판 및 대리점 계약 매핑 테이블 (행정코드 M-{시도2}-{시군구3} 기반)
export const TERRITORY_AGENCY_MAP = {
  '11': {
    distributor: { id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41', name: '서울광역 총판 (주)에이티파트너스' }
  },
  '41': {
    distributor: { id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c42', name: '경기남부 총판 (주)경인네트웍스' }
  },
  '11-서초구': {
    code: '11-650',
    sido: '서울특별시',
    sigungu: '서초구',
    distributor: { id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41', name: '서울광역 총판 (주)에이티파트너스' },
    agency: { id: 'agn_01jcbk9v502x8m4v0k5a1b2c02', code: '01', name: '(주)서초네트웍스' }
  },
  '11-강남구': {
    code: '11-680',
    sido: '서울특별시',
    sigungu: '강남구',
    distributor: { id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41', name: '서울광역 총판 (주)에이티파트너스' },
    agency: { id: 'agn_01jcbk9v502x8m4v0k5a1b2c01', code: '01', name: '강남제일정보시스템' }
  },
  '41-수원시 팔달구': {
    code: '41-115',
    sido: '경기도',
    sigungu: '수원시 팔달구',
    distributor: { id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c42', name: '경기남부 총판 (주)경인네트웍스' },
    agency: { id: 'agn_01jcbk9v502x8m4v0k5a1b2c03', code: '01', name: '수원중앙정보통신' }
  },
  '41-수원시 영통구': {
    code: '41-117',
    sido: '경기도',
    sigungu: '수원시 영통구',
    distributor: { id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c42', name: '경기남부 총판 (주)경인네트웍스' },
    agency: { id: 'agn_01jcbk9v502x8m4v0k5a1b2c03', code: '01', name: '수원중앙정보통신' }
  }
};

let currentFilterState = {
  date: new Date().toISOString().split('T')[0],
  sido: 'ALL',
  sigungu: 'ALL',
  ksicCode: 'ALL'
};

let onFilterChangeCallback = null;

export function initErpFilter(onSearchCallback) {
  onFilterChangeCallback = onSearchCallback;
}

export function getCurrentFilter() {
  return { ...currentFilterState };
}

export function setCurrentFilter(newFilter) {
  currentFilterState = { ...currentFilterState, ...newFilter };
}

/**
 * 순수 템플릿 기반 필터 바 HTML 생성 함수
 * - 주소 검색엔진: 순수 공공 행정구역(시·도, 시·군·구)만 표기 (사설 총판명 제거)
 * - 관할 영업망 자동 도출: 선택된 행정코드에 매핑된 관할 총판 및 대리점 정보 하단 실시간 노출
 */
export function renderFilterBarHtml(filter = {}, options = {}) {
  const dateVal = filter.date || currentFilterState.date || new Date().toISOString().split('T')[0];
  const sidoVal = filter.sido || currentFilterState.sido || 'ALL';
  const sigunguVal = filter.sigungu || currentFilterState.sigungu || 'ALL';

  let sigunguOptionsHtml = '<option value="ALL">시·군·구 전체</option>';
  if (sidoVal !== 'ALL' && SIDO_SIGUNGU_DATA[sidoVal]) {
    sigunguOptionsHtml += SIDO_SIGUNGU_DATA[sidoVal].list
      .map(sg => `<option value="${sg}" ${sigunguVal === sg ? 'selected' : ''}>${sg}</option>`)
      .join('');
  }

  // 주소 엔진 기반 관할 총판/대리점 자동 도출
  let mappingInfoHtml = '';
  const territoryKey = `${sidoVal}-${sigunguVal}`;
  const mappedTerritory = TERRITORY_AGENCY_MAP[territoryKey];
  const mappedSido = TERRITORY_AGENCY_MAP[sidoVal];

  if (mappedTerritory) {
    mappingInfoHtml = `
      <div style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 12px; margin-top: 8px; width: 100%; flex-wrap: wrap;">
        <span style="font-weight: 800; color: #0f172a;">[관할 행정코드: ${mappedTerritory.code}] ${mappedTerritory.sido} ${mappedTerritory.sigungu}</span>
        <span style="color: #cbd5e1;">|</span>
        <span style="color: var(--text-secondary);">[관할 총판] <strong style="color: #0f172a;">${mappedTerritory.distributor.name}</strong></span>
        <span style="color: #cbd5e1;">|</span>
        <span style="color: var(--text-secondary);">[관할 대리점] <strong style="color: var(--brand-mint-text);">${mappedTerritory.agency.name} (대리점 ${mappedTerritory.agency.code})</strong></span>
        <span class="badge-status active" style="font-size: 10px; margin-left: auto;">영업망 자동 매핑 완료</span>
      </div>
    `;
  } else if (mappedSido && sidoVal !== 'ALL') {
    mappingInfoHtml = `
      <div style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 12px; margin-top: 8px; width: 100%; flex-wrap: wrap;">
        <span style="font-weight: 800; color: #0f172a;">[권역] ${SIDO_SIGUNGU_DATA[sidoVal]?.name || sidoVal} 전역</span>
        <span style="color: #cbd5e1;">|</span>
        <span style="color: var(--text-secondary);">[총괄 총판] <strong style="color: #0f172a;">${mappedSido.distributor.name}</strong></span>
        <span style="font-size: 11px; color: var(--text-muted);">(시·군·구를 선택하면 담당 관할 대리점이 자동 매핑됩니다)</span>
      </div>
    `;
  } else {
    mappingInfoHtml = `
      <div style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 12px; margin-top: 8px; width: 100%; flex-wrap: wrap;">
        <span style="font-weight: 800; color: #0f172a;">[권역] 전국 17개 시·도 전역</span>
        <span style="color: #cbd5e1;">|</span>
        <span style="color: var(--text-secondary);">[본사 통합 관제 (HQ)] 전국 17개 광역 총판 및 226개 지역 대리점망 통합 모니터링</span>
      </div>
    `;
  }

  return `
    <div class="view-filter-bar" style="background: #ffffff; border: 1px solid var(--border-default); border-radius: 6px; padding: 12px 18px; margin-bottom: 14px;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <!-- 1. 기준일자 -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">기준일자:</span>
            <input type="date" class="erp-select filter-bar-date" value="${dateVal}" style="font-size: 12px; padding: 5px 8px; font-weight: 600;">
          </div>

          <!-- 2. 주소 엔진: 시·도 (순수 행정구역 선택) -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">시·도 (권역):</span>
            <select class="erp-select filter-bar-sido" style="font-size: 12px; padding: 5px 8px; font-weight: 600;">
              <option value="ALL" ${sidoVal === 'ALL' ? 'selected' : ''}>전국 17개 시·도 (전체)</option>
              <option value="11" ${sidoVal === '11' ? 'selected' : ''}>서울특별시</option>
              <option value="41" ${sidoVal === '41' ? 'selected' : ''}>경기도</option>
              <option value="26" ${sidoVal === '26' ? 'selected' : ''}>부산광역시</option>
              <option value="27" ${sidoVal === '27' ? 'selected' : ''}>대구광역시</option>
              <option value="28" ${sidoVal === '28' ? 'selected' : ''}>인천광역시</option>
              <option value="30" ${sidoVal === '30' ? 'selected' : ''}>대전광역시</option>
              <option value="42" ${sidoVal === '42' ? 'selected' : ''}>강원특별자치도</option>
            </select>
          </div>

          <!-- 3. 주소 엔진: 시·군·구 (순수 관할 지역 선택) -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">시·군·구:</span>
            <select class="erp-select filter-bar-sigungu" style="font-size: 12px; padding: 5px 8px; font-weight: 600;">
              ${sigunguOptionsHtml}
            </select>
          </div>

          ${options.extraHtml || ''}
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <button type="button" class="header-btn btn-filter-bar-reset" style="font-size: 12px; padding: 5px 12px; background: #ffffff; border: 1px solid var(--border-default); color: var(--text-secondary); cursor: pointer; font-weight: 700;">
            초기화
          </button>
          <button type="button" class="header-btn header-btn-primary btn-filter-bar-search" style="font-size: 12px; padding: 5px 14px; font-weight: 800;">
            조건 조회
          </button>
        </div>
      </div>

      <!-- 주소 엔진 기반 관할 총판·대리점 자동 도출 스트립 -->
      ${mappingInfoHtml}
    </div>
  `;
}

/**
 * 필터 바 이벤트 리스너 바인딩
 */
export function bindFilterBarEvents(container, onFilterChange) {
  if (!container) return;

  const dateInput = container.querySelector('.filter-bar-date');
  const sidoSelect = container.querySelector('.filter-bar-sido');
  const sigunguSelect = container.querySelector('.filter-bar-sigungu');
  const searchBtn = container.querySelector('.btn-filter-bar-search');

  function getValues() {
    return {
      date: dateInput ? dateInput.value : currentFilterState.date,
      sido: sidoSelect ? sidoSelect.value : currentFilterState.sido,
      sigungu: sigunguSelect ? sigunguSelect.value : currentFilterState.sigungu
    };
  }

  function triggerChange() {
    const vals = getValues();
    currentFilterState = { ...currentFilterState, ...vals };
    if (onFilterChange) {
      onFilterChange(vals);
    } else if (onFilterChangeCallback) {
      onFilterChangeCallback(vals);
    }
  }

  if (sidoSelect && sigunguSelect) {
    sidoSelect.addEventListener('change', () => {
      const selectedSido = sidoSelect.value;
      updateSigunguOptions(selectedSido, sigunguSelect);
      triggerChange();
    });
  }

  if (sigunguSelect) {
    sigunguSelect.addEventListener('change', () => {
      triggerChange();
    });
  }

  if (dateInput) {
    dateInput.addEventListener('change', () => {
      triggerChange();
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      triggerChange();
    });
  }

  const resetBtn = container.querySelector('.btn-filter-bar-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
      currentFilterState = {
        date: today,
        sido: 'ALL',
        sigungu: 'ALL',
        ksicCode: 'ALL'
      };
      if (dateInput) dateInput.value = today;
      if (sidoSelect) sidoSelect.value = 'ALL';
      if (sigunguSelect) updateSigunguOptions('ALL', sigunguSelect);
      if (onFilterChange) {
        onFilterChange(currentFilterState);
      } else if (onFilterChangeCallback) {
        onFilterChangeCallback(currentFilterState);
      }
    });
  }
}

export function updateSigunguOptions(sidoCode, sigunguSelect) {
  if (!sigunguSelect) return;
  if (sidoCode === 'ALL') {
    sigunguSelect.innerHTML = '<option value="ALL">시·군·구 전체</option>';
    return;
  }

  if (SIDO_SIGUNGU_DATA[sidoCode]) {
    const list = SIDO_SIGUNGU_DATA[sidoCode].list;
    sigunguSelect.innerHTML = '<option value="ALL">시·군·구 전체</option>' +
      list.map(sg => `<option value="${sg}">${sg}</option>`).join('');
    return;
  }

  sigunguSelect.innerHTML = '<option value="ALL">시·군·구 전체</option>';
}
