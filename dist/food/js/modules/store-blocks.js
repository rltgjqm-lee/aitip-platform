/**
 * AITIP 가맹점 운영 포털 & 고객 PWA - 5대 생활밀착 업종 공통 매장 블록 모듈 (store-blocks.js)
 * 대상: 음식점, 마트, 숙박, 이·미용, 의원 공통
 * 특성: 표준 ESM, 무의존성, PWA 라이브 위지위그 동기화, XSS 방지
 */

import { merchantApi } from '../api.js';

export const COMMON_FACILITY_LIST = [
  { id: 'parking', label: '주차 가능' },
  { id: 'group_seat', label: '단체석 완비' },
  { id: 'wifi', label: '무선 인터넷' },
  { id: 'reservation', label: '예약 가능' },
  { id: 'baby_chair', label: '유아용 의자' },
  { id: 'pet_friendly', label: '반려동물 동반' },
  { id: 'separate_restroom', label: '남녀 화장실' },
  { id: 'takeout', label: '포장/테이크아웃' },
  { id: 'wheelchair', label: '장애인 편의' },
  { id: 'zero_pay', label: '지역화폐/제로페이' }
];

/**
 * 1. 가게 관리 워크스페이스 내에 공통 매장 블록 에디터 렌더링
 */
export function renderStoreBlockEditor(state) {
  const container = document.getElementById('box-store-meta-blocks');
  if (!container) return;

  const blocks = state.store?.blocks || {
    notice: '신선하고 정직한 재료로 정성을 다해 모시겠습니다.',
    parking: { type: 'FREE', capacity_text: '매장 앞 4대 무료 주차', details: '만차 시 인근 서초 공영주차장 1시간 지원' },
    location_guide: { subway_station: '2호선 서초역 1번 출구', walking_time_minutes: 3, landmark_hint: '서초대로 34길 우리은행 골목 진입 후 50m 우측 1층' },
    facilities: ['parking', 'wifi', 'group_seat', 'reservation', 'separate_restroom', 'zero_pay'],
    legal_notices: { origin_or_license: '닭고기(국내산 100%), 쌀(국내산), 배추김치(국내산)' }
  };

  container.innerHTML = `
    <div style="background: #ffffff; border: 1px solid var(--border-default); border-radius: 8px; padding: 20px; margin-top: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-light); padding-bottom: 12px;">
        <div>
          <h3 style="font-size: 15px; font-weight: 800; color: #191f28; margin-bottom: 2px;">가맹점 공통 안내 블록 (주차 · 위치 · 편의시설 · 공지)</h3>
          <p style="font-size: 12.5px; color: #4e5968;">수정하는 즉시 우측 고객 모바일 PWA 화면에 실시간으로 반영됩니다.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-save-store-blocks">블록 설정 저장</button>
      </div>

      <!-- 1) 사장님 띠배너 공지 -->
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label">사장님 모바일 띠배너 공지사항</label>
        <input type="text" class="form-control" id="input-block-notice" value="${blocks.notice || ''}" placeholder="고객 PWA 최상단에 강조될 공지 문구">
      </div>

      <!-- 2) 주차 안내 블록 -->
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label">주차 안내 설정</label>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <label style="display: flex; align-items: center; gap: 4px; font-size: 13px; cursor: pointer;">
            <input type="radio" name="radio-parking-type" value="FREE" ${blocks.parking?.type === 'FREE' ? 'checked' : ''}> 무료 주차 가능
          </label>
          <label style="display: flex; align-items: center; gap: 4px; font-size: 13px; cursor: pointer;">
            <input type="radio" name="radio-parking-type" value="PAID" ${blocks.parking?.type === 'PAID' ? 'checked' : ''}> 유료 주차 지원
          </label>
          <label style="display: flex; align-items: center; gap: 4px; font-size: 13px; cursor: pointer;">
            <input type="radio" name="radio-parking-type" value="VALET" ${blocks.parking?.type === 'VALET' ? 'checked' : ''}> 발렛 파킹
          </label>
          <label style="display: flex; align-items: center; gap: 4px; font-size: 13px; cursor: pointer;">
            <input type="radio" name="radio-parking-type" value="UNAVAILABLE" ${blocks.parking?.type === 'UNAVAILABLE' ? 'checked' : ''}> 주차 불가
          </label>
        </div>
        <div style="display: grid; grid-template-columns: 200px 1fr; gap: 8px;">
          <input type="text" class="form-control" id="input-parking-capacity" value="${blocks.parking?.capacity_text || ''}" placeholder="주차 규모 (예: 매장 앞 4대)">
          <input type="text" class="form-control" id="input-parking-details" value="${blocks.parking?.details || ''}" placeholder="주차 상세 안내 (예: 만차 시 공영주차장 1시간 지원)">
        </div>
      </div>

      <!-- 3) 위치 및 오시는 길 블록 -->
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label">위치 및 찾아오는 길 안내</label>
        <div style="display: grid; grid-template-columns: 200px 120px 1fr; gap: 8px;">
          <input type="text" class="form-control" id="input-subway-station" value="${blocks.location_guide?.subway_station || ''}" placeholder="인근 지하철역 (예: 2호선 서초역 1번 출구)">
          <div style="display: flex; align-items: center; gap: 4px;">
            <input type="number" class="form-control" id="input-walking-time" value="${blocks.location_guide?.walking_time_minutes || 3}" style="width: 70px;">
            <span style="font-size: 12px; color: #4e5968;">분 도보</span>
          </div>
          <input type="text" class="form-control" id="input-landmark-hint" value="${blocks.location_guide?.landmark_hint || ''}" placeholder="찾아오기 쉬운 랜드마크 팁">
        </div>
      </div>

      <!-- 4) 공통 편의시설 체크박스 칩 -->
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label">매장 편의시설 태그 (5대 업종 공통)</label>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${COMMON_FACILITY_LIST.map(fac => {
            const isChecked = (blocks.facilities || []).includes(fac.id);
            return `
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; padding: 4px 10px; border: 1px solid var(--border-default); border-radius: 6px; background: ${isChecked ? '#e6f7f6' : '#ffffff'}; cursor: pointer;">
                <input type="checkbox" class="check-facility" value="${fac.id}" ${isChecked ? 'checked' : ''}>
                <span>${fac.label}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 5) 필수 법적 고지 / 원산지 -->
      <div class="form-group">
        <label class="form-label">필수 고지 정보 (식당: 원산지 / 병원: 비급여 / 숙박: 소방환불)</label>
        <textarea class="form-control" id="input-legal-notice" rows="2" style="font-size: 12px;">${blocks.legal_notices?.origin_or_license || ''}</textarea>
      </div>
    </div>
  `;

  bindStoreBlockEvents(state);
}

/**
 * 2. 블록 입력 시 우측 PWA 시뮬레이터에 '보이는 그대로(WYSIWYG)' 실시간 동기화
 */
function bindStoreBlockEvents(state) {
  const container = document.getElementById('box-store-meta-blocks');
  if (!container) return;

  const syncLiveToPwa = () => {
    const notice = container.querySelector('#input-block-notice')?.value || '';
    const parkingTypeRadio = container.querySelector('input[name="radio-parking-type"]:checked')?.value || 'FREE';
    const capacityText = container.querySelector('#input-parking-capacity')?.value || '';
    const parkingDetails = container.querySelector('#input-parking-details')?.value || '';
    const subwayStation = container.querySelector('#input-subway-station')?.value || '';
    const walkingTime = parseInt(container.querySelector('#input-walking-time')?.value || '0', 10);
    const landmarkHint = container.querySelector('#input-landmark-hint')?.value || '';
    const legalNotice = container.querySelector('#input-legal-notice')?.value || '';

    const selectedFacilities = Array.from(container.querySelectorAll('.check-facility:checked')).map(el => el.value);

    // state 블록 즉시 갱신
    if (!state.store) state.store = {};
    state.store.blocks = {
      notice,
      parking: { type: parkingTypeRadio, capacity_text: capacityText, details: parkingDetails },
      location_guide: { subway_station: subwayStation, walking_time_minutes: walkingTime, landmark_hint: landmarkHint },
      facilities: selectedFacilities,
      legal_notices: { origin_or_license: legalNotice }
    };

    // 우측 PWA 화면에 실시간 라이브 주입
    updatePwaScreenBlocks(state.store.blocks);
  };

  // 인풋 변경 시 실시간 반영
  container.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', syncLiveToPwa);
    el.addEventListener('change', syncLiveToPwa);
  });

  // 저장 버튼
  const btnSave = container.querySelector('#btn-save-store-blocks');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      syncLiveToPwa();
      try {
        await merchantApi.updateStoreBlocks(state.store.blocks);
        alert('가맹점 안내 블록이 안전하게 저장되었습니다.');
      } catch (err) {
        alert('블록 저장 실패: ' + err.message);
      }
    });
  }
}

/**
 * 3. 고객 PWA 모바일 화면에 주차/위치/시설 블록 실시간 시각화
 */
export function updatePwaScreenBlocks(blocks) {
  const pwaNotice = document.getElementById('pwa-live-notice-banner');
  if (pwaNotice) {
    pwaNotice.textContent = blocks?.notice || '';
    pwaNotice.style.display = blocks?.notice ? 'block' : 'none';
  }

  const pwaParkingBadge = document.getElementById('pwa-badge-parking');
  if (pwaParkingBadge) {
    const isAvailable = blocks?.parking?.type !== 'UNAVAILABLE';
    pwaParkingBadge.textContent = isAvailable ? `주차: ${blocks?.parking?.capacity_text || '무료가능'}` : '주차 불가';
    pwaParkingBadge.style.background = isAvailable ? '#dcfce7' : '#fee2e2';
    pwaParkingBadge.style.color = isAvailable ? '#166534' : '#991b1b';
  }

  const pwaSubway = document.getElementById('pwa-text-subway');
  if (pwaSubway) {
    pwaSubway.textContent = `${blocks?.location_guide?.subway_station || '서초역 1번 출구'} 도보 ${blocks?.location_guide?.walking_time_minutes || 3}분`;
  }
}
