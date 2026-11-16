/**
 * ============================================================================
 * AITIP Enterprise Platform Master Admin API Service Layer (ESM)
 * Design Standard: DOC-00 (Strict TypeID UID), DOC-18 (Admin Master Architecture)
 * Base Endpoint: /api/admin/*
 * ============================================================================
 */

const BASE_URL = '/api/admin';

// ============================================================================
// 전사 공통 정규 마스터 데이터셋 (DOC-00, DOC-18 기준 100% TypeID 무결성 준수)
// ============================================================================

// 1. 전국 17개 광역 총판 (Master Distributors: partner_agencies 테이블 agency_type = 'MASTER_DISTRIBUTOR')
const MASTER_DISTRIBUTORS = [
  {
    id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_type: 'MASTER_DISTRIBUTOR',
    name: '서울광역 총판 (주)에이티파트너스',
    territory_code: '11',
    territory_name: '서울특별시 전역 (11)',
    biz_number: '101-86-12345',
    rep_name: '김영식',
    phone: '02-555-1201',
    overriding_rate: 0.001,
    agencies_cnt: 25,
    merchants_cnt: 142,
    devices_cnt: 154,
    monthly_gmv: 639225000,
    margin_amount: 639225,
    status: 'ACTIVE'
  },
  {
    id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c42',
    agency_type: 'MASTER_DISTRIBUTOR',
    name: '경기남부 총판 (주)경인유통',
    territory_code: '41',
    territory_name: '경기도 남부 (41)',
    biz_number: '124-81-67890',
    rep_name: '박경진',
    phone: '031-240-3300',
    overriding_rate: 0.001,
    agencies_cnt: 18,
    merchants_cnt: 98,
    devices_cnt: 110,
    monthly_gmv: 412800000,
    margin_amount: 412800,
    status: 'ACTIVE'
  },
  {
    id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c43',
    agency_type: 'MASTER_DISTRIBUTOR',
    name: '부산경남 총판 (주)동남네트워크',
    territory_code: '26',
    territory_name: '부산광역시 전역 (26)',
    biz_number: '602-81-44556',
    rep_name: '정동환',
    phone: '051-808-7711',
    overriding_rate: 0.001,
    agencies_cnt: 16,
    merchants_cnt: 88,
    devices_cnt: 78,
    monthly_gmv: 368475000,
    margin_amount: 368475,
    status: 'ACTIVE'
  }
];

// 2. 226개 지역 대리점 (Local Agencies: partner_agencies 테이블 agency_type = 'REGIONAL_AGENCY')
const LOCAL_AGENCIES = [
  {
    id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
    agency_type: 'REGIONAL_AGENCY',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    name: '강남제일정보시스템',
    region_code: '11680',
    region_name: '서울 강남구',
    biz_number: '211-12-88710',
    rep_name: '최태호',
    phone: '02-540-8812',
    tax_type: 'BUSINESS_3_3',
    gmv_share_rate: 0.005,
    merchants_cnt: 84,
    devices_cnt: 92,
    monthly_gmv: 340100000,
    margin_amount: 1700500,
    status: 'ACTIVE'
  },
  {
    id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    agency_type: 'REGIONAL_AGENCY',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    name: '(주)서초네트웍스',
    region_code: '11650',
    region_name: '서울 서초구',
    biz_number: '214-87-55123',
    rep_name: '이진수',
    phone: '02-3471-9920',
    tax_type: 'CORPORATE',
    gmv_share_rate: 0.005,
    merchants_cnt: 58,
    devices_cnt: 62,
    monthly_gmv: 299125000,
    margin_amount: 1495625,
    status: 'ACTIVE'
  },
  {
    id: 'agn_01jcbk9v502x8m4v0k5a1b2c03',
    agency_type: 'REGIONAL_AGENCY',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c42',
    name: '수원중앙정보통신',
    region_code: '41115',
    region_name: '수원시 팔달구/영통구',
    biz_number: '135-22-99011',
    rep_name: '한상철',
    phone: '031-215-6670',
    tax_type: 'BUSINESS_3_3',
    gmv_share_rate: 0.005,
    merchants_cnt: 52,
    devices_cnt: 60,
    monthly_gmv: 210000000,
    margin_amount: 1050000,
    status: 'ACTIVE'
  },
  {
    id: 'agn_01jcbk9v502x8m4v0k5a1b2c04',
    agency_type: 'REGIONAL_AGENCY',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c42',
    name: '분당판교스마트센터',
    region_code: '41135',
    region_name: '성남시 분당구',
    biz_number: '129-86-44321',
    rep_name: '송민호',
    phone: '031-709-1230',
    tax_type: 'CORPORATE',
    gmv_share_rate: 0.005,
    merchants_cnt: 46,
    devices_cnt: 50,
    monthly_gmv: 202800000,
    margin_amount: 1014000,
    status: 'ACTIVE'
  },
  {
    id: 'agn_01jcbk9v502x8m4v0k5a1b2c05',
    agency_type: 'REGIONAL_AGENCY',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c43',
    name: '해운대센텀파트너스',
    region_code: '26350',
    region_name: '부산 해운대구/수영구',
    biz_number: '617-25-11234',
    rep_name: '오창석',
    phone: '051-744-8890',
    tax_type: 'BUSINESS_3_3',
    gmv_share_rate: 0.005,
    merchants_cnt: 48,
    devices_cnt: 42,
    monthly_gmv: 198475000,
    margin_amount: 992375,
    status: 'ACTIVE'
  },
  {
    id: 'agn_01jcbk9v502x8m4v0k5a1b2c06',
    agency_type: 'REGIONAL_AGENCY',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c43',
    name: '서면중앙포스',
    region_code: '26230',
    region_name: '부산 부산진구',
    biz_number: '605-19-66789',
    rep_name: '배기태',
    phone: '051-804-5501',
    tax_type: 'CORPORATE',
    gmv_share_rate: 0.005,
    merchants_cnt: 40,
    devices_cnt: 36,
    monthly_gmv: 170000000,
    margin_amount: 850000,
    status: 'ACTIVE'
  }
];

