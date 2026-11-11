/**
 * ============================================================================
 * AITIP Core Merchant Meta - 5대 생활밀착 업종 공통 가맹점 프로필 스키마
 * 대상 업종: 음식점(food), 동네마트(mart), 숙박(stay), 이·미용(beauty), 의원(clinic)
 * 특성: 표준 ESM, 무의존성, 불변 UID 정합성 보장, XSS 방지 정규화
 * ============================================================================
 */

export const PARKING_TYPES = {
  FREE: '무료 주차 가능',
  PAID: '유료 주차 지원',
  VALET: '발렛 파킹 가능',
  UNAVAILABLE: '주차 불가 (인근 공영주차장 이용)'
};

export const COMMON_FACILITIES = [
  { id: 'group_seat', label: '단체석 완비', icon: 'users' },
  { id: 'parking', label: '주차 가능', icon: 'car' },
  { id: 'wifi', label: '무선 인터넷 (Wi-Fi)', icon: 'wifi' },
  { id: 'reservation', label: '예약 가능', icon: 'calendar' },
  { id: 'baby_chair', label: '유아용 의자', icon: 'smile' },
  { id: 'pet_friendly', label: '반려동물 동반', icon: 'heart' },
  { id: 'separate_restroom', label: '남/녀 화장실 구분', icon: 'check-circle' },
  { id: 'takeout', label: '포장/테이크아웃', icon: 'shopping-bag' },
  { id: 'wheelchair', label: '장애인 편의시설', icon: 'accessibility' },
  { id: 'zero_pay', label: '지역화폐 / 제로페이', icon: 'credit-card' }
];

/**
 * 5대 업종 공통 기본 프로필 템플릿 생성
 */
export function createDefaultStoreProfile(storeId, storeName) {
  return {
    store_id: storeId,
    store_name: storeName || '가맹점명',
    notice: '신선하고 정직한 재료로 정성을 다해 모시겠습니다.',
    parking: {
      type: 'FREE',
      capacity_text: '매장 앞 4대 무료 주차',
      details: '만차 시 인근 서초 공영주차장 1시간 지원 가능합니다.'
    },
    location_guide: {
      subway_station: '2호선 서초역 1번 출구',
      walking_time_minutes: 3,
      landmark_hint: '서초대로 34길 우리은행 골목 진입 후 50m 우측 1층'
    },
    facilities: ['parking', 'wifi', 'group_seat', 'reservation', 'separate_restroom', 'zero_pay'],
    business_registration: {
      biz_number: '214-88-59124',
      owner_name: '홍길동',
      phone: '02-588-9258',
      address: '서울특별시 서초구 서초대로 34길 18 1층'
    },
    legal_notices: {
      origin_or_license: '닭고기(국내산 100%), 쌀(국내산), 배추김치(배추:국내산, 고춧가루:국내산), 순살 치킨(국내산 100% 닭다리살)'
    }
  };
}

/**
 * 블록 입력값 검증 및 안전한 정규화 (XSS 태그 차단)
 */
export function normalizeStoreBlocks(rawBlocks) {
  if (!rawBlocks || typeof rawBlocks !== 'object') {
    return createDefaultStoreProfile('str_default', '가맹점');
  }

  const cleanString = (val, maxLen = 300) => {
    if (typeof val !== 'string') return '';
    return val
      .replace(/<[^>]*>/g, '') // HTML 태그 완전 제거 (XSS 차단)
      .trim()
      .slice(0, maxLen);
  };

  const parkingType = Object.keys(PARKING_TYPES).includes(rawBlocks.parking?.type)
    ? rawBlocks.parking.type
    : 'FREE';

  return {
    notice: cleanString(rawBlocks.notice, 200),
    parking: {
      type: parkingType,
      capacity_text: cleanString(rawBlocks.parking?.capacity_text, 50),
      details: cleanString(rawBlocks.parking?.details, 200)
    },
    location_guide: {
      subway_station: cleanString(rawBlocks.location_guide?.subway_station, 60),
      walking_time_minutes: Math.max(0, parseInt(rawBlocks.location_guide?.walking_time_minutes, 10) || 0),
      landmark_hint: cleanString(rawBlocks.location_guide?.landmark_hint, 150)
    },
    facilities: Array.isArray(rawBlocks.facilities)
      ? rawBlocks.facilities.filter(f => COMMON_FACILITIES.some(cf => cf.id === f))
      : [],
    legal_notices: {
      origin_or_license: cleanString(rawBlocks.legal_notices?.origin_or_license, 400)
    }
  };
}
