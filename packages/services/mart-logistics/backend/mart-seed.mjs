/**
 * AITIP Mart Logistics Default Seed Data Factories (ESM)
 */

export function createDefaultPwaConfig() {
  return {
    store_status: 'OPEN', // 'OPEN' | 'PREP_BREAK' | 'CLOSED'
    cutoff_time: '14:00',
    pos_only_policy: 'BADGE_ONLY', // 'BADGE_ONLY' | 'HIDE'
    notice_text: '금주 금요일까지 김장용 전처리 채소 예약 접수 중입니다.',
    blocks: [
      { id: 'STATUS_BANNER', title: '영업 · 배송 마감 안내', enabled: true, order: 1 },
      { id: 'FLYER_CAROUSEL', title: '금주의 전단 특가 슬라이더', enabled: true, order: 2 },
      { id: 'CATEGORY_GRID', title: '퀵 카테고리 (2행×4열)', enabled: true, order: 3 },
      { id: 'PROMO_SHELF', title: '1+1 · 골라담기 · 반짝세일', enabled: true, order: 4 },
      { id: 'CURATED_SHELF', title: '오늘 입고된 추천 상품', enabled: true, order: 5 },
      { id: 'CO_SELL_AND_GROUP_BUY', title: '전국 공동판매 & 우리동네 공동구매', enabled: true, order: 6 }
    ]
  };
}

export function createDefaultMarts() {
  return [
    {
      mart_id: 'MRT-11-650-01-47121-0001',
      mart_name: '서초농협 하나로마트 양재점',
      mart_type: 'NH_HANARO',
      region: '서울 서초구',
      operator_name: '서초구 시니어클럽 위탁운영팀',
      agency_fee_pct: 5.0,
      status: 'ACTIVE'
    },
    {
      mart_id: 'MRT-11-650-02-51002-0001',
      mart_name: '우리동네 신선 식자재마트',
      mart_type: 'GENERAL_MART',
      region: '서울 서초구',
      operator_name: '직영·위탁 혼합',
      agency_fee_pct: 4.5,
      status: 'ACTIVE'
    },
    {
      mart_id: 'MRT-47-130-01-88201-0001',
      mart_name: '안동농협 산지직송 특산물센터',
      mart_type: 'NH_HANARO',
      region: '경북 안동시',
      operator_name: '산지 공동판매 조합',
      agency_fee_pct: 3.5,
      status: 'ACTIVE'
    }
  ];
}

export function createDefaultGroupBuys() {
  return [
    {
      campaign_id: 'mgb_202611_01',
      campaign_type: 'B2B_INSTITUTIONAL',
      title: '[경로당·기관 공구] 국내산 깐양파 1kg × 10봉 (1망)',
      mart_id: 'MRT-11-650-01-47121-0001',
      unit_price: 29800,
      regular_price: 42000,
      target_qty: 100,
      current_qty: 74,
      deadline_at: '2026-11-22',
      distribution_mode: 'REGIONAL_DELIVERY',
      status: 'OPEN'
    },
    {
      campaign_id: 'mgb_202611_02',
      campaign_type: 'B2C_RESIDENT',
      title: '[우리동네 공구] 산지직송 안동 사과 3kg (가정용)',
      mart_id: 'MRT-47-130-01-88201-0001',
      unit_price: 15900,
      regular_price: 22900,
      target_qty: 50,
      current_qty: 42,
      deadline_at: '2026-11-20',
      distribution_mode: 'HUB_PICKUP',
      status: 'OPEN'
    }
  ];
}