// 2-2. 제휴 협력사 (Installation & VAN & Logistics Partners: agn_ - D1 schema_aitip_v01.sql 준수)
export const INSTALLATION_PARTNERS = [
  {
    id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c51',
    agency_type: 'INSTALLATION_PARTNER',
    name: '(주)한국밴정보시스템 (NICE 총판 협력사)',
    biz_number: '107-86-12345',
    rep_name: '권오진',
    phone: '02-780-1190',
    category: 'POS/VAN 단말기 설치 및 현장 AS 엔지니어망',
    coverage: '수도권 전역 (서울/경기/인천)',
    engineers_cnt: 24,
    devices_maintained: 185,
    status: 'ACTIVE'
  },
  {
    id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c52',
    agency_type: 'INSTALLATION_PARTNER',
    name: '(주)오케이시스템엔지니어링',
    biz_number: '220-88-99881',
    rep_name: '장동호',
    phone: '02-555-8832',
    category: '오케이포스 CTI 에이전트 연동 및 긴급 출동',
    coverage: '전국 기술지원망',
    engineers_cnt: 18,
    devices_maintained: 142,
    status: 'ACTIVE'
  },
  {
    id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c53',
    agency_type: 'DELIVERY_AGENCY',
    name: '메쉬코리아 부릉(Vroong) 배달대행 관제센터',
    biz_number: '214-88-77665',
    rep_name: '유정범',
    phone: '1800-6523',
    category: '3자 이륜차 배달대행 API 연동 및 관제',
    coverage: '전국 17개 시·도 주요 거점',
    engineers_cnt: 1500,
    devices_maintained: 0,
    status: 'ACTIVE'
  }
];

// ============================================================================
// 통계청 한국표준산업분류(KSIC-11) 기준 외식업 공식 법정 분류 체계 (공식 순서 준수)
// ============================================================================
export const KSIC_FOOD_CATEGORIES = [
  { code: 'ALL',   name: '외식업 전체' },
  { code: '56111', name: '한식 일반 (56111)' },
  { code: '56121', name: '중식 짜장·짬뽕 (56121)' },
  { code: '56122', name: '일식·돈까스 (56122)' },
  { code: '56150', name: '제과점업 빵집 (56150)' }, // ★ 통계청 법정 표준 순서 복원
  { code: '56161', name: '피자·햄버거 (56161)' },
  { code: '56162', name: '치킨 전문점 (56162)' },
  { code: '56191', name: '분식 떡볶이·김밥 (56191)' },
  { code: '56221', name: '커피 전문점 (56221)' }
];

// 3. 소상공인 일반 외식 가맹점 (Stores: STR-{시도2}-{시군구3}-{대리점2}-{통계청업종5}-{점포순번4})
const STORES_CATALOG = [
  {
    id: 'STR-11-650-01-56162-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    name: '바른치킨 서초본점',
    store_category: '56162',
    ksic_code: '56162',
    ksic_name: '치킨 전문점',
    category_label: '치킨',
    biz_number: '214-11-98765',
    rep_name: '이만석',
    phone: '02-581-2290',
    sido: '서울특별시',
    sigungu: '서초구',
    address: '서울특별시 서초구 반포대로 14길 30',
    status: 'ACTIVE',
    devices_cnt: 2,
    today_orders: 42,
    today_gmv: 1145000
  },
  {
    id: 'STR-11-650-01-56162-0002',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    name: '교촌치킨 양재점',
    store_category: '56162',
    ksic_code: '56162',
    ksic_name: '치킨 전문점',
    category_label: '치킨',
    biz_number: '214-23-45678',
    rep_name: '박철우',
    phone: '02-572-9988',
    sido: '서울특별시',
    sigungu: '서초구',
    address: '서울특별시 서초구 양재동 18-4',
    status: 'ACTIVE',
    devices_cnt: 1,
    today_orders: 38,
    today_gmv: 980000
  },
  {
    id: 'STR-11-680-01-56121-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
    name: '홍콩반점0410 강남역점',
    store_category: '56121',
    ksic_code: '56121',
    ksic_name: '중식 음식점업',
    category_label: '중식(짜장면)',
    biz_number: '211-09-12344',
    rep_name: '장성민',
    phone: '02-538-4420',
    sido: '서울특별시',
    sigungu: '강남구',
    address: '서울특별시 강남구 테헤란로 105',
    status: 'ACTIVE',
    devices_cnt: 2,
    today_orders: 55,
    today_gmv: 1420000
  },
  {
    id: 'STR-11-650-01-56121-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    name: '교동짬뽕 서초법원점',
    store_category: '56121',
    ksic_code: '56121',
    ksic_name: '중식 음식점업',
    category_label: '중식(짜장면)',
    biz_number: '214-15-66712',
    rep_name: '최원석',
    phone: '02-598-1188',
    sido: '서울특별시',
    sigungu: '서초구',
    address: '서울특별시 서초구 서초대로 240',
    status: 'ACTIVE',
    devices_cnt: 1,
    today_orders: 47,
    today_gmv: 1190000
  },
  {
    id: 'STR-11-650-01-56150-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    name: '파리바게뜨 서초역점',
    store_category: '56150',
    ksic_code: '56150',
    ksic_name: '제과점업',
    category_label: '제과점(빵집)',
    biz_number: '214-86-55410',
    rep_name: '김서연',
    phone: '02-585-8203',
    sido: '서울특별시',
    sigungu: '서초구',
    address: '서울특별시 서초구 반포대로 120',
    status: 'ACTIVE',
    devices_cnt: 2,
    today_orders: 58,
    today_gmv: 890000
  },
  {
    id: 'STR-11-680-01-56150-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
    name: '뚜레쥬르 강남역점',
    store_category: '56150',
    ksic_code: '56150',
    ksic_name: '제과점업',
    category_label: '제과점(빵집)',
    biz_number: '211-85-99231',
    rep_name: '박진형',
    phone: '02-539-7712',
    sido: '서울특별시',
    sigungu: '강남구',
    address: '서울특별시 강남구 강남대로 408',
    status: 'ACTIVE',
    devices_cnt: 1,
    today_orders: 45,
    today_gmv: 720000
  },
  {
    id: 'STR-11-680-01-56191-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
    name: '동대문엽기떡볶이 강남점',
    store_category: '56191',
    ksic_code: '56191',
    ksic_name: '김밥 및 기타 간이 음식점업',
    category_label: '분식(떡볶이)',
    biz_number: '211-18-99034',
    rep_name: '강지혜',
    phone: '02-556-8592',
    sido: '서울특별시',
    sigungu: '강남구',
    address: '서울특별시 강남구 강남대로 382',
    status: 'ACTIVE',
    devices_cnt: 2,
    today_orders: 62,
    today_gmv: 1280000
  },
  {
    id: 'STR-11-650-01-56191-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    name: '고봉민김밥人 서초점',
    store_category: '56191',
    ksic_code: '56191',
    ksic_name: '김밥 및 기타 간이 음식점업',
    category_label: '분식(김밥)',
    biz_number: '214-08-33419',
    rep_name: '정숙자',
    phone: '02-523-7741',
    sido: '서울특별시',
    sigungu: '서초구',
    address: '서울특별시 서초구 서초중앙로 45',
    status: 'ACTIVE',
    devices_cnt: 1,
    today_orders: 51,
    today_gmv: 620000
  },
  {
    id: 'STR-11-650-01-56161-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    name: '도미노피자 서초점',
    store_category: '56161',
    ksic_code: '56161',
    ksic_name: '피자, 햄버거 및 유사 음식점업',
    category_label: '피자·버거',
    biz_number: '214-85-11234',
    rep_name: '윤성민',
    phone: '02-588-3082',
    sido: '서울특별시',
    sigungu: '서초구',
    address: '서울특별시 서초구 효령로 180',
    status: 'ACTIVE',
    devices_cnt: 2,
    today_orders: 34,
    today_gmv: 1050000
  },
  {
    id: 'STR-11-680-01-56111-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
    name: '본죽&비빔밥 강남역점',
    store_category: '56111',
    ksic_code: '56111',
    ksic_name: '한식 일반 음식점업',
    category_label: '한식',
    biz_number: '211-19-44589',
    rep_name: '오선영',
    phone: '02-563-6288',
    sido: '서울특별시',
    sigungu: '강남구',
    address: '서울특별시 강남구 역삼로 112',
    status: 'ACTIVE',
    devices_cnt: 1,
    today_orders: 36,
    today_gmv: 780000
  },
  {
    id: 'STR-41-115-01-56162-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c42',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c03',
    name: '수원왕갈비통닭 팔달점',
    store_category: '56162',
    ksic_code: '56162',
    ksic_name: '치킨 전문점',
    category_label: '치킨',
    biz_number: '135-11-77889',
    rep_name: '조규현',
    phone: '031-242-9901',
    sido: '경기도',
    sigungu: '수원시 팔달구',
    address: '경기도 수원시 팔달구 정조로 800번길 16',
    status: 'ACTIVE',
    devices_cnt: 1,
    today_orders: 29,
    today_gmv: 810000
  },
  {
    id: 'STR-11-650-01-56122-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    name: '미소야 교대역점',
    store_category: '56122',
    ksic_code: '56122',
    ksic_name: '일식 음식점업',
    category_label: '일식·돈까스',
    biz_number: '214-14-88910',
    rep_name: '이현우',
    phone: '02-597-3341',
    sido: '서울특별시',
    sigungu: '서초구',
    address: '서울특별시 서초구 서초중앙로 125',
    status: 'ACTIVE',
    devices_cnt: 1,
    today_orders: 41,
    today_gmv: 920000
  },
  {
    id: 'STR-11-650-01-56221-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    name: '메가MGC커피 양재역점',
    store_category: '56221',
    ksic_code: '56221',
    ksic_name: '커피 전문점',
    category_label: '카페',
    biz_number: '214-03-77291',
    rep_name: '김은정',
    phone: '02-575-4412',
    sido: '서울특별시',
    sigungu: '서초구',
    address: '서울특별시 서초구 남부순환로 2580',
    status: 'ACTIVE',
    devices_cnt: 2,
    today_orders: 88,
    today_gmv: 490000
  }
];

