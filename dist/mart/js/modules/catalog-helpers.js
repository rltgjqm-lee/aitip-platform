/**
 * AITIP Mart Portal - Catalog Pure Helpers & Constants (ESM)
 */

export const SAMPLE_POS_CSV = `바코드,상품명,규격,단위,과면세구분,매입원가,정상판매가,행사가,행사시작일,행사종료일,분류코드
8801007052120,CJ 백설 하얀설탕,1KG,봉,과세,1650,2350,1980,2026-11-17,2026-11-25,가공식품>조미료
2000020000005,국내산 깐마늘(대),1KG,봉,면세,6800,8900,7900,2026-11-17,2026-11-23,농산>양념채소`;

export const TYPE_LABEL = {
  B2B_INDUSTRIAL: '가공·생활',
  FRESH: '신선식품',
  SUBSCRIPTION: '예약·정기'
};

export const SOURCE_LABEL = {
  MART_FLOOR: '마트 매장·창고',
  PREP_CENTER: '전처리 작업장',
  DIRECT_SUPPLIER: '공급사·산지 직납'
};

export const PUBLISH_LABEL = {
  PUBLISHED_FEED: '홈 진열',
  SEARCH_ONLY: '검색 전용',
  SUSPENDED: '노출 중지'
};

export function escapeHtml(v = '') {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmtWon(n) {
  return `${Number(n || 0).toLocaleString()}원`;
}

export function calcMarginPct(cost, sale) {
  const s = Number(sale || 0);
  const c = Number(cost || 0);
  if (s <= 0) return 0;
  return Math.round(((s - c) / s) * 100);
}

export function renderPublishPill(status) {
  if (status === 'SUSPENDED') return '<span class="mc-pill mc-pill-gray">노출 중지</span>';
  if (status === 'SEARCH_ONLY') return '<span class="mc-pill mc-pill-blue">검색 전용</span>';
  return '<span class="mc-pill mc-pill-green">홈 진열</span>';
}

export function renderScopePill(scope, channelScope) {
  if (channelScope === 'ONLINE_ONLY') return '<span class="mc-pill mc-pill-blue">온라인 전용</span>';
  if (scope === 'POS_ONLY' || channelScope === 'POS_ONLY') return '<span class="mc-pill mc-pill-amber">POS 전용</span>';
  return '<span class="mc-pill mc-pill-green">온·오프 공통</span>';
}

export const BUNDLE_PROMO_TYPES = new Set(['BOGO_1_PLUS_1', 'BOGO_2_PLUS_1', 'MIX_AND_MATCH', 'CROSS_BUY']);
export const DAY_KO = { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' };

export function computePromoApplication(promo, regularPrice) {
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
      promo_calc_mode: '',
      promo_required_qty: 1,
      promo_bundle_price: 0,
      promo_days_of_week: [],
      promo_max_discount_amount: 0,
      promo_limit_per_person: 0,
      promo_card_targets: []
    };
  }
  let sale = reg;
  const isBundleMode = BUNDLE_PROMO_TYPES.has(promo.promo_type) || promo.calc_mode === 'BOGO_BUNDLE' || promo.calc_mode === 'MIX_MATCH';
  if (!isBundleMode) {
    let rawDisc = 0;
    if (promo.discount_type === 'FIXED_AMOUNT' && Number(promo.discount_amount || 0) > 0) {
      rawDisc = Number(promo.discount_amount || 0);
    } else if (Number(promo.discount_pct || 0) > 0 && reg > 0) {
      rawDisc = Math.round(reg * (Number(promo.discount_pct) / 100));
    }
    const maxCap = Number(promo.max_discount_amount || 0);
    const cappedDisc = maxCap > 0 ? Math.min(rawDisc, maxCap) : rawDisc;
    sale = Math.max(0, reg - cappedDisc);
  }
  const discPct = reg > 0 && sale < reg ? Math.round((1 - sale / reg) * 100) : 0;
  const chScope = promo.channel_scope || (promo.payment_scope === 'POS_ONLY' ? 'POS_ONLY' : 'ALL_CHANNELS');
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
    promo_calc_mode: promo.calc_mode || '',
    promo_required_qty: Number(promo.required_qty || 1),
    promo_bundle_price: Number(promo.bundle_price || 0),
    promo_days_of_week: Array.isArray(promo.days_of_week) ? promo.days_of_week : [],
    promo_max_discount_amount: Number(promo.max_discount_amount || 0),
    promo_limit_per_person: Number(promo.limit_per_person || 0),
    promo_card_targets: Array.isArray(promo.card_targets) ? promo.card_targets : []
  };
}
