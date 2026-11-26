/**
 * AITIP Mart Catalog, Flyer, POS CSV & Prep Sheet Parser (ESM)
 * 1. 하나로마트 할인전단 텍스트 파서 (행사기간, 1+1, 골라담기, N개 이상 X% 할인, 1인 한정, 규격/단량)
 * 2. 마트 POS 엑셀(CSV) 상품마스터 파서 (바코드/PLU, 과면세구분, 원가/정상가/행사가, 행사일)
 * 3. 대행기관 전처리·경로당 급식 발주서 파서 (전처리, 대/중/소 등급, 입수, 냉장/상온, 검수기준)
 */

let _parserUidSeq = 0;
function nextMonotonicId(prefix) {
  _parserUidSeq = (_parserUidSeq + 1) % 10000;
  return `${prefix}_${Date.now()}_${String(_parserUidSeq).padStart(4, '0')}`;
}

function parseWeightAndUnit(specText = '') {
  const s = String(specText || '');
  let weightGrams = 0;
  const kgMatch = s.match(/(\d+(?:\.\d+)?)\s*kg/i);
  const gMatch = s.match(/(\d+(?:\.\d+)?)\s*g(?!\w)/i);
  const mlMatch = s.match(/(\d+(?:\.\d+)?)\s*ml/i);
  if (kgMatch) weightGrams = Math.round(Number(kgMatch[1]) * 1000);
  else if (gMatch) weightGrams = Math.round(Number(gMatch[1]));
  else if (mlMatch) weightGrams = Math.round(Number(mlMatch[1]));

  const packMatch = s.match(/[*×x]\s*(\d+)\s*입/i) || s.match(/(\d+)\s*(?:입|봉|모|구)/);
  const packQty = packMatch ? Number(packMatch[1]) : 1;

  let uom = '개';
  if (/박스/i.test(s)) uom = '박스';
  else if (/번들|멀티/i.test(s)) uom = '번들';
  else if (/봉/i.test(s)) uom = '봉';
  else if (/단/i.test(s)) uom = '단';
  else if (/팩/i.test(s)) uom = '팩';
  else if (/판/i.test(s)) uom = '판';
  else if (/통/i.test(s)) uom = '통';

  return { weight_grams: weightGrams, pack_qty: packQty, uom };
}

function inferFulfillmentSource(categoryType = 'B2B_INDUSTRIAL') {
  if (categoryType === 'PREP_PROCESSED') return 'PREP_CENTER';
  return 'MART_FLOOR';
}

function inferPaymentScope(text = '') {
  return /(현장\s*결제|NH\s*농협카드|NH카드|행사카드|제휴카드|매장\s*방문|오프라인\s*전용|카드\s*할인)/.test(String(text || ''))
    ? 'POS_ONLY'
    : 'ONLINE_APPLICABLE';
}

function inferChannelScope(text = '') {
  const s = String(text || '');
  if (/(온라인\s*전용|앱\s*전용|PWA\s*전용)/.test(s)) return 'ONLINE_ONLY';
  if (inferPaymentScope(s) === 'POS_ONLY') return 'POS_ONLY';
  return 'ALL_CHANNELS';
}

function extractCardTargets(text = '') {
  const s = String(text || '');
  const out = [];
  if (/NH\s*농협카드|농협카드|NH카드/i.test(s)) out.push('NH농협카드');
  if (/KB\s*국민카드|국민카드/i.test(s)) out.push('KB국민카드');
  if (/신한카드/.test(s)) out.push('신한카드');
  if (/삼성카드/.test(s)) out.push('삼성카드');
  if (/현대카드/.test(s)) out.push('현대카드');
  if (/롯데카드/.test(s)) out.push('롯데카드');
  return out;
}

function extractDaysOfWeek(text = '') {
  const s = String(text || '');
  if (/금\s*[·,]?\s*토\s*[·,]?\s*일|주말/.test(s)) return ['FRI', 'SAT', 'SUN'];
  if (/평일|월\s*~\s*금/.test(s)) return ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const map = [['월', 'MON'], ['화', 'TUE'], ['수', 'WED'], ['목', 'THU'], ['금', 'FRI'], ['토', 'SAT'], ['일', 'SUN']];
  const out = [];
  for (const [ko, code] of map) {
    if (new RegExp(`${ko}요일`).test(s)) out.push(code);
  }
  return out;
}

function extractMaxDiscount(text = '') {
  const s = String(text || '');
  const mWon = s.match(/최대\s*(\d{1,3}(?:,\d{3})+|\d+)\s*원/);
  if (mWon) return Number(mWon[1].replace(/,/g, ''));
  const mCheon = s.match(/최대\s*(\d+)\s*천원/);
  if (mCheon) return Number(mCheon[1]) * 1000;
  return 0;
}