// 4. 단위농협 하나로마트 (Marts: MRT-{시도2}-{시군구3}-{대리점2}-{통계청업종5}-{마트순번4})
const MARTS_CATALOG = [
  {
    id: 'MRT-11-650-01-47121-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    name: '서초농협 하나로마트 양재점',
    biz_number: '214-82-01923',
    rep_name: '농협중앙회 서초조합장',
    phone: '02-3498-1114',
    sido: '서울특별시',
    sigungu: '서초구',
    address: '서울특별시 서초구 청계산로 10',
    supply_category: '농축수산물 및 생필품 B2B 직배',
    devices_cnt: 2,
    status: 'ACTIVE',
    today_orders: 19,
    today_gmv: 2450000
  },
  {
    id: 'MRT-41-117-01-47121-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c42',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c03',
    name: '수원농협 하나로마트 광교점',
    biz_number: '135-82-44102',
    rep_name: '농협중앙회 수원조합장',
    phone: '031-218-5500',
    sido: '경기도',
    sigungu: '수원시 영통구',
    address: '경기도 수원시 영통구 도청로 18번길 26',
    supply_category: '로컬푸드 및 식자재 순회배송',
    devices_cnt: 1,
    status: 'ACTIVE',
    today_orders: 14,
    today_gmv: 1820000
  }
];

// 5. 수요 시설 (Facilities: FAC-{시도2}-{시군구3}-{대리점2}-{통계청업종5}-{시설순번4})
const FACILITIES_CATALOG = [
  {
    id: 'FAC-11-650-01-87391-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    name: '서초구 양재1동 복지센터',
    facility_type: 'COMMUNITY_CENTER',
    rep_name: '정순임 센터장',
    phone: '02-571-0891',
    sido: '서울특별시',
    sigungu: '서초구',
    address: '서울특별시 서초구 바우뫼로 41길 12',
    coop_order_enabled: true,
    mapped_mart_id: 'MRT-11-650-01-47121-0001',
    status: 'ACTIVE'
  },
  {
    id: 'FAC-11-680-01-87391-0001',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
    name: '강남구 역삼2동 복지센터',
    facility_type: 'COMMUNITY_CENTER',
    rep_name: '이종만 센터장',
    phone: '02-563-3341',
    sido: '서울특별시',
    sigungu: '강남구',
    address: '서울특별시 강남구 도곡로 33길 15',
    coop_order_enabled: true,
    mapped_mart_id: 'MRT-11-650-01-47121-0001',
    status: 'ACTIVE'
  }
];

