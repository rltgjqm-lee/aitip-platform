/**
 * AITIP Mart PWA - Multi-Rule Cart Promotion Evaluation Engine (ESM)
 * 1+1, 2+1, 골라담기(MIX_AND_MATCH), 요일 제한, 카드별 할인, 최대 할인 한도 통합 계산
 */

const JS_DAY_TO_CODE = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_KO = { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' };

function normalizeCardCode(raw = '') {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return '';
  if (s.includes('NH') || s.includes('농협')) return 'NH';
  if (s.includes('KB') || s.includes('국민')) return 'KB';
  if (s.includes('SHINHAN') || s.includes('신한')) return 'SHINHAN';
  if (s.includes('SAMSUNG') || s.includes('삼성')) return 'SAMSUNG';
  if (s.includes('HYUNDAI') || s.includes('현대')) return 'HYUNDAI';
  if (s.includes('LOTTE') || s.includes('롯데')) return 'LOTTE';
  return s;
}

function checkPromoConditions(product, { selectedCard = 'ALL', todayCode = 'MON' }) {
  const days = Array.isArray(product.promo_days_of_week) ? product.promo_days_of_week : [];
  if (days.length > 0 && !days.includes(todayCode)) {
    const label = days.map(d => DAY_KO[d] || d).join('·');
    return { eligible: false, reason: `${label}요일 전용 행사` };
  }
  const targets = Array.isArray(product.promo_card_targets) ? product.promo_card_targets : [];
  if (targets.length > 0) {
    const normSel = normalizeCardCode(selectedCard);
    const normTargets = targets.map(normalizeCardCode);
    if (!normSel || normSel === 'ALL' || !normTargets.includes(normSel)) {
      return { eligible: false, reason: `${targets.join('/')} 카드 전용` };
    }
  }
  return { eligible: true, reason: '' };
}

export function evaluateCartPromotions(cartItems = [], { selectedCard = 'ALL', now = new Date() } = {}) {
  const todayCode = JS_DAY_TO_CODE[now.getDay()] || 'MON';
  const lineMap = new Map();
  const mixGroups = new Map();

  let subtotalBeforeDiscount = 0;
  let totalQty = 0;

  for (const { product, qty } of cartItems) {
    const regPrice = Number(product.regular_price || product.sale_price || 0);
    const salePrice = Number(product.sale_price || regPrice || 0);
    const pType = product.applied_promo_type || '';
    const pCalcMode = product.promo_calc_mode || '';
    const cond = product.applied_promo_id ? checkPromoConditions(product, { selectedCard, todayCode }) : { eligible: true, reason: '' };

    // 요일/카드 조건 미충족 시 정상가(또는 행사 미적용)로 복원
    const unitPrice = (product.applied_promo_id && !cond.eligible) ? regPrice : salePrice;
    const baseLineAmt = unitPrice * qty;
    let lineDiscount = 0;
    let appliedBadge = '';
    let promoNote = cond.reason;

    if (product.applied_promo_id && cond.eligible) {
      if (pType === 'BOGO_1_PLUS_1' || pType === 'BOGO_2_PLUS_1' || pCalcMode === 'BOGO_BUNDLE') {
        const req = Math.max(pType === 'BOGO_2_PLUS_1' ? 3 : 2, Number(product.promo_required_qty || 2));
        const sets = Math.floor(qty / req);
        const rem = qty % req;
        const bundlePrice = Number(product.promo_bundle_price || 0);
        if (sets > 0) {
          const targetTotal = bundlePrice > 0
            ? (sets * bundlePrice) + (rem * unitPrice)
            : (sets * (req - 1) * unitPrice) + (rem * unitPrice);
          lineDiscount = Math.max(0, baseLineAmt - targetTotal);
          appliedBadge = pType === 'BOGO_2_PLUS_1' ? '2+1 적용' : '덤 증정 적용';
        } else {
          promoNote = `${req}개 담으면 혜택 적용`;
        }
      } else if (pType === 'MIX_AND_MATCH' || pType === 'CROSS_BUY' || pCalcMode === 'MIX_MATCH') {
        const gid = product.applied_promo_id;
        if (!mixGroups.has(gid)) mixGroups.set(gid, []);
        mixGroups.get(gid).push({ product, qty, unitPrice, baseLineAmt });
      } else if (salePrice < regPrice) {
        appliedBadge = product.applied_promo_name || '특가 적용';
      }
    }

    const maxCap = Number(product.promo_max_discount_amount || 0);
    if (maxCap > 0 && lineDiscount > maxCap) {
      lineDiscount = maxCap;
    }

    subtotalBeforeDiscount += baseLineAmt;
    totalQty += qty;
    lineMap.set(product.id, {
      product,
      qty,
      unitPrice,
      baseLineAmt,
      lineDiscount,
      lineTotal: Math.max(0, baseLineAmt - lineDiscount),
      appliedBadge,
      promoNote
    });
  }

  // 골라담기(MIX_AND_MATCH / CROSS_BUY) 그룹 묶음 할인 분배
  for (const [, entries] of mixGroups.entries()) {
    const first = entries[0].product;
    const req = Math.max(2, Number(first.promo_required_qty || 4));
    const bundlePrice = Number(first.promo_bundle_price || 0);
    const sumQty = entries.reduce((acc, e) => acc + e.qty, 0);
    const sets = Math.floor(sumQty / req);
    if (sets <= 0 || bundlePrice <= 0) {
      for (const e of entries) {
        const line = lineMap.get(e.product.id);
        if (line) line.promoNote = `골라담기 ${sumQty}/${req}개`;
      }
      continue;
    }
    const eligibleQty = sets * req;
    const avgUnit = entries.reduce((acc, e) => acc + e.baseLineAmt, 0) / sumQty;
    let groupDisc = Math.max(0, Math.round(eligibleQty * avgUnit - sets * bundlePrice));
    const maxCap = Number(first.promo_max_discount_amount || 0);
    if (maxCap > 0 && groupDisc > maxCap) groupDisc = maxCap;

    let remainingDisc = groupDisc;
    entries.forEach((e, idx) => {
      const line = lineMap.get(e.product.id);
      if (!line) return;
      const share = idx === entries.length - 1
        ? remainingDisc
        : Math.round(groupDisc * (e.qty / sumQty));
      remainingDisc -= share;
      line.lineDiscount += share;
      line.lineTotal = Math.max(0, line.baseLineAmt - line.lineDiscount);
      line.appliedBadge = `골라담기 ${sets}세트 적용`;
    });
  }

  let localSum = 0;
  let coSellSum = 0;
  let totalDiscount = 0;
  for (const line of lineMap.values()) {
    totalDiscount += line.lineDiscount;
    if (line.product.shared_catalog_scope === 'NATIONWIDE_CO_SELL') coSellSum += line.lineTotal;
    else localSum += line.lineTotal;
  }

  return {
    localSum,
    coSellSum,
    totalQty,
    subtotalBeforeDiscount,
    totalDiscount,
    grandTotal: localSum + coSellSum,
    lines: Array.from(lineMap.values())
  };
}