function parseMartFlyerCsvRows(lines = []) {
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const items = [];
  const promotions = [];
  let minStart = '';
  let maxEnd = '';
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2 || !cols[1]) continue;
    const [barcode, name, rawPromoType, rawReg, rawSale, rawReqQty, rawBundle, startDate, endDate, rawChannel, rawCards] = cols;
    const reg = Math.max(0, Number(String(rawReg || '0').replace(/[^0-9]/g, '')));
    const sale = Math.max(0, Number(String(rawSale || reg || '0').replace(/[^0-9]/g, '')));
    const promoType = rawPromoType || 'PRICE_DISCOUNT';
    const reqQty = Math.max(1, Number(rawReqQty || 1));
    const bundlePrice = Math.max(0, Number(String(rawBundle || '0').replace(/[^0-9]/g, '')));
    const ch = ['ALL_CHANNELS', 'ONLINE_ONLY', 'POS_ONLY'].includes(rawChannel)
      ? rawChannel
      : inferChannelScope(rawChannel || '');
    const cards = rawCards ? rawCards.split(/[|/;]/).map(s => s.trim()).filter(Boolean) : [];
    const calcMode = (promoType === 'BOGO_1_PLUS_1' || promoType === 'BOGO_2_PLUS_1')
      ? 'BOGO_BUNDLE'
      : promoType === 'MIX_AND_MATCH'
        ? 'MIX_MATCH'
        : 'UNIT_DISCOUNT';
    if (startDate && (!minStart || startDate < minStart)) minStart = startDate;
    if (endDate && (!maxEnd || endDate > maxEnd)) maxEnd = endDate;

    const productId = nextMonotonicId('mrt_sku');
    const promoId = nextMonotonicId('mpr');
    const promoName = `${name} (${promoType})`;
    promotions.push({
      id: promoId,
      name: promoName,
      promo_type: promoType,
      calc_mode: calcMode,
      payment_scope: ch === 'POS_ONLY' ? 'POS_ONLY' : 'ONLINE_APPLICABLE',
      channel_scope: ch,
      required_qty: reqQty,
      bundle_price: bundlePrice,
      discount_pct: reg > 0 && sale < reg ? Math.round((1 - sale / reg) * 100) : 0,
      card_targets: cards,
      start_date: startDate || '2026-11-17',
      end_date: endDate || '2026-11-30',
      target_product_ids: [productId],
      status: 'ACTIVE'
    });
    items.push({
      id: productId,
      barcode: barcode || `200${String(1000000000 + items.length).slice(-10)}`,
      name,
      category_type: /^200/.test(barcode || '') ? 'FRESH' : 'B2B_INDUSTRIAL',
      tax_type: /^200/.test(barcode || '') ? 'EXEMPT' : 'TAXABLE',
      spec: '-',
      uom: '개',
      cost_price: Math.round(sale * 0.72),
      regular_price: reg || sale,
      sale_price: sale,
      promo_start: startDate || '',
      promo_end: endDate || '',
      payment_scope: ch === 'POS_ONLY' ? 'POS_ONLY' : 'ONLINE_APPLICABLE',
      channel_scope: ch,
      applied_promo_id: promoId,
      applied_promo_name: promoName,
      applied_promo_type: promoType,
      promo_calc_mode: calcMode,
      promo_required_qty: reqQty,
      promo_bundle_price: bundlePrice,
      promo_card_targets: cards,
      fulfillment_source: 'MART_FLOOR',
      stock_qty: 50,
      safety_stock: 5,
      storage_temp: 'AMBIENT'
    });
  }
  return { promo_start: minStart, promo_end: maxEnd, items, promotions };
}

