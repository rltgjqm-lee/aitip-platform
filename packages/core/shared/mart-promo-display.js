/**
 * AITIP Mart - Promo Shelf Schedule & Field Badge Shared Helper (ESM)
 * 관리자(pwa-control.js)와 소비자 몰(pwa-app.js)이 100% 동일한 스케줄·현장 배지 규격을 공유
 */

export const DAY_ITEMS = [
  { code: 'MON', label: '월', jsDay: 1 },
  { code: 'TUE', label: '화', jsDay: 2 },
  { code: 'WED', label: '수', jsDay: 3 },
  { code: 'THU', label: '목', jsDay: 4 },
  { code: 'FRI', label: '금', jsDay: 5 },
  { code: 'SAT', label: '토', jsDay: 6 },
  { code: 'SUN', label: '일', jsDay: 0 }
];

export const LAYOUT_LABEL = {
  GRID: '카드 그리드',
  HORIZONTAL: '가로 슬라이드',
  HERO: '대형 배너형',
  COUNTDOWN: '마감·한정수량 특가'
};

export const TARGET_TAB_LABEL = {
  SHOP: '장보기 홈',
  FLYER: '전단 탭',
  BOTH: '홈 + 전단 모두'
};

function getKstParts(now = new Date()) {
  const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
  const yyyy = kst.getFullYear();
  const mm = String(kst.getMonth() + 1).padStart(2, '0');
  const dd = String(kst.getDate()).padStart(2, '0');
  const hh = String(kst.getHours()).padStart(2, '0');
  const mi = String(kst.getMinutes()).padStart(2, '0');
  const jsDay = kst.getDay();
  const dayCode = (DAY_ITEMS.find(d => d.jsDay === jsDay) || {}).code || 'MON';
  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    timeStr: `${hh}:${mi}`,
    dayCode
  };
}