export function createDefaultPromoTypes() {
  return [
    { code: 'PRICE_DISCOUNT', label: '기간 특가', calc_mode: 'UNIT_DISCOUNT', is_active: true, is_system: true },
    { code: 'DAY_OF_WEEK', label: '요일별 특가', calc_mode: 'UNIT_DISCOUNT', is_active: true, is_system: true },
    { code: 'AMOUNT_THRESHOLD', label: '금액기준 할인', calc_mode: 'THRESHOLD', is_active: true, is_system: true },
    { code: 'QTY_THRESHOLD', label: '수량기준 할인', calc_mode: 'THRESHOLD', is_active: true, is_system: true },
    { code: 'QTY_DISCOUNT', label: '다다익선 %할인', calc_mode: 'UNIT_DISCOUNT', is_active: true, is_system: true },
    { code: 'BOGO_1_PLUS_1', label: '덤(1+1)', calc_mode: 'BOGO_BUNDLE', is_active: true, is_system: true },
    { code: 'BOGO_2_PLUS_1', label: '덤(2+1)', calc_mode: 'BOGO_BUNDLE', is_active: true, is_system: true },
    { code: 'MIX_AND_MATCH', label: '골라담기', calc_mode: 'MIX_MATCH', is_active: true, is_system: true },
    { code: 'CROSS_BUY', label: '함께구매', calc_mode: 'MIX_MATCH', is_active: true, is_system: true }
  ];
}

