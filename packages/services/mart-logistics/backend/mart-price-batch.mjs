/**
 * AITIP Mart Logistics - 당일 시세 일괄 업로드 & 원클릭 롤백 도메인 모듈 (ESM)
 */

let _uidSeq = 0;

export function nextMonotonicId(prefix) {
  _uidSeq = (_uidSeq + 1) % 10000;
  return `${prefix}_${Date.now()}_${String(_uidSeq).padStart(4, '0')}`;
}

export function applyDailyPriceBatchToData(data, { rows = [], mode = 'PARTIAL', source_name = 'daily_price.csv' } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('업로드할 시세 행 데이터가 없습니다.');
  }
  const products = data.products || [];
  const snapshot = products.map(p => ({
    id: p.id,
    cost_price: p.cost_price,
    regular_price: p.regular_price,
    sale_price: p.sale_price,
    b2b_price: p.b2b_price ?? 0,
    stock_qty: p.stock_qty ?? 50,
    online_publish_status: p.online_publish_status || 'PUBLISHED_FEED'
  }));

  const norm = (s = '') => String(s || '').replace(/\s+/g, '').toLowerCase();
  const matchedIds = new Set();
  const errors = [];
  let successCount = 0;

  const parseOptNum = (v) => {
    if (v === undefined || v === null || String(v).trim() === '') return { ok: true, empty: true, val: undefined };
    const n = Number(String(v).replace(/,/g, '').trim());
    if (!Number.isFinite(n) || n < 0) return { ok: false, empty: false, val: v };
    return { ok: true, empty: false, val: Math.round(n) };
  };

  rows.forEach((r, idx) => {
    const bc = String(r.barcode || '').trim();
    const nm = String(r.name || '').trim();
    const prodIdx = products.findIndex(p => (bc && p.barcode === bc) || (nm && norm(p.name) === norm(nm)));
    const cCost = parseOptNum(r.cost_price);
    const cReg = parseOptNum(r.regular_price);
    const cSale = parseOptNum(r.sale_price);
    const cB2b = parseOptNum(r.b2b_price);
    const cStock = parseOptNum(r.stock_qty);

    let reason = '';
    if (prodIdx < 0) reason = '미등록 상품 (바코드·상품명 불일치)';
    else if (!cCost.ok || !cReg.ok || !cSale.ok || !cB2b.ok || !cStock.ok) reason = '가격·재고 숫자 오류 (음수 또는 문자)';
    else if ((!cReg.empty && cReg.val === 0) || (!cSale.empty && cSale.val === 0)) reason = '판매가는 0원일 수 없습니다 (품절은 재고 0 입력)';

    if (reason) {
      errors.push({
        row_no: r.row_no || idx + 1,
        barcode: bc,
        name: nm,
        spec: r.spec || '',
        cost_price: r.cost_price ?? '',
        regular_price: r.regular_price ?? '',
        sale_price: r.sale_price ?? '',
        b2b_price: r.b2b_price ?? '',
        stock_qty: r.stock_qty ?? '',
        reason
      });
      return;
    }

    const cur = products[prodIdx];
    const nextReg = !cReg.empty ? cReg.val : Number(cur.regular_price || 0);
    const nextSale = !cSale.empty ? cSale.val : Number(cur.sale_price ?? nextReg);
    const nextCost = !cCost.empty ? cCost.val : Number(cur.cost_price || 0);
    const nextB2b = !cB2b.empty ? cB2b.val : Number(cur.b2b_price ?? 0);
    const nextStock = !cStock.empty ? cStock.val : Number(cur.stock_qty ?? 50);

    products[prodIdx] = {
      ...cur,
      cost_price: nextCost,
      regular_price: nextReg,
      sale_price: nextSale,
      b2b_price: nextB2b,
      stock_qty: nextStock,
      discount_pct: nextReg > 0 && nextSale < nextReg ? Math.round((1 - nextSale / nextReg) * 100) : 0
    };
    matchedIds.add(cur.id);
    successCount += 1;
  });

  let syncedSuspendedCount = 0;
  if (mode === 'SYNC_FRESH') {
    products.forEach((p, i) => {
      const isFresh = ['01', '02', '03'].includes(String(p.category_l1 || '')) || p.category_type === 'FRESH';
      if (isFresh && !matchedIds.has(p.id) && p.online_publish_status !== 'SUSPENDED') {
        products[i] = { ...p, online_publish_status: 'SUSPENDED' };
        syncedSuspendedCount += 1;
      }
    });
  }

  const batchId = nextMonotonicId('upl');
  if (!Array.isArray(data.upload_history)) data.upload_history = [];
  const shouldSave = successCount > 0 || syncedSuspendedCount > 0;
  if (shouldSave) {
    data.upload_history.unshift({
      batch_id: batchId,
      created_at: new Date().toISOString(),
      mode,
      source_name: String(source_name || 'daily_price.csv'),
      total_rows: rows.length,
      success_count: successCount,
      error_count: errors.length,
      synced_suspended_count: syncedSuspendedCount,
      rolled_back_at: '',
      snapshot_products: snapshot
    });
    data.upload_history = data.upload_history.slice(0, 20);
  }

  return {
    shouldSave,
    result: {
      batch_id: batchId,
      success_count: successCount,
      error_count: errors.length,
      synced_suspended_count: syncedSuspendedCount,
      errors
    }
  };
}

export function getUploadHistoryFromData(data) {
  const list = Array.isArray(data.upload_history) ? data.upload_history : [];
  return list.map(({ snapshot_products, ...meta }) => meta);
}

export function rollbackUploadBatchInData(data, batchId = '') {
  const list = Array.isArray(data.upload_history) ? data.upload_history : [];
  const target = list.find(h => h.batch_id === batchId);
  if (!target || !Array.isArray(target.snapshot_products)) {
    throw new Error('복원할 업로드 이력을 찾을 수 없습니다.');
  }
  const snapMap = new Map(target.snapshot_products.map(s => [s.id, s]));
  let restored = 0;
  data.products = (data.products || []).map(p => {
    const s = snapMap.get(p.id);
    if (!s) return p;
    restored += 1;
    return { ...p, ...s };
  });
  target.rolled_back_at = new Date().toISOString();
  return { restored_count: restored, batch_id: batchId, rolled_back_at: target.rolled_back_at };
}