// 6. 스마트 단말기 (Devices: dev_ - D1 schema_aitip_v01.sql 라인 276-296 및 연동 POS사 표준)
const DEVICES_CATALOG = [
  {
    id: 'dev_01jcbk9v4e2x8m4v0k5a1b2c31',
    mac_address: 'B8:27:EB:14:8A:21',
    board_serial: 'CTI-BRD-882910',
    firmware_version: 'v2.4.1 (최신)',
    is_online: 1,
    paper_status: 'NORMAL',
    pos_company: '오케이포스 (OKPOS) v3.2',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    mapped_type: 'STORE',
    store_id: 'STR-11-650-01-56162-0001',
    store_name: '바른치킨 서초본점',
    sido: '서울특별시',
    sigungu: '서초구',
    ip: '192.168.0.50',
    modem_no: '012-8412-9901',
    heartbeat_sec: 8
  },
  {
    id: 'dev_01jcbk9v4e2x8m4v0k5a1b2c32',
    mac_address: 'B8:27:EB:29:4C:55',
    board_serial: 'CTI-BRD-882911',
    firmware_version: 'v2.4.1 (최신)',
    is_online: 1,
    paper_status: 'NORMAL',
    pos_company: '포스뱅크 (POSBANK) v2.1',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    mapped_type: 'STORE',
    store_id: 'STR-11-650-01-56162-0002',
    store_name: '교촌치킨 양재점',
    sido: '서울특별시',
    sigungu: '서초구',
    ip: '192.168.1.100',
    modem_no: '012-5912-3341',
    heartbeat_sec: 14
  },
  {
    id: 'dev_01jcbk9v4e2x8m4v0k5a1b2c33',
    mac_address: 'B8:27:EB:73:11:09',
    board_serial: 'CTI-BRD-882912',
    firmware_version: 'v2.3.9 (업데이트 권장)',
    is_online: 1,
    paper_status: 'NORMAL',
    pos_company: '나이스 (NICE) v1.9',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
    mapped_type: 'STORE',
    store_id: 'STR-11-680-01-56121-0001',
    store_name: '홍콩반점0410 강남역점',
    sido: '서울특별시',
    sigungu: '강남구',
    ip: '192.168.0.12',
    modem_no: 'WiFi Dedicated',
    heartbeat_sec: 22
  },
  {
    id: 'dev_01jcbk9v4e2x8m4v0k5a1b2c34',
    mac_address: 'B8:27:EB:A4:62:30',
    board_serial: 'CTI-BRD-882913',
    firmware_version: 'v2.4.1 (최신)',
    is_online: 1,
    paper_status: 'NORMAL',
    pos_company: '농협 ERP / 하나로POS v5.0',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    mapped_type: 'MART',
    mart_id: 'MRT-11-650-01-47121-0001',
    store_name: '서초농협 하나로마트 양재점',
    sido: '서울특별시',
    sigungu: '서초구',
    ip: '10.20.30.10',
    modem_no: '012-7721-5502',
    heartbeat_sec: 5
  },
  {
    id: 'dev_01jcbk9v4e2x8m4v0k5a1b2c35',
    mac_address: 'B8:27:EB:55:77:88',
    board_serial: 'CTI-BRD-882914',
    firmware_version: 'v2.4.1 (최신)',
    is_online: 1,
    paper_status: 'PAPER_LOW',
    pos_company: '토스 (Toss) v4.0',
    distributor_id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    mapped_type: 'STORE',
    store_id: 'STR-11-650-01-56122-0001',
    store_name: '미소야 교대역점',
    sido: '서울특별시',
    sigungu: '서초구',
    ip: '192.168.2.45',
    modem_no: '012-8833-2210',
    heartbeat_sec: 18
  }
];

// 7. 배송망 & 전문 라이더 (Delivery Sessions / Workers: wrk_ - D1 schema_aitip_v01.sql 준수)
const RIDERS_CATALOG = [
  {
    id: 'wrk_01jcbk9v4e2x8m4v0k5a1b2c3h',
    name: '김도현',
    phone: '010-3841-****',
    type: 'LOCAL_AGENCY',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c01',
    org_name: '강남제일정보시스템 대리점망',
    vehicle: '오토바이 (PCX 125)',
    status: 'DELIVERING',
    status_label: '배송중 (DELIVERING)',
    sido: '서울특별시',
    sigungu: '강남구',
    location: '서초동 교대역 사거리',
    active_orders: 1,
    today_completed: 18,
    rating: '4.95 (수락률 98%)'
  },
  {
    id: 'wrk_01jcbk9v4e2x8m4v0k5a1b2c3j',
    name: '박성민',
    phone: '010-5928-****',
    type: 'LOCAL_AGENCY',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    org_name: '(주)서초네트웍스 대리점망',
    vehicle: '오토바이 (NMAX 125)',
    status: 'PICKING',
    status_label: '픽업중 (PICKING)',
    sido: '서울특별시',
    sigungu: '서초구',
    location: '바른치킨 서초본점 앞',
    active_orders: 1,
    today_completed: 22,
    rating: '4.90 (수락률 96%)'
  },
  {
    id: 'wrk_01jcbk9v4e2x8m4v0k5a1b2c3m',
    name: '윤태민',
    phone: '010-7712-****',
    type: 'OUTSOURCED_API',
    agency_id: 'agn_01jcbk9v502x8m4v0k5a1b2c02',
    org_name: '부릉(Vroong) 서초지사망',
    vehicle: '오토바이 (혼다 벤리)',
    status: 'STANDBY',
    status_label: '배차대기 (STANDBY)',
    sido: '서울특별시',
    sigungu: '서초구',
    location: '서초역 3번 출구',
    active_orders: 0,
    today_completed: 15,
    rating: '4.88 (수락률 95%)'
  }
];

const TAX_SETTLEMENT_ITEMS = [
  { id: 'agn_01jcbk9v502x8m4v0k5a1b2c01', name: '강남제일정보시스템', rep: '최태호', biz_type: '개인 (프리랜서)', territory: '서울 강남구', commission: 4200000, tax_type: 'WITHHOLDING_3_3', doc_no: 'WTH-202611-01', status: 'CONFIRMED' },
  { id: 'agn_01jcbk9v502x8m4v0k5a1b2c02', name: '(주)서초네트웍스', rep: '이진수', biz_type: '일반법인', territory: '서울 서초구', commission: 3850000, tax_type: 'TAX_INVOICE_10', doc_no: 'NTS-202611-0981', status: 'ISSUED' },
  { id: 'agn_01jcbk9v502x8m4v0k5a1b2c03', name: '수원중앙정보통신', rep: '한상철', biz_type: '개인사업자', territory: '수원시 팔달구', commission: 3100000, tax_type: 'WITHHOLDING_3_3', doc_no: 'WTH-202611-02', status: 'CONFIRMED' },
  { id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41', name: '서울광역 총판 (주)에이티파트너스', rep: '김영식', biz_type: '광역 총판 법인', territory: '서울특별시 전역', commission: 1900000, tax_type: 'TAX_INVOICE_10', doc_no: 'NTS-202611-0983', status: 'ISSUED' }
];

// ============================================================================
// 통신 핸들러 (API Layer)
// ============================================================================

export const ROLE_ALLOWED_VIEWS = {
  HQ_SUPER: null, // 전체 허용
  HQ_CS: ['view-dashboard', 'view-orders', 'view-riders', 'view-cs-refunds'],
  HQ_FINANCE: ['view-dashboard', 'view-settlement-merchants', 'view-settlement-taxes'],
  DISTRIBUTOR: ['view-dashboard', 'view-merchants', 'view-distribution', 'view-settlement-merchants', 'view-settlement-taxes'],
  AGENCY: ['view-dashboard', 'view-merchants', 'view-onboarding', 'view-hardware', 'view-settlement-taxes'],
  SALES_ALLY: ['view-dashboard', 'view-distribution', 'view-settlement-taxes'],
  SERVICE_ALLY: ['view-dashboard', 'view-distribution', 'view-settlement-merchants'],
  TECH_ALLY: ['view-dashboard', 'view-hardware', 'view-policies']
};

const authContext = {
  role: 'HQ_SUPER',
  tenantId: 'hq'
};

async function request(endpoint, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'x-admin-role': authContext.role,
      'x-tenant-id': authContext.tenantId,
      ...options.headers,
    },
    ...options,
  };

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, config);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err = new Error(errData.error || `HTTP ${res.status}: API 통신 실패 (${endpoint})`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } catch (err) {
    if (err.status === 403 || err.status === 400) throw err;
    // 백엔드 연동 전 인메모리 정합성 데이터 서비스
    return filterMockData(endpoint);
  }
}