export function createDefaultData() {
  return {
    mart: {
      mart_id: 'MRT-11-650-01-47121-0001',
      mart_name: '서초농협 하나로마트 양재점',
      mart_type: 'NH_HANARO',
      operator_name: '서초구 시니어클럽 위탁운영팀',
      agency_fee_pct: 5.0,
      biz_number: '214-82-04712',
      phone: '02-578-9000',
      address: '서울특별시 서초구 양재대로 123',
      open_hours: '09:00 ~ 22:00',
      delivery_fee: 3000,
      free_delivery_threshold: 40000,
      min_order_amount: 15000,
      pickup_enabled: true,
      settlement_bank: 'NH농협은행',
      settlement_account: '301-0123-4567-81',
      manager: {
        manager_uid: 'MRT-11-650-01-47121-0001-A01',
        name: '김하나 점장',
        role_title: '위탁운영 총괄매니저',
        phone: '010-4100-9001',
        email: 'manager@seocho-mart.kr',
        auth_role: 'AGENCY_OPERATOR'
      }
    },
    staff: [
      {
        staff_id: 'MRT-11-650-01-47121-0001-U001',
        name: '이순자',
        role: 'PREP_WORKER',
        role_label: '전처리 작업자',
        phone: '010-5511-2001',
        work_shift: '07:00 ~ 13:00',
        status: 'ACTIVE'
      },
      {
        staff_id: 'MRT-11-650-01-47121-0001-U002',
        name: '박민수',
        role: 'PICKER',
        role_label: '매장 피킹 · 박싱',
        phone: '010-5511-2002',
        work_shift: '09:00 ~ 18:00',
        status: 'ACTIVE'
      }
    ],
    products: [
      {
        id: 'mrt_sku_01',
        barcode: '8801043014816',
        name: '농심 신라면 멀티',
        category_type: 'B2B_INDUSTRIAL',
        category_path: '가공식품>면류',
        tax_type: 'TAXABLE',
        spec: '120G*5입',
        uom: '번들',
        weight_grams: 600,
        pack_qty: 5,
        cost_price: 3450,
        regular_price: 4480,
        sale_price: 3680,
        promo_start: '2026-11-12',
        promo_end: '2026-11-25',
        storage_temp: 'AMBIENT',
        status: 'ACTIVE'
      },
      {
        id: 'mrt_sku_02',
        barcode: '2000010000008',
        name: '국내산 세척당근(특)',
        category_type: 'FRESH',
        category_path: '농산>채소류',
        tax_type: 'EXEMPT',
        spec: '1KG',
        uom: '봉',
        weight_grams: 1000,
        pack_qty: 1,
        cost_price: 2400,
        regular_price: 3500,
        sale_price: 2980,
        promo_start: '2026-11-12',
        promo_end: '2026-11-18',
        storage_temp: 'AMBIENT',
        status: 'ACTIVE'
      },
      {
        id: 'mrt_sku_03',
        barcode: '2900000000001',
        name: '양파 (깐양파 · 전처리)',
        category_type: 'PREP_PROCESSED',
        category_path: '대행전처리>채소손질',
        tax_type: 'EXEMPT',
        spec: '국내산, 전처리(탈피/꼭지제거), 중, 1kg/봉 (10봉/1망)',
        uom: '봉',
        weight_grams: 1000,
        pack_qty: 10,
        size_grade: '중',
        prep_method: '탈피/꼭지제거',
        inspection_note: '무름 및 곰팡이 없을 것',
        cost_price: 2800,
        regular_price: 4200,
        sale_price: 4200,
        storage_temp: 'AMBIENT',
        status: 'ACTIVE'
      },
      {
        id: 'mrt_sku_04',
        barcode: '2900000000002',
        name: '돼지고기 (불고기용 · 3mm)',
        category_type: 'SUBSCRIPTION',
        category_path: '대행전처리>정육예약',
        tax_type: 'EXEMPT',
        spec: '국내산 한돈, 앞다리살, 슬라이스(3mm), 1kg/팩 (진공)',
        uom: '팩',
        weight_grams: 1000,
        pack_qty: 1,
        size_grade: '상',
        prep_method: '3mm 슬라이스 진공포장',
        inspection_note: '냉장(0~5℃) 유지, 소비기한 7일 이상',
        cost_price: 11500,
        regular_price: 14900,
        sale_price: 14900,
        storage_temp: 'REFRIGERATED',
        status: 'ACTIVE'
      }
    ],
    promotions: [
      {
        id: 'mpr_01',
        name: '[1+1] CJ 해찬들 태양초 골드고추장 (1kg)',
        promo_type: 'BOGO_1_PLUS_1',
        calc_mode: 'BOGO_BUNDLE',
        required_qty: 2,
        bundle_price: 12900,
        discount_pct: 0,
        limit_per_person: 2,
        start_date: '2026-11-12',
        end_date: '2026-11-25',
        status: 'ACTIVE'
      },
      {
        id: 'mpr_02',
        name: '[골라담기] 농심 스낵 4종 (새우깡/양파링/꿀꽈배기/자갈치)',
        promo_type: 'MIX_AND_MATCH',
        calc_mode: 'MIX_MATCH',
        required_qty: 4,
        bundle_price: 4980,
        discount_pct: 0,
        limit_per_person: 0,
        start_date: '2026-11-12',
        end_date: '2026-11-25',
        status: 'ACTIVE'
      }
    ],
    promo_types: createDefaultPromoTypes(),
    orders: [
      {
        order_id: 'ORD-11-650-01-47121-0001-261117-0001',
        customer_type: 'SENIOR_CENTER',
        facility_id: 'FAC-11-650-01-87391-0001',
        buyer_name: '서초 양재1동 경로당 (주간 급식)',
        schedule_type: 'RECURRING_TUE_THU',
        delivery_date: '2026-11-17',
        items: [
          { product_id: 'mrt_sku_03', name: '양파 (깐양파 · 전처리)', qty: 15, uom: '봉', unit_price: 4200, storage_temp: 'AMBIENT' },
          { product_id: 'mrt_sku_04', name: '돼지고기 (불고기용 · 3mm)', qty: 10, uom: '팩', unit_price: 14900, storage_temp: 'REFRIGERATED' }
        ],
        total_amount: 212000,
        status: 'PICKING',
        created_at: new Date().toISOString()
      },
      {
        order_id: 'ORD-11-650-01-47121-0001-261117-0002',
        customer_type: 'ELDERLY_CARE',
        facility_id: 'CUST-ZERO-PII-ELDER-01',
        buyer_name: '서초2동 독거어르신 돌봄 꾸러미 (바우처)',
        schedule_type: 'WEEKLY_CARE',
        delivery_date: '2026-11-17',
        items: [
          { product_id: 'mrt_sku_02', name: '국내산 세척당근(특)', qty: 2, uom: '봉', unit_price: 2980, storage_temp: 'AMBIENT' },
          { product_id: 'mrt_sku_01', name: '농심 신라면 멀티', qty: 1, uom: '번들', unit_price: 3680, storage_temp: 'AMBIENT' }
        ],
        total_amount: 9640,
        status: 'REQUESTED',
        created_at: new Date().toISOString()
      }
    ]
  };
}
