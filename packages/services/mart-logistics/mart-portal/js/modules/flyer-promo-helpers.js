/**
 * AITIP Mart Portal - 행사 룰 · 전단 파싱 공통 상수 및 계산 헬퍼 모듈 (ESM)
 */

export const CALC_MODE_LABEL = {
  UNIT_DISCOUNT: '단품 할인 (요일·카드 조합)',
  BOGO_BUNDLE: 'N+1 덤 증정 (1+1 / 2+1)',
  MIX_MATCH: 'N개 골라담기 묶음가',
  THRESHOLD: '기준금액 · 수량 이상 할인'
};

export const SAMPLE_FLYER = `행사기간 : 2026년 11월 17일(화) ~ 2026년 11월 30일(월)
거봉 (2kg/박스) 17,900원 ※ 1인 2박스 한정
한돈 삼겹살 (100g당) 1,980원 ※ NH농협카드 현장결제 시
[1+1] CJ 해찬들 태양초 골드고추장 (1kg) 12,900원
[골라담기] 농심 스낵 4종 (새우깡 90g / 양파링 84g / 꿀꽈배기 90g / 자갈치 90g) 4개 구매 시 4,980원
[2개 이상 구매 시 30% 할인] 오뚜기 진라면 매운맛 (120g*5입) 각 3,480원`;

export const PROMO_TYPE_LABEL = {
  PRICE_DISCOUNT: '기간 특가',
  DAY_OF_WEEK: '요일별 특가',
  AMOUNT_THRESHOLD: '금액기준 할인',
  QTY_THRESHOLD: '수량기준 할인',
  QTY_DISCOUNT: '다다익선 %할인',
  BOGO_1_PLUS_1: '덤(1+1)',
  BOGO_2_PLUS_1: '덤(2+1)',
  MIX_AND_MATCH: '골라담기',
  CROSS_BUY: '함께구매'
};

export const CHANNEL_LABEL = {
  ALL_CHANNELS: '온·오프 공통',
  ONLINE_ONLY: '온라인 전용',
  POS_ONLY: '오프라인 POS 전용'
};

export const DAY_LIST = [
  { code: 'MON', label: '월' },
  { code: 'TUE', label: '화' },
  { code: 'WED', label: '수' },
  { code: 'THU', label: '목' },
  { code: 'FRI', label: '금' },
  { code: 'SAT', label: '토' },
  { code: 'SUN', label: '일' }
];

export const CARD_LIST = [
  { code: 'NH', label: 'NH농협' },
  { code: 'SHINHAN', label: '신한' },
  { code: 'SAMSUNG', label: '삼성' },
  { code: 'LOTTE', label: '롯데' },
  { code: 'WOORI', label: '우리' },
  { code: 'BC', label: 'BC' },
  { code: 'KAKAOPAY', label: '카카오페이' },
  { code: 'NAVERPAY', label: '네이버페이' },
  { code: 'TOSSPAY', label: '토스페이' }
];

export function getChannelScope(pr) {
  if (pr.channel_scope) return pr.channel_scope;
  return pr.payment_scope === 'POS_ONLY' ? 'POS_ONLY' : 'ALL_CHANNELS';
}

export const BUNDLE_PROMO_TYPES = new Set(['BOGO_1_PLUS_1', 'BOGO_2_PLUS_1', 'MIX_AND_MATCH', 'CROSS_BUY']);

export function computePromoLinkUpdate(promo, regularPrice) {
  const reg = Math.max(0, Number(regularPrice || 0));
  if (!promo) {
    return {
      sale_price: reg,
      discount_pct: 0,
      promo_start: '',
      promo_end: '',
      applied_promo_id: '',
      applied_promo_name: '',
      applied_promo_type: '',
      promo_required_qty: 1,
      promo_bundle_price: 0,
      promo_days_of_week: [],
      promo_max_discount_amount: 0,
      promo_limit_per_person: 0,
      promo_card_targets: []
    };
  }
  let sale = reg;
  if (!BUNDLE_PROMO_TYPES.has(promo.promo_type)) {
    let rawDisc = 0;
    if (promo.discount_type === 'FIXED_AMOUNT' && Number(promo.discount_amount || 0) > 0) {
      rawDisc = Number(promo.discount_amount || 0);
    } else if (Number(promo.discount_pct || 0) > 0 && reg > 0) {
      rawDisc = Math.round(reg * (Number(promo.discount_pct) / 100));
    }
    const maxCap = Number(promo.max_discount_amount || 0);
    const capped = maxCap > 0 ? Math.min(rawDisc, maxCap) : rawDisc;
    sale = Math.max(0, reg - capped);
  }
  const discPct = reg > 0 && sale < reg ? Math.round((1 - sale / reg) * 100) : 0;
  const chScope = getChannelScope(promo);
  return {
    sale_price: sale,
    discount_pct: discPct,
    promo_start: promo.start_date || '',
    promo_end: promo.end_date || '',
    payment_scope: chScope === 'POS_ONLY' ? 'POS_ONLY' : 'ONLINE_APPLICABLE',
    channel_scope: chScope,
    applied_promo_id: promo.id || '',
    applied_promo_name: promo.name || '',
    applied_promo_type: promo.promo_type || '',
    promo_required_qty: Number(promo.required_qty || 1),
    promo_bundle_price: Number(promo.bundle_price || 0),
    promo_days_of_week: Array.isArray(promo.days_of_week) ? promo.days_of_week : [],
    promo_max_discount_amount: Number(promo.max_discount_amount || 0),
    promo_limit_per_person: Number(promo.limit_per_person || 0),
    promo_card_targets: Array.isArray(promo.card_targets) ? promo.card_targets : []
  };
}