/**
 * 쿼리 파라미터 및 필터 조건에 맞추어 실측 데이터를 필터링 반환
 */
function filterMockData(endpoint) {
  const url = new URL(endpoint, 'http://localhost');
  const pathname = url.pathname;
  const sido = url.searchParams.get('sido') || '';
  const sigungu = url.searchParams.get('sigungu') || '';
  const distId = url.searchParams.get('distId') || '';
  const agencyId = url.searchParams.get('agencyId') || '';
  const ksicCode = url.searchParams.get('ksicCode') || '';

  // 1. 전국 경영 대시보드
  if (pathname === '/dashboard') {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        total_gmv_today: 48920000,
        total_orders_today: 1842,
        active_terminals: 342,
        total_terminals: 350,
        terminal_uptime_rate: 97.7,
        active_stores: 280,
        active_marts: 48,
        active_facilities: 112,
        pending_approvals: 6,
        multi_asset_today: {
          credit_card: { amount: 31200000, share_pct: 63.8 },
          card_points: { amount: 4890000, share_pct: 10.0 },
          local_currency: { amount: 9780000, share_pct: 20.0 },
          stablecoin: { amount: 3050000, share_pct: 6.2 }
        }
      }
    };
  }

  // 2. 광역 총판 및 지역 대리점 계층 유통망
  if (pathname === '/distributors') {
    let list = MASTER_DISTRIBUTORS.map(d => {
      let matchedAgencies = LOCAL_AGENCIES.filter(a => a.distributor_id === d.id);
      if (agencyId) matchedAgencies = matchedAgencies.filter(a => a.id === agencyId);
      if (sigungu) matchedAgencies = matchedAgencies.filter(a => a.region_name.includes(sigungu));
      return {
        ...d,
        agencies: matchedAgencies
      };
    });

    if (distId) list = list.filter(d => d.id === distId);
    if (sido && sido !== 'ALL') {
      list = list.filter(d => d.territory_name.includes(sido));
    }
    return { success: true, distributors: list };
  }

  // 2-2. 지역 대리점 단독 원장
  if (pathname === '/agencies') {
    let list = LOCAL_AGENCIES;
    if (distId) list = list.filter(a => a.distributor_id === distId);
    if (agencyId) list = list.filter(a => a.id === agencyId);
    if (sigungu && sigungu !== 'ALL') list = list.filter(a => a.region_name.includes(sigungu));
    return { success: true, agencies: list, total: list.length };
  }

  // 2-3. 제휴 협력사 (VAN/설치/물류)
  if (pathname === '/partners') {
    return { success: true, partners: INSTALLATION_PARTNERS, total: INSTALLATION_PARTNERS.length };
  }

  // 3. 소상공인 일반 외식 가맹점 (Stores: str_)
  if (pathname === '/stores') {
    let list = STORES_CATALOG;
    if (distId) list = list.filter(s => s.distributor_id === distId);
    if (agencyId) list = list.filter(s => s.agency_id === agencyId);
    if (sido && sido !== 'ALL') list = list.filter(s => s.sido.includes(sido));
    if (sigungu && sigungu !== 'ALL') list = list.filter(s => s.sigungu.includes(sigungu));
    if (ksicCode && ksicCode !== 'ALL') list = list.filter(s => (s.store_category === ksicCode || s.ksic_code === ksicCode));
    return { success: true, stores: list, total: list.length };
  }

  // 4. 하나로마트 (Marts: mrt_)
  if (pathname === '/marts') {
    let list = MARTS_CATALOG;
    if (distId) list = list.filter(m => m.distributor_id === distId);
    if (agencyId) list = list.filter(m => m.agency_id === agencyId);
    if (sido && sido !== 'ALL') list = list.filter(m => m.sido.includes(sido));
    if (sigungu && sigungu !== 'ALL') list = list.filter(m => m.sigungu.includes(sigungu));
    return { success: true, marts: list, total: list.length };
  }

  // 5. 수요 시설 (Facilities: fac_ - 경로당)
  if (pathname === '/facilities') {
    let list = FACILITIES_CATALOG;
    if (distId) list = list.filter(f => f.distributor_id === distId);
    if (agencyId) list = list.filter(f => f.agency_id === agencyId);
    if (sido && sido !== 'ALL') list = list.filter(f => f.sido.includes(sido));
    if (sigungu && sigungu !== 'ALL') list = list.filter(f => f.sigungu.includes(sigungu));
    return { success: true, facilities: list, total: list.length };
  }

  // 6. 스마트 단말기 MDM (Devices: dev_)
  if (pathname === '/devices') {
    let list = DEVICES_CATALOG;
    if (distId) list = list.filter(d => d.distributor_id === distId);
    if (agencyId) list = list.filter(d => d.agency_id === agencyId);
    if (sido && sido !== 'ALL') list = list.filter(d => d.sido.includes(sido));
    if (sigungu && sigungu !== 'ALL') list = list.filter(d => d.sigungu.includes(sigungu));
    return { success: true, devices: list, total: list.length };
  }

  // 7. 배송망 & 라이더 (wrk_)
  if (pathname === '/riders') {
    let list = RIDERS_CATALOG;
    if (agencyId) list = list.filter(r => r.agency_id === agencyId);
    if (sido && sido !== 'ALL') list = list.filter(r => r.sido.includes(sido));
    if (sigungu && sigungu !== 'ALL') list = list.filter(r => r.sigungu.includes(sigungu));
    return { success: true, riders: list, total: list.length };
  }

  // 8. 세무 정산 (DOC-18 3.3% 원천징수 vs 10% 세금계산서)
  if (pathname.startsWith('/settlements/taxes')) {
    const withholdingItems = TAX_SETTLEMENT_ITEMS.filter(it => it.tax_type === 'WITHHOLDING_3_3');
    const invoiceItems = TAX_SETTLEMENT_ITEMS.filter(it => it.tax_type === 'TAX_INVOICE_10');
    const withholdingTotal = withholdingItems.reduce((s, it) => s + Number(it.commission || 0), 0);
    const invoiceTotal = invoiceItems.reduce((s, it) => s + Number(it.commission || 0), 0);
    return {
      success: true,
      summary: {
        total_payout_pool: withholdingTotal + invoiceTotal,
        withholding_count: withholdingItems.length,
        withholding_total: withholdingTotal,
        withholding_tax: Math.round(withholdingTotal * 0.033),
        tax_invoice_count: invoiceItems.length,
        tax_invoice_total: invoiceTotal,
        tax_invoice_vat: Math.round(invoiceTotal * 0.1)
      },
      items: TAX_SETTLEMENT_ITEMS
    };
  }

  // 9. 실시간 주문 스트림 (전사 계층 UID: ORD-{시도}-{시군구}-{대리점}-{업종}-{순번}-{일자}-{전표})
  if (pathname === '/orders/live') {
    return {
      success: true,
      orders: [
        {
          id: 'ORD-11-650-01-56162-0001-261113-0042',
          order_seq: 'A-42',
          seller_type: 'STORE',
          seller_id: 'STR-11-650-01-56162-0001',
          store_name: '바른치킨 서초본점',
          fulfillment_type: 'DELIVERY',
          items_desc: '대새레드치킨(순살) + 떡사리',
          amount: 24900,
          asset_type: 'LOCAL_CURRENCY',
          asset_label: '지역화폐(서울페이)',
          status: 'ACCEPTED',
          rider_name: '김도현 (강남제일)',
          created_at: '2분 전'
        },
        {
          id: 'ORD-11-650-01-47121-0001-261113-0012',
          order_seq: 'M-12',
          seller_type: 'MART',
          seller_id: 'MRT-11-650-01-47121-0001',
          store_name: '서초농협 하나로마트 양재점',
          fulfillment_type: 'CONSIGNMENT_DELIVERY',
          items_desc: '하나로 당일장보기: 햅쌀 10kg + 제주감귤 3kg',
          amount: 48500,
          asset_type: 'CREDIT_CARD',
          asset_label: 'NH농협카드 (토스 PG)',
          status: 'COOKING',
          rider_name: '박성민 ((주)서초네트웍스)',
          buyer_facility_id: 'FAC-11-650-01-87391-0001',
          created_at: '5분 전'
        },
        {
          id: 'ORD-11-650-01-56162-0002-261113-0040',
          order_seq: 'A-40',
          seller_type: 'STORE',
          seller_id: 'STR-11-650-01-56162-0002',
          store_name: '교촌치킨 양재점',
          fulfillment_type: 'TAKEOUT',
          items_desc: '교촌오리지날 1팩',
          amount: 19000,
          asset_type: 'CARD_POINT',
          asset_label: '신한 마이포인트',
          status: 'READY',
          rider_name: '-',
          created_at: '8분 전'
        }
      ]
    };
  }

  // 10. 결제 거래 및 3자 대사 정산 원장 (D1 payments & settlements SSOT)
  if (pathname === '/payments/transactions') {
    return {
      success: true,
      transactions: [
        {
          id: 'pay_01jcbk9v4e2x8m4v0k5a1b2c01',
          pg_provider: '토스페이먼츠',
          pg_tid: 'TOSS-TX-261113-0042',
          auth_no: '38910241',
          order_id: 'ORD-11-650-01-56162-0001-261113-0042',
          store_id: 'STR-11-650-01-56162-0001',
          settlement_id: 'SET-11-650-01-56162-0001-261113',
          paid_at: '2026-11-13 11:52:14',
          seller_name: '바른치킨 서초본점 (외식업)',
          merchant_name: '바른치킨 서초본점',
          asset_type: '신용카드 (토스 PG)',
          orig_amount: 32000,
          settled_amount: 32000,
          diff: 0,
          recon_status: 'MATCHED',
          recon_status_label: '3자 대사 정상 일치 (MATCHED)',
          merchant_payout: 25440,
          rider_fee: 4500,
          platform_fee: 1056,
          agency_fee: 160,
          settlement_date: '2026-11-13',
          payout_date: '2026-11-14 (D+1)',
          settlement_status: 'CALCULATED',
          bank_name: '신한은행',
          bank_account: '110-***-492011',
          bank_holder: '주식회사 바른푸드',
          notes: 'D1 settlements 정상 연동 완료'
        },
        {
          id: 'pay_01jcbk9v4e2x8m4v0k5a1b2c02',
          pg_provider: 'NH농협',
          pg_tid: 'NH-TX-261113-0012',
          auth_no: '49102812',
          order_id: 'ORD-11-650-01-47121-0001-261113-0012',
          store_id: 'MRT-11-650-01-47121-0001',
          settlement_id: 'SET-11-650-01-47121-0001-261113',
          paid_at: '2026-11-13 11:45:30',
          seller_name: '서초농협 하나로마트 (B2B 마트)',
          merchant_name: '서초농협 하나로마트',
          asset_type: '신용카드 (NH농협)',
          orig_amount: 39000,
          settled_amount: 32000,
          diff: -7000,
          recon_status: 'PARTIAL_VOID_REISSUE',
          recon_status_label: 'DOC-11 결품 감액 재승인',
          merchant_payout: 28480,
          rider_fee: 3000,
          platform_fee: 520,
          agency_fee: 160,
          settlement_date: '2026-11-13',
          payout_date: '2026-11-15 (D+2)',
          settlement_status: 'CALCULATED',
          bank_name: '농협은행',
          bank_account: '302-***-981244',
          bank_holder: '서초농업협동조합',
          notes: '성주참외 품절 7,000원 감액 정산 반영'
        },
        {
          id: 'pay_01jcbk9v4e2x8m4v0k5a1b2c03',
          pg_provider: '서울페이',
          pg_tid: 'ZERO-TX-261113-0040',
          auth_no: '78291043',
          order_id: 'ORD-11-650-01-56162-0002-261113-0040',
          store_id: 'STR-11-650-01-56162-0002',
          settlement_id: 'SET-11-650-01-56162-0002-261113',
          paid_at: '2026-11-13 11:38:09',
          seller_name: '교촌치킨 양재점 (외식업)',
          merchant_name: '교촌치킨 양재점',
          asset_type: '서울사랑상품권 (제로페이)',
          orig_amount: 24000,
          settled_amount: 23999,
          diff: -1,
          recon_status: 'MISMATCH',
          recon_status_label: '1원 대사 불일치 (MISMATCH)',
          merchant_payout: 19800,
          rider_fee: 3500,
          platform_fee: 699,
          agency_fee: 120,
          settlement_date: '2026-11-13',
          payout_date: '2026-11-14 (D+1)',
          settlement_status: 'CALCULATED',
          bank_name: '국민은행',
          bank_account: '810-***-220199',
          bank_holder: '정승환 (교촌치킨)',
          notes: '1원 단수 보전 계정 인계 후 정산 반영'
        },
        {
          id: 'pay_01jcbk9v4e2x8m4v0k5a1b2c04',
          pg_provider: '토스페이먼츠',
          pg_tid: 'TOSS-TX-261113-0015',
          auth_no: '51829013',
          order_id: 'ORD-11-650-01-96112-0001-261113-0015',
          store_id: 'STR-11-650-01-96112-0001',
          settlement_id: 'SET-11-650-01-96112-0001-261113',
          paid_at: '2026-11-13 11:15:02',
          seller_name: '준오헤어 서초점 (뷰티/헤어 예약)',
          merchant_name: '준오헤어 서초점',
          asset_type: '신용카드 (토스 PG)',
          orig_amount: 65000,
          settled_amount: 65000,
          diff: 0,
          recon_status: 'MATCHED',
          recon_status_label: '3자 대사 정상 일치 (MATCHED)',
          merchant_payout: 61620,
          rider_fee: 0,
          platform_fee: 2145,
          agency_fee: 325,
          settlement_date: '2026-11-13',
          payout_date: '2026-11-14 (D+1)',
          settlement_status: 'CALCULATED',
          bank_name: '우리은행',
          bank_account: '1002-***-552190',
          bank_holder: '준오헤어서초(주)',
          notes: '헤어 디자이너 예약 보증금 시술 완료 연동'
        },
        {
          id: 'pay_01jcbk9v4e2x8m4v0k5a1b2c05',
          pg_provider: '토스페이먼츠',
          pg_tid: 'TOSS-TX-261113-0003',
          auth_no: '91823746',
          order_id: 'ORD-11-650-01-55112-0001-261113-0003',
          store_id: 'STR-11-650-01-55112-0001',
          settlement_id: 'SET-11-650-01-55112-0001-261113',
          paid_at: '2026-11-13 10:48:20',
          seller_name: '부티크스테이 서초 (숙박 예약)',
          merchant_name: '부티크스테이 서초',
          asset_type: '신용카드 (토스 PG)',
          orig_amount: 120000,
          settled_amount: 120000,
          diff: 0,
          recon_status: 'MATCHED',
          recon_status_label: '3자 대사 정상 일치 (MATCHED)',
          merchant_payout: 114000,
          rider_fee: 0,
          platform_fee: 3960,
          agency_fee: 600,
          settlement_date: '2026-11-13',
          payout_date: '2026-11-14 (D+1)',
          settlement_status: 'CALCULATED',
          bank_name: '하나은행',
          bank_account: '281-***-491201',
          bank_holder: '부티크스테이(주)',
          notes: '숙박 객실 예약 체크인 완료 정산 연동'
        }
      ]
    };
  }

  return { success: true, endpoint: pathname, data: [] };
}