export function parseMartFlyerText(rawText = '') {
  const lines = String(rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2 && /바코드|상품명/.test(lines[0]) && (lines[0].includes(',') || lines[0].includes('\t'))) {
    return parseMartFlyerCsvRows(lines);
  }
  let promoStart = '';
  let promoEnd = '';
  const items = [];
  const promotions = [];

  for (const line of lines) {
    // 1. 행사기간 추출
    const dateFull = line.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일.*?~\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    const dateShort = line.match(/(\d{1,2})\.(\d{1,2})\([^)]*\)\s*~\s*(\d{1,2})\.(\d{1,2})/);
    if (dateFull) {
      promoStart = `${dateFull[1]}-${dateFull[2].padStart(2, '0')}-${dateFull[3].padStart(2, '0')}`;
      promoEnd = `${dateFull[4]}-${dateFull[5].padStart(2, '0')}-${dateFull[6].padStart(2, '0')}`;
      continue;
    }
    if (dateShort) {
      const y = new Date().getFullYear();
      promoStart = `${y}-${dateShort[1].padStart(2, '0')}-${dateShort[2].padStart(2, '0')}`;
      promoEnd = `${y}-${dateShort[3].padStart(2, '0')}-${dateShort[4].padStart(2, '0')}`;
      continue;
    }

    // 2. 가격 포함 라인 파싱
    const priceMatch = line.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/);
    if (!priceMatch) continue;
    const price = Number(priceMatch[1].replace(/,/g, ''));

    // 1인 한정 수량
    const limitMatch = line.match(/1인\s*(\d+)\s*(?:박스|개|봉|팩|판)\s*한정/);
    const limitPerPerson = limitMatch ? Number(limitMatch[1]) : 0;

    // 행사 유형 판별
    let promoType = 'PRICE_DISCOUNT';
    let requiredQty = 1;
    let discountPct = 0;
    if (/\[1\+1\]/.test(line)) {
      promoType = 'BOGO_1_PLUS_1';
      requiredQty = 2;
    } else if (/\[2\+1\]/.test(line)) {
      promoType = 'BOGO_2_PLUS_1';
      requiredQty = 3;
    } else if (/\[골라담기\]/.test(line)) {
      promoType = 'MIX_AND_MATCH';
      const qtyM = line.match(/(\d+)\s*개\s*구매\s*시/);
      requiredQty = qtyM ? Number(qtyM[1]) : 4;
    } else if (/\d+\s*개\s*이상\s*구매\s*시\s*\d+%\s*할인/.test(line)) {
      promoType = 'QTY_DISCOUNT';
      const qM = line.match(/(\d+)\s*개\s*이상\s*구매\s*시\s*(\d+)%\s*할인/);
      if (qM) {
        requiredQty = Number(qM[1]);
        discountPct = Number(qM[2]);
      }
    }

    // 규격 추출
    const specMatch = line.match(/\(([^)]+)\)/);
    const spec = specMatch ? specMatch[1] : '';
    const { weight_grams, pack_qty, uom } = parseWeightAndUnit(spec);

    // 품명 정제
    const cleanName = line
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/※.*$/g, '')
      .replace(/(\d{1,3}(?:,\d{3})+|\d+)\s*원.*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const productId = nextMonotonicId('mrt_sku');
    const isFresh = /(거봉|무화과|오이|애호박|한돈|삼겹살|목심|양파|감자|대파|당근|무|계란|우유)/.test(cleanName);
    const catType = isFresh ? 'FRESH' : 'B2B_INDUSTRIAL';
    const paymentScope = inferPaymentScope(line);
    const channelScope = inferChannelScope(line);
    const cardTargets = extractCardTargets(line);
    const daysOfWeek = extractDaysOfWeek(line);
    const maxDiscountAmount = extractMaxDiscount(line);
    if (daysOfWeek.length > 0 && promoType === 'PRICE_DISCOUNT') promoType = 'DAY_OF_WEEK';
    const calcMode = (promoType === 'BOGO_1_PLUS_1' || promoType === 'BOGO_2_PLUS_1')
      ? 'BOGO_BUNDLE'
      : promoType === 'MIX_AND_MATCH'
        ? 'MIX_MATCH'
        : 'UNIT_DISCOUNT';
    const bundlePrice = (promoType === 'BOGO_1_PLUS_1' || promoType === 'MIX_AND_MATCH') ? price : 0;

    let linkedPromo = null;
    if (promoType !== 'PRICE_DISCOUNT' || (promoStart && promoEnd) || cardTargets.length > 0 || daysOfWeek.length > 0) {
      linkedPromo = {
        id: nextMonotonicId('mpr'),
        name: `${cleanName || '전단 행사'} (${promoType})`,
        promo_type: promoType,
        calc_mode: calcMode,
        payment_scope: paymentScope,
        channel_scope: channelScope,
        required_qty: requiredQty,
        bundle_price: bundlePrice,
        discount_pct: discountPct,
        max_discount_amount: maxDiscountAmount,
        days_of_week: daysOfWeek,
        card_targets: cardTargets,
        limit_per_person: limitPerPerson,
        start_date: promoStart || '2026-11-01',
        end_date: promoEnd || '2026-12-31',
        target_product_ids: [productId],
        status: 'ACTIVE'
      };
      promotions.push(linkedPromo);
    }

    items.push({
      id: productId,
      barcode: `200${String(1000000000 + items.length).slice(-10)}`,
      name: cleanName || '전단 행사 상품',
      category_type: catType,
      tax_type: isFresh ? 'EXEMPT' : 'TAXABLE',
      spec: spec || '-',
      uom,
      weight_grams,
      pack_qty,
      cost_price: Math.round(price * 0.72),
      regular_price: price,
      sale_price: price,
      promo_start: promoStart,
      promo_end: promoEnd,
      limit_per_person: limitPerPerson,
      payment_scope: paymentScope,
      channel_scope: channelScope,
      applied_promo_id: linkedPromo ? linkedPromo.id : '',
      applied_promo_name: linkedPromo ? linkedPromo.name : '',
      applied_promo_type: linkedPromo ? linkedPromo.promo_type : '',
      promo_calc_mode: linkedPromo ? linkedPromo.calc_mode : '',
      promo_required_qty: requiredQty,
      promo_bundle_price: bundlePrice,
      promo_days_of_week: daysOfWeek,
      promo_max_discount_amount: maxDiscountAmount,
      promo_limit_per_person: limitPerPerson,
      promo_card_targets: cardTargets,
      fulfillment_source: inferFulfillmentSource(catType),
      stock_qty: 50,
      safety_stock: 5,
      storage_temp: /(삼겹살|목심|우유|두부)/.test(cleanName) ? 'REFRIGERATED' : 'AMBIENT'
    });
  }

  return { promo_start: promoStart, promo_end: promoEnd, items, promotions };
}