export function formatScheduleSummary(block = {}) {
  const parts = [];
  const sDate = String(block.start_date || '').trim();
  const eDate = String(block.end_date || '').trim();
  if (sDate || eDate) {
    const sShort = sDate ? sDate.slice(5).replace('-', '/') : '';
    const eShort = eDate ? eDate.slice(5).replace('-', '/') : '';
    parts.push(`${sShort || '상시'}~${eShort || '상시'}`);
  }
  const days = Array.isArray(block.days_of_week) ? block.days_of_week.filter(Boolean) : [];
  if (days.length > 0 && days.length < 7) {
    const labels = days.map(c => (DAY_ITEMS.find(d => d.code === c) || {}).label || c);
    parts.push(labels.join('·'));
  }
  const sTime = String(block.start_time || '').trim();
  const eTime = String(block.end_time || '').trim();
  if (sTime || eTime) {
    parts.push(`${sTime || '00:00'}~${eTime || '23:59'}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '상시 노출';
}

export function getBlockScheduleStatus(block = {}, linkedPromo = null, now = new Date()) {
  if (block.enabled === false) {
    return { active: false, code: 'DISABLED', label: '비활성' };
  }
  if (linkedPromo) {
    const pStatus = String(linkedPromo.status || 'ACTIVE').toUpperCase();
    if (pStatus === 'PAUSED') return { active: false, code: 'PROMO_PAUSED', label: '행사 일시중지' };
    if (pStatus === 'ENDED') return { active: false, code: 'PROMO_ENDED', label: '행사 종료' };
    const totalLimit = Number(linkedPromo.total_limit_qty || 0);
    const usedQty = Number(linkedPromo.used_qty || 0);
    if (totalLimit > 0 && usedQty >= totalLimit) {
      return { active: false, code: 'SOLD_OUT', label: '한정수량 소진' };
    }
  }

  const { dateStr, timeStr, dayCode } = getKstParts(now);
  const sDate = String(block.start_date || linkedPromo?.start_date || linkedPromo?.start_at || '').slice(0, 10);
  const eDate = String(block.end_date || linkedPromo?.end_date || linkedPromo?.end_at || '').slice(0, 10);
  if (sDate && dateStr < sDate) {
    return { active: false, code: 'SCHEDULED', label: '예약 대기' };
  }
  if (eDate && dateStr > eDate) {
    return { active: false, code: 'EXPIRED', label: '기간 종료' };
  }

  const days = Array.isArray(block.days_of_week) && block.days_of_week.length > 0
    ? block.days_of_week
    : (Array.isArray(linkedPromo?.days_of_week) ? linkedPromo.days_of_week : []);
  if (days.length > 0 && !days.includes(dayCode)) {
    return { active: false, code: 'OFF_DAY', label: '요일 외 미노출' };
  }

  const sTime = String(block.start_time || '').trim();
  const eTime = String(block.end_time || '').trim();
  if (sTime && timeStr < sTime) {
    return { active: false, code: 'OFF_TIME', label: '시간 전 대기' };
  }
  if (eTime && timeStr > eTime) {
    return { active: false, code: 'OFF_TIME', label: '시간 종료' };
  }

  return { active: true, code: 'ACTIVE', label: '노출중' };
}

export function getDeadlineBadgeText(block = {}, linkedPromo = null, now = new Date()) {
  const eDate = String(block.end_date || linkedPromo?.end_date || linkedPromo?.end_at || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eDate)) return '';
  const { dateStr } = getKstParts(now);
  const todayMs = Date.parse(`${dateStr}T00:00:00Z`);
  const endMs = Date.parse(`${eDate}T00:00:00Z`);
  if (!Number.isFinite(todayMs) || !Number.isFinite(endMs)) return '';
  const diffDays = Math.round((endMs - todayMs) / 86400000);
  if (diffDays < 0) return '기간 종료';
  if (diffDays === 0) return '오늘 마감';
  if (diffDays === 1) return '내일 마감 (D-1)';
  return `마감 D-${diffDays} (${eDate.slice(5).replace('-', '/')}까지)`;
}

export function buildPromoFieldBadges(promo = null) {
  if (!promo) return [];
  const badges = [];
  const pType = String(promo.promo_type || '').toUpperCase();
  const cMode = String(promo.calc_mode || '').toUpperCase();
  const reqQty = Number(promo.required_qty || promo.bundle_qty || 1);
  const bundlePrice = Number(promo.bundle_price || 0);
  const discPct = Number(promo.discount_pct ?? promo.discount_value ?? 0);
  const discAmt = Number(promo.discount_amount || 0);
  const maxDisc = Number(promo.max_discount_amount || 0);
  const minAmt = Number(promo.min_purchase_amount || promo.min_order_amount || 0);
  const limitPerPerson = Number(promo.limit_per_person || 0);
  const totalLimit = Number(promo.total_limit_qty || 0);
  const usedQty = Number(promo.used_qty || 0);

  if (pType === 'BOGO_1_PLUS_1' || cMode === 'BOGO_1_PLUS_1') {
    badges.push({ text: '1+1 덤', tone: 'green' });
  } else if (pType === 'BOGO_2_PLUS_1' || cMode === 'BOGO_2_PLUS_1') {
    badges.push({ text: '2+1 덤', tone: 'green' });
  } else if (pType === 'MIX_AND_MATCH' || cMode === 'MIX_AND_MATCH') {
    badges.push({
      text: bundlePrice > 0
        ? `골라담기 ${reqQty}개 ${bundlePrice.toLocaleString()}원`
        : `골라담기 ${reqQty}개`,
      tone: 'green'
    });
  } else if (bundlePrice > 0 && reqQty > 1) {
    badges.push({ text: `${reqQty}개 묶음 ${bundlePrice.toLocaleString()}원`, tone: 'green' });
  } else if (promo.discount_type === 'FIXED_AMOUNT' && discAmt > 0) {
    badges.push({ text: `${discAmt.toLocaleString()}원 할인`, tone: 'amber' });
  } else if (discPct > 0) {
    badges.push({ text: `${discPct}% 특가`, tone: 'amber' });
  }

  if (totalLimit > 0) {
    const remain = Math.max(0, totalLimit - usedQty);
    badges.push({ text: `선착순 ${remain}/${totalLimit}개 남음`, tone: 'red' });
  }
  if (limitPerPerson > 0) {
    badges.push({ text: `1인 ${limitPerPerson}한정`, tone: 'amber' });
  }
  if (minAmt > 0) {
    badges.push({ text: `${minAmt.toLocaleString()}원 이상`, tone: 'slate' });
  }
  if (maxDisc > 0) {
    badges.push({ text: `최대 ${maxDisc.toLocaleString()}원 할인`, tone: 'slate' });
  }

  let cards = promo.card_targets;
  if (!Array.isArray(cards) && typeof promo.card_targets_json === 'string') {
    try { cards = JSON.parse(promo.card_targets_json); } catch (_) { cards = []; }
  }
  if (Array.isArray(cards) && cards.length > 0) {
    badges.push({ text: `카드특가(${cards.length})`, tone: 'blue' });
  }
  return badges;
}