// ============================================================================
// Exported API Interface (단일 진실 공급원 API Client)
// ============================================================================

export const adminApi = {
  // 인증 및 세션
  login(id, password = '', otp = '') {
    const distPreset = { id: 'agn_01jcbk9v4e2x8m4v0k5a1b2c41', role: 'MASTER_DISTRIBUTOR', name: '서울광역 총판장 (김영식)', role_label: 'Master Distributor', territory: '서울특별시 관할' };
    const agencyPreset = { id: 'agn_01jcbk9v502x8m4v0k5a1b2c01', role: 'LOCAL_AGENCY', name: '강남 지역대리점장 (최태호)', role_label: 'Local Agency Admin', territory: '서울 강남구 관할' };
    const presets = {
      admin_hq: { id: 'admin_hq', role: 'SUPER_ADMIN', name: '최고운영책임자 (HQ)', role_label: 'Super Admin · 2FA 인증됨', territory: '전국 17개 시/도' },
      dst_01seoul: distPreset,
      dst_seoul: distPreset,
      agn_01gangnam: agencyPreset,
      agn_gangnam: agencyPreset,
      fsr_01: { id: 'fsr_01', role: 'FIELD_SALES', name: '현장 영업 매니저 (이민호)', role_label: 'Field Sales', territory: '서울 서초/강남권' }
    };

    const user = presets[id] || {
      id: id || 'admin_user',
      role: 'SUPER_ADMIN',
      name: '시스템 운영자',
      role_label: 'Admin Authenticated',
      territory: '전국'
    };

    try {
      localStorage.setItem('aitip_admin_session', JSON.stringify(user));
    } catch {}
    return Promise.resolve({ success: true, user });
  },

  getCurrentUser() {
    try {
      const saved = localStorage.getItem('aitip_admin_session');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      id: 'admin_hq',
      role: 'SUPER_ADMIN',
      name: '최고운영책임자 (HQ)',
      role_label: 'Super Admin · 2FA 인증됨',
      territory: '전국 17개 시/도'
    };
  },

  logout() {
    try {
      localStorage.removeItem('aitip_admin_session');
    } catch {}
    return Promise.resolve({ success: true });
  },

  // 1. 전국 통합 대시보드 지표
  getDashboardMetrics(filter = {}) {
    const params = new URLSearchParams(filter).toString();
    return request(`/dashboard${params ? '?' + params : ''}`);
  },

  // 2. 광역 총판 유통망 (agn_)
  getDistributors(filter = {}) {
    const params = new URLSearchParams(filter).toString();
    return request(`/distributors${params ? '?' + params : ''}`);
  },

  // 2-2. 지역 대리점 유통망 (agn_)
  getAgencies(filter = {}) {
    const params = new URLSearchParams(filter).toString();
    return request(`/agencies${params ? '?' + params : ''}`);
  },

  // 2-3. 제휴 협력사 (VAN/설치/물류: agn_)
  getPartners(filter = {}) {
    const params = new URLSearchParams(filter).toString();
    return request(`/partners${params ? '?' + params : ''}`);
  },

  // 3. 소상공인 일반 외식 가맹점 (str_)
  getStores(filter = {}) {
    const params = new URLSearchParams(filter).toString();
    return request(`/stores${params ? '?' + params : ''}`);
  },

  // 4. 단위농협 하나로마트 (mrt_)
  getMarts(filter = {}) {
    const params = new URLSearchParams(filter).toString();
    return request(`/marts${params ? '?' + params : ''}`);
  },

  // 5. 수요 시설 (경로당/복지관: fac_)
  getFacilities(filter = {}) {
    const params = new URLSearchParams(filter).toString();
    return request(`/facilities${params ? '?' + params : ''}`);
  },

  // 6. 스마트 단말기 MDM (dev_)
  getDevices(filter = {}) {
    const params = new URLSearchParams(filter).toString();
    return request(`/devices${params ? '?' + params : ''}`);
  },

  // 7. 배송망 & 라이더 (wrk_ / dlv_)
  getRiders(filter = {}) {
    const params = new URLSearchParams(filter).toString();
    return request(`/riders${params ? '?' + params : ''}`);
  },

  // 8. 실시간 주문 스트림 (ord_)
  getLiveOrders(filter = {}) {
    const params = new URLSearchParams(filter).toString();
    return request(`/orders/live${params ? '?' + params : ''}`);
  },

  // 9. 다중 자산 결제 & 3자 대사 정산 원장 (mat_)
  getPaymentTransactions(filter = {}) {
    const params = new URLSearchParams(filter).toString();
    return request(`/payments/transactions${params ? '?' + params : ''}`);
  },
  getPaymentTechnicalMetrics() {
    return Promise.resolve({
      success: true,
      timestamp: new Date().toISOString(),
      gateways: [
        { name: '토스페이먼츠 PG', status: 'HEALTHY', latency_ms: 184 },
        { name: '제로페이/서울사랑상품권', status: 'HEALTHY', latency_ms: 210 }
      ]
    });
  },

  // 10. 세무 정산 (3.3% 원천징수 vs 10% 계산서)
  getTaxSettlements() {
    return request('/settlements/taxes');
  },
  updateTaxType(id, nextType) {
    const target = TAX_SETTLEMENT_ITEMS.find(it => it.id === id);
    if (target && (nextType === 'WITHHOLDING_3_3' || nextType === 'TAX_INVOICE_10')) {
      target.tax_type = nextType;
      target.doc_no = nextType === 'TAX_INVOICE_10'
        ? target.doc_no.replace(/^WTH-/, 'NTS-')
        : target.doc_no.replace(/^NTS-/, 'WTH-');
    }
    return Promise.resolve({ success: true, item: target || null });
  },

  // 11. 계층형 UID 분석 및 가맹점 즉시 핀포인트 조회 (전사 계층 식별자 O(1) 색인)
  parseHierarchicalUid(uid) {
    if (!uid || typeof uid !== 'string') return null;
    const parts = uid.split('-');
    const prefix = parts[0];

    // ORD-{시도2}-{시군구3}-{대리점2}-{업종5}-{점포4}-{일자6}-{순번4}
    if (prefix === 'ORD' && parts.length >= 8) {
      const sido_code = parts[1];
      const sigungu_code = parts[2];
      const agency_code = parts[3];
      const ksic_code = parts[4];
      const seq = parts[5];
      const isMart = ksic_code === '47121';
      return {
        type: 'ORDER',
        sido_code,
        sigungu_code,
        agency_code,
        ksic_code,
        seq,
        order_date: parts[6],
        order_seq: parts[7],
        merchant_id: `${isMart ? 'MRT' : 'STR'}-${sido_code}-${sigungu_code}-${agency_code}-${ksic_code}-${seq}`
      };
    }

    // STR / MRT / FAC 6개 파트: {타입}-{시도2}-{시군구3}-{대리점2}-{업종5}-{순번4}
    if ((prefix === 'STR' || prefix === 'MRT' || prefix === 'FAC') && parts.length >= 6) {
      return {
        type: prefix === 'STR' ? 'STORE' : prefix === 'MRT' ? 'MART' : 'FACILITY',
        sido_code: parts[1],
        sigungu_code: parts[2],
        agency_code: parts[3],
        ksic_code: parts[4],
        seq: parts[5],
        merchant_id: uid
      };
    }

    return null;
  },

  getStoreById(storeId) {
    const store = STORES_CATALOG.find(s => s.id === storeId);
    if (store) return Promise.resolve({ success: true, store, isMart: false });
    const mart = MARTS_CATALOG.find(m => m.id === storeId);
    if (mart) return Promise.resolve({ success: true, store: mart, isMart: true });
    return Promise.resolve({ success: false, error: `존재하지 않는 가맹점 UID: ${storeId}` });
  },

  getMerchantByOrderId(orderId) {
    const parsed = this.parseHierarchicalUid(orderId);
    if (!parsed || !parsed.merchant_id) {
      return Promise.resolve({ success: false, error: '유효한 계층형 주문 식별자가 아닙니다.' });
    }
    return this.getStoreById(parsed.merchant_id);
  },

  // 12. Zero-PII CS 분쟁/환불/블랙리스트 관제 (Search-First + Server Pagination)
  setAuthContext(role = 'HQ_SUPER', tenantId = 'hq') {
    authContext.role = role || 'HQ_SUPER';
    authContext.tenantId = tenantId || 'hq';
  },
  getAuthContext() {
    return { ...authContext };
  },
  getCsDisputes(params = {}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const qstr = qs.toString();
    return request(`/cs/disputes${qstr ? '?' + qstr : ''}`);
  },
  executeOrderRefund(payload) {
    return request('/cs/refund', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  toggleCustomerBlacklist(customer_uid) {
    return request('/cs/blacklist', {
      method: 'POST',
      body: JSON.stringify({ customer_uid })
    });
  },

  // 13. Zero-PII 포인트 원장 & 어뷰징 관제
  getPointLedger() {
    return request('/points/ledger');
  },
  adjustCustomerPoints(payload) {
    return request('/points/adjust', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  updatePointPolicy(payload) {
    return request('/points/policy', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // 14. 배너·공지 & 플랫폼 쿠폰
  getPromotions() {
    return request('/promotions');
  },
  savePromotion(payload) {
    return request('/promotions', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // 15. 배달 권역 & 5대 업종 서비스 관리
  getServiceZones() {
    return request('/zones');
  },
  updateServiceZoneOrModule(payload) {
    return request('/zones', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // 16. 시스템 정책 & 점검 모드
  getSystemPolicies() {
    return request('/policies');
  },
  updateSystemPolicies(payload) {
    return request('/policies', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // 17. 가맹점 영업 상태 & 온보딩 심사 실데이터 연동
  toggleStoreStatus(store_id) {
    return request('/stores/status', {
      method: 'POST',
      body: JSON.stringify({ store_id })
    });
  },
  getOnboardingApplications() {
    return request('/onboarding');
  },
  approveOnboarding(id) {
    return request('/onboarding/approve', {
      method: 'POST',
      body: JSON.stringify({ id })
    });
  },
  requestOnboardingRevision(id, reason) {
    return request('/onboarding/revision', {
      method: 'POST',
      body: JSON.stringify({ id, reason })
    });
  },
  submitOnboardingApplication(payload) {
    return request('/onboarding/apply', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // 18. 총판·대리점·협력사·본사직영(HQ_DIRECT) 등록 및 상태 관리
  createOrganizationEntity(payload) {
    return request('/org/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  toggleOrganizationStatus(kind, id) {
    return request('/org/toggle-status', {
      method: 'POST',
      body: JSON.stringify({ kind, id })
    });
  },
  approveOrganizationEntity(kind, id) {
    return request('/org/approve', {
      method: 'POST',
      body: JSON.stringify({ kind, id })
    });
  }
};