export function parseMartPosCsv(csvText = '') {
  const lines = String(csvText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (i === 0 && /바코드|상품명/.test(cols[0] + cols[1])) continue;
    if (cols.length < 7) continue;
    const [barcode, name, spec, unit, taxLabel, costPrice, regularPrice, salePrice, startDate, endDate, categoryPath] = cols;
    const { weight_grams, pack_qty, uom } = parseWeightAndUnit(`${spec} ${unit}`);
    const isFresh = taxLabel === '면세' || /^200/.test(barcode || '') || /(농산|축산|수산|유제품)/.test(categoryPath || '');
    const catType = isFresh ? 'FRESH' : 'B2B_INDUSTRIAL';
    items.push({
      id: nextMonotonicId('mrt_pos'),
      barcode: barcode || `20000${i}`,
      name: name || 'POS 상품',
      category_type: catType,
      category_path: categoryPath || '-',
      tax_type: taxLabel === '면세' ? 'EXEMPT' : 'TAXABLE',
      spec: spec || '-',
      uom: unit || uom,
      weight_grams,
      pack_qty,
      cost_price: Number(costPrice || 0),
      regular_price: Number(regularPrice || 0),
      sale_price: Number(salePrice || regularPrice || 0),
      promo_start: startDate || '',
      promo_end: endDate || '',
      payment_scope: 'ONLINE_APPLICABLE',
      fulfillment_source: inferFulfillmentSource(catType),
      stock_qty: 50,
      safety_stock: 5,
      storage_temp: /(축산|계란|유제품|두부)/.test(categoryPath || name || '') ? 'REFRIGERATED' : 'AMBIENT'
    });
  }
  return { items };
}

export function parseMartPrepSheet(rawText = '') {
  const lines = String(rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^연번/.test(line) && /품목명/.test(line)) continue;
    const cols = line.includes('\t')
      ? line.split('\t').map(c => c.trim())
      : line.includes('|')
      ? line.split('|').map(c => c.trim())
      : line.split(',').map(c => c.trim());
    if (cols.length < 3) continue;

    // 연번, 품목명, 상세규격, 발주단위, 수량, 비고
    const hasSeq = /^\d+$/.test(cols[0]);
    const name = hasSeq ? cols[1] : cols[0];
    const detail = hasSeq ? cols[2] : cols[1];
    const unit = hasSeq ? (cols[3] || '봉') : (cols[2] || '봉');
    const note = hasSeq ? (cols[5] || '') : (cols[4] || '');

    const gradeMatch = detail.match(/(?:^|,\s*)(특|상|중|대|소)(?:\s*,|\s*\(|$)/);
    const prepMatch = detail.match(/전처리\(([^)]+)\)/);
    const { weight_grams, pack_qty } = parseWeightAndUnit(detail);
    const isCold = /냉장|0~5℃|진공/.test(`${detail} ${note}`);

    items.push({
      id: nextMonotonicId('mrt_prep'),
      barcode: `290${String(1000000000 + i).slice(-10)}`,
      name: name || '전처리 품목',
      category_type: 'PREP_PROCESSED',
      tax_type: 'EXEMPT',
      spec: detail,
      uom: unit,
      weight_grams,
      pack_qty,
      size_grade: gradeMatch ? gradeMatch[1] : '중',
      prep_method: prepMatch ? prepMatch[1] : '손질·소분',
      inspection_note: note || '신선도 및 중량 검수 필수',
      cost_price: 3500,
      regular_price: 4900,
      sale_price: 4900,
      payment_scope: 'ONLINE_APPLICABLE',
      fulfillment_source: 'PREP_CENTER',
      stock_qty: 50,
      safety_stock: 5,
      storage_temp: isCold ? 'REFRIGERATED' : 'AMBIENT'
    });
  }
  return { items };
}
